import { Message } from "grammy/types";

// A caption with fewer letters/digits than this counts as no text: otherwise
// an emoji or "." under a spam picture would switch the image check off
const MIN_TEXT_CHARS = 10;

// Entities that point somewhere: links, hidden links, @usernames
const LINK_ENTITY_TYPES = new Set(["url", "text_link", "mention", "text_mention"]);

// Telegram turns most links into entities; this catches what it misses,
// such as spaced-out "t . me / name"
const LINK_PATTERN = /(?:\bt|telegram)\s*\.\s*me\s*\/|https?:\/\/|\bwww\./i;

/**
 * Whether the text carries real content rather than emoji or punctuation
 * @example
 * hasMeaningfulText("🔥🔥🔥"); // false
 */
export const hasMeaningfulText = (text: string): boolean =>
  (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= MIN_TEXT_CHARS;

/**
 * Whether any message of the post links or redirects somewhere
 * @example
 * hasLink([message], "Пиши 👉 t.me/m/abc"); // true
 */
export const hasLink = (messages: Message[], text: string): boolean => {
  const linked = messages.some((message) => {
    const entities = [
      ...(message.entities ?? []),
      ...(message.caption_entities ?? []),
    ];

    if (entities.some((entity) => LINK_ENTITY_TYPES.has(entity.type))) {
      return true;
    }

    // URL buttons come with posts sent via inline bots or forwarded from channels
    const buttons = message.reply_markup?.inline_keyboard.flat() ?? [];

    return buttons.some((button) => "url" in button && Boolean(button.url));
  });

  return linked || LINK_PATTERN.test(text);
};

/**
 * The owner's rule for posts with images: look at the picture when there is
 * no real text, or when the text carries a link; otherwise the text is enough
 * @example
 * needsImageAnalysis([photoMessage], ""); // true
 */
export const needsImageAnalysis = (messages: Message[], text: string): boolean =>
  !hasMeaningfulText(text) || hasLink(messages, text);
