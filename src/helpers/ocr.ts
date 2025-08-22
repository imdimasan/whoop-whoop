import Tesseract from "tesseract.js";
import logger from "../utils/logger";
import { config } from "../config/index.js";
import { IBotContext } from "../interfaces/i-bot.js";

/**
 * Extracts OCR text from an image buffer using rus+eng.
 * @example
 * const text = await extractTextFromImage(buffer);
 */
export const extractTextFromImage = async (image: Buffer): Promise<string> => {
  try {
    const { data } = await Tesseract.recognize(image, "rus+eng");

    const text = (data.text || "").replace(/[\s\n\r]+/g, " ").trim();

    return text;
  } catch (error) {
    logger.error("OCR failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
};

/**
 * Processes a Telegram message for OCR if it's a single photo with no text
 * @example
 * const ocrText = await processMessageForOCR(ctx);
 */
export const processMessageForOCR = async (
  ctx: IBotContext
): Promise<string> => {
  const { message } = ctx;

  if (!message) {
    return "";
  }

  // Check if this is a single photo message (photo array contains sizes, not separate photos)
  const hasSinglePhoto = Boolean(message.photo && message.photo.length > 0);

  // Also check that there's no media_group_id (which indicates multiple photos/videos)
  const isMediaGroup = Boolean(message.media_group_id);

  if (!hasSinglePhoto || isMediaGroup) {
    return "";
  }

  try {
    const sizes = message.photo || [];
    const largest = sizes[sizes.length - 1];
    const file = await ctx.api.getFile(largest.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;

    const res = await fetch(fileUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ocrText = await extractTextFromImage(buffer);

    return ocrText;
  } catch (error) {
    logger.error("OCR processing failed", { error });
    return "";
  }
};
