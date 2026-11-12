import { Api } from "grammy";
import { Message } from "grammy/types";
import logger from "../utils/logger";
import { config } from "../config/index.js";

// Max time to download an image from Telegram before the check is skipped
const DOWNLOAD_TIMEOUT_MS = 15000;

// Bot API downloads stop at 20 MB; ad images are far smaller, and this keeps
// the request to OpenAI (base64 adds a third) reasonable
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// OpenAI downsizes "high" detail images to 2048 px anyway, so a larger
// Telegram size only costs download time
const MAX_PHOTO_SIDE = 2048;

const IMAGE_DOCUMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * A downloadable image attached to a message
 */
export interface IImageRef {
  fileId: string;
  mimeType: string;
  fileSize?: number;
}

/**
 * Picks the image to analyze: the biggest photo size up to 2048 px, or an
 * image sent as a file. Stickers, GIFs and videos are not analyzed
 * @example
 * const ref = getImageRef(message); // null for text-only messages
 */
export const getImageRef = (message: Message): IImageRef | null => {
  if (message.photo?.length) {
    const sizes = [...message.photo].sort(
      (a, b) => a.width * a.height - b.width * b.height
    );
    const fitting = sizes.filter(
      (size) => Math.max(size.width, size.height) <= MAX_PHOTO_SIDE
    );
    const chosen = fitting.length ? fitting[fitting.length - 1] : sizes[0];

    return {
      fileId: chosen.file_id,
      mimeType: "image/jpeg",
      fileSize: chosen.file_size,
    };
  }

  const { document } = message;

  if (document?.mime_type && IMAGE_DOCUMENT_TYPES.has(document.mime_type)) {
    return {
      fileId: document.file_id,
      mimeType: document.mime_type,
      fileSize: document.file_size,
    };
  }

  return null;
};

/**
 * Whether the size Telegram reported already rules the file out
 * @example
 * isTooLarge({ fileId: "x", mimeType: "image/png", fileSize: 30_000_000 }); // true
 */
export const isTooLarge = (ref: IImageRef): boolean =>
  Boolean(ref.fileSize && ref.fileSize > MAX_IMAGE_BYTES);

/**
 * Detects the image type from the file's first bytes. The MIME type of a
 * document is whatever the sender claimed, and OpenAI rejects the whole
 * request for a file that is not a real image
 * @example
 * detectImageType(buffer); // "image/jpeg" | "image/png" | "image/webp" | null
 */
const detectImageType = (buffer: Buffer): string | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

/**
 * Downloads an image from Telegram as a data URL, or null when it can't be used
 * @example
 * const dataUrl = await downloadImageAsDataUrl(ctx.api, ref);
 */
export const downloadImageAsDataUrl = async (
  api: Api,
  ref: IImageRef
): Promise<string | null> => {
  if (isTooLarge(ref)) {
    logger.info("Image skipped: file too large", { fileSize: ref.fileSize });
    return null;
  }

  try {
    const file = await api.getFile(ref.fileId);

    if (!file.file_path) {
      return null;
    }

    // The download URL contains the bot token: it must never reach the logs
    const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    // An error response body is not an image
    if (!res.ok) {
      logger.warn("Image download failed", { status: res.status });
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    if (buffer.length > MAX_IMAGE_BYTES) {
      logger.info("Image skipped: file too large", { fileSize: buffer.length });
      return null;
    }

    const mimeType = detectImageType(buffer);

    if (!mimeType) {
      logger.info("Image skipped: not a JPEG, PNG or WebP file", {
        declaredType: ref.mimeType,
      });
      return null;
    }

    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    // Only the message: error objects from fetch can carry the request URL
    logger.warn("Image download failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
