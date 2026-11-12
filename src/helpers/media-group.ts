import { Message } from "grammy/types";
import logger from "../utils/logger";

// Telegram delivers album items as separate updates within about a second;
// the album is moderated once, after no new item arrived for this long
const ALBUM_SETTLE_MS = 1500;

// Upper bound so a slow trickle of items can't postpone the check forever
const ALBUM_MAX_WAIT_MS = 5000;

// Telegram's own limit for one album
const MAX_ALBUM_ITEMS = 10;

interface IPendingAlbum {
  messages: Message[];
  firstSeenAt: number;
  timer: NodeJS.Timeout;
  onComplete: (messages: Message[]) => Promise<void>;
}

const pendingAlbums = new Map<string, IPendingAlbum>();

// Albums are moderated one at a time: each may hold up to 20 MB of images
// in memory, and their timers fire outside grammY's one-update-at-a-time loop
let albumQueue: Promise<void> = Promise.resolve();

/**
 * Queues the album's handler with all collected items, oldest first
 * @example
 * flushAlbum("-100123:13512399");
 */
const flushAlbum = (key: string): void => {
  const album = pendingAlbums.get(key);

  if (!album) {
    return;
  }

  pendingAlbums.delete(key);
  clearTimeout(album.timer);

  const messages = [...album.messages].sort(
    (a, b) => a.message_id - b.message_id
  );

  // Nothing else would catch this, and one failure must not stop the queue
  albumQueue = albumQueue.then(() =>
    album.onComplete(messages).catch((error) => {
      logger.error("Album moderation failed", {
        error: error instanceof Error ? error.message : String(error),
        mediaGroupId: messages[0]?.media_group_id,
      });
    })
  );
};

/**
 * Moderates every buffered album now and waits for the queue. Used on
 * shutdown: album updates are confirmed to Telegram once buffered, so an
 * album that is not checked before exit is never checked
 * @example
 * await flushPendingAlbums();
 */
export const flushPendingAlbums = async (): Promise<void> => {
  [...pendingAlbums.keys()].forEach(flushAlbum);
  await albumQueue;
};

/**
 * Buffers an album item; onComplete gets every item of the album at once.
 * The handler of the first item is used for the whole album
 * @example
 * collectAlbumItem(message, (items) => moderatePost(ctx, items, false));
 */
export const collectAlbumItem = (
  message: Message,
  onComplete: (messages: Message[]) => Promise<void>
): void => {
  const key = `${message.chat.id}:${message.media_group_id}`;
  const pending = pendingAlbums.get(key);

  if (!pending) {
    pendingAlbums.set(key, {
      messages: [message],
      firstSeenAt: Date.now(),
      timer: setTimeout(() => flushAlbum(key), ALBUM_SETTLE_MS),
      onComplete,
    });
    return;
  }

  // Telegram redelivers updates after a restart or a timeout
  if (pending.messages.some((item) => item.message_id === message.message_id)) {
    return;
  }

  if (pending.messages.length < MAX_ALBUM_ITEMS) {
    pending.messages.push(message);
  }

  clearTimeout(pending.timer);

  const waited = Date.now() - pending.firstSeenAt;
  const delay = Math.max(0, Math.min(ALBUM_SETTLE_MS, ALBUM_MAX_WAIT_MS - waited));

  pending.timer = setTimeout(() => flushAlbum(key), delay);
};
