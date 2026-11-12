import { Message } from "grammy/types";
import { analyzeMessage } from "../services/openai.js";
import { logger } from "../utils/logger.js";
import { TModerationAction } from "../interfaces/i-actions.js";
import { IBotContext } from "../interfaces/i-bot.js";
import {
  addReport,
  getGroupSettings,
  recordModerationAction,
} from "../services/database.js";
import {
  bannedUserMessage,
  defaultReasons,
  ticketSaleWarningMessage,
  communityBannedUserMessage,
} from "../config/messages.js";
import {
  downloadImageAsDataUrl,
  getImageRef,
  IImageRef,
  isTooLarge,
  MAX_IMAGE_BYTES,
} from "../helpers/image-input.js";
import { needsImageAnalysis } from "../helpers/image-gate.js";
import {
  consumeImageBudget,
  remainingImageBudget,
} from "../helpers/image-budget.js";
import { collectAlbumItem } from "../helpers/media-group.js";

// Last action per `${chatId}:${userId}`: per chat, so acting on a spammer in
// one group does not shield the same post in another
const lastModerationAction: Map<string, number> = new Map();

// Images of one post held in memory and sent to OpenAI at most
const MAX_POST_IMAGE_BYTES = 20 * 1024 * 1024;

// Shown in moderation records for posts that had only a picture
const IMAGE_ONLY_CONTENT = "[изображение]";

// Note: User reports are now stored in PostgreSQL database

/**
 * Auto-deletes a bot message after specified delay
 * @example
 * await autoDeleteMessage(ctx, messageId, 30000); // Delete after 30 seconds
 */
const autoDeleteMessage = async (
  ctx: IBotContext,
  messageId: number,
  delayMs: number = 30000
): Promise<void> => {
  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat?.id || 0, messageId);
    } catch (error) {
      logger.debug("Failed to auto-delete message", { error, messageId });
    }
  }, delayMs);
};

/**
 * Returns the message text or the media caption, empty when there is none
 * @example
 * const text = getMessageText(message);
 */
const getMessageText = (message: Message): string =>
  message.text || message.caption || "";

/**
 * Checks that the bot is an admin that can delete or restrict in this chat
 * @example
 * if (!(await botCanModerate(ctx))) return;
 */
const botCanModerate = async (ctx: IBotContext): Promise<boolean> => {
  const botMember = await ctx.getChatMember(ctx.me.id);
  const canDelete =
    botMember.status === "administrator" && botMember.can_delete_messages;
  const canRestrict =
    botMember.status === "administrator" && botMember.can_restrict_members;

  if (!canDelete && !canRestrict) {
    logger.warn("Bot lacks necessary permissions", {
      chatId: ctx.chat?.id,
      canDelete,
      canRestrict,
    });
  }

  return canDelete || canRestrict;
};

/**
 * Downloads the post's images when the owner's rule asks for an image check
 * and the daily budget allows it; an empty list means "judge the text only"
 * @example
 * const images = await loadImagesToAnalyze(ctx, messages, caption, userId);
 */
const loadImagesToAnalyze = async (
  ctx: IBotContext,
  messages: Message[],
  caption: string,
  userId: number
): Promise<string[]> => {
  const refs = messages
    .map(getImageRef)
    .filter((ref): ref is IImageRef => ref !== null && !isTooLarge(ref));

  if (!refs.length || !needsImageAnalysis(messages, caption)) {
    return [];
  }

  // Oldest first, within the daily budget and the per-post byte limit; an
  // unknown size counts as the largest allowed file
  const selected: IImageRef[] = [];
  let postBytes = 0;

  for (const ref of refs.slice(0, remainingImageBudget(userId))) {
    const size = ref.fileSize ?? MAX_IMAGE_BYTES;

    if (postBytes + size > MAX_POST_IMAGE_BYTES) {
      break;
    }

    postBytes += size;
    selected.push(ref);
  }

  const downloaded = await Promise.all(
    selected.map((ref) => downloadImageAsDataUrl(ctx.api, ref))
  );
  const images = downloaded.filter((image): image is string => image !== null);

  consumeImageBudget(userId, images.length);

  return images;
};

/**
 * Moderates one post: a single message or all items of an album at once
 * @example
 * await moderatePost(ctx, [message], false);
 */
const moderatePost = async (
  ctx: IBotContext,
  messages: Message[],
  isEdited: boolean
): Promise<void> => {
  const [first] = messages;
  const from = first?.from;

  if (!first || !from) {
    return;
  }

  if (!(await botCanModerate(ctx))) {
    return;
  }

  // Any album item may carry its own caption: judge them all together
  const caption = [...new Set(messages.map(getMessageText).filter(Boolean))].join(
    "\n"
  );
  const images = await loadImagesToAnalyze(ctx, messages, caption, from.id);

  // Without an image to look at, very short texts are not worth a check
  if (!images.length && caption.trim().length < 3) {
    return;
  }

  // Log if this is an edited message being checked
  if (isEdited) {
    logger.info("Checking edited message for moderation", {
      userId: from.id,
      messageId: first.message_id,
      textPreview: caption.substring(0, 50),
    });
  }

  const moderationResult = await analyzeMessage({
    text: caption,
    images,
    userId: from.id,
  });

  if (!moderationResult.shouldModerate) {
    return;
  }

  // Apply cooldown to prevent rapid successive actions
  const cooldownKey = `${first.chat.id}:${from.id}`;
  const now = Date.now();
  const lastAction = lastModerationAction.get(cooldownKey) || 0;
  const cooldownMs = 10000; // 10 seconds cooldown

  if (now - lastAction < cooldownMs) {
    // The sender was just acted on here. A ban does not remove posts that
    // were already queued, so delete this one too; skip the second ban,
    // notice and record
    if (moderationResult.suggestedAction === "ban") {
      await Promise.all(
        messages.map((message) =>
          ctx.api
            .deleteMessage(first.chat.id, message.message_id)
            .catch(() => undefined)
        )
      );
    }

    logger.info("Repeat verdict within cooldown", {
      userId: from.id,
      chatId: first.chat.id,
      action: moderationResult.suggestedAction,
    });
    return;
  }

  // Update last action timestamp
  lastModerationAction.set(cooldownKey, now);

  await takeAction(ctx, first, moderationResult.suggestedAction, moderationResult.reason, {
    extraMessageIds: messages.slice(1).map((message) => message.message_id),
    recordedContent: caption || (images.length ? IMAGE_ONLY_CONTENT : null),
  });
};

/**
 * Processes a message (new or edited) for moderation
 * @example
 * await processMessageForModeration(ctx, message, false);
 */
const processMessageForModeration = async (
  ctx: IBotContext,
  message: Message,
  isEdited: boolean = false
): Promise<void> => {
  try {
    const { from } = message || {};

    if (!message || !from) {
      return;
    }

    // Skip messages from bots
    if (from.is_bot) {
      return;
    }

    // Skip real bot commands only. Captions are never commands (grammY reads
    // commands from message.entities), and "/Продам…" gets no bot_command
    // entity, so a leading "/" can't switch moderation off
    const isCommand = Boolean(
      message.entities?.some(
        (entity) => entity.type === "bot_command" && entity.offset === 0
      )
    );

    if (isCommand) {
      logger.debug("Skipping command from moderation", {
        userId: from.id,
        command: (message.text ?? "").split(" ")[0],
      });
      return;
    }

    // Album items arrive as separate updates and are judged together; an
    // edited album item is checked on its own
    if (message.media_group_id && !isEdited) {
      collectAlbumItem(message, (items) => moderatePost(ctx, items, false));
      return;
    }

    await moderatePost(ctx, [message], isEdited);
  } catch (error) {
    logger.error("Failed to handle message", {
      error,
      messageId: message?.message_id,
      isEdited,
    });
  }
};

/**
 * Handles incoming new messages for moderation
 * @example
 * await handleMessage(ctx);
 */
export const handleMessage = async (ctx: IBotContext): Promise<void> => {
  const { message } = ctx;

  if (!message) {
    return;
  }

  await processMessageForModeration(ctx, message, false);
};

/**
 * Handles edited messages for moderation
 * @example
 * await handleEditedMessage(ctx);
 */
export const handleEditedMessage = async (ctx: IBotContext): Promise<void> => {
  const { editedMessage } = ctx;

  if (!editedMessage) {
    return;
  }

  await processMessageForModeration(ctx, editedMessage, true);
};

/**
 * What else an action needs to know about the post
 */
interface IActionOptions {
  /** Other messages of the same album, deleted together on a ban */
  extraMessageIds?: number[];
  /** Text kept in the moderation record (all captions, or an image marker) */
  recordedContent?: string | null;
}

/**
 * Takes moderation action based on analysis
 * @example
 * await takeAction(ctx, message, 'ban', 'Spam detected', { extraMessageIds: [id] });
 */
const takeAction = async (
  ctx: IBotContext,
  message: Message,
  action: TModerationAction,
  reason?: string,
  options: IActionOptions = {}
): Promise<void> => {
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  // Defaults to the message's own text for callers without a post context
  const recordedContent =
    options.recordedContent !== undefined
      ? options.recordedContent
      : getMessageText(message) || null;

  try {
    switch (action) {
      case "mute":
        await muteUser(ctx, message, reason, recordedContent);
        break;

      case "ban":
        await banUser(
          ctx,
          message,
          reason,
          recordedContent,
          options.extraMessageIds ?? []
        );
        break;

      default:
        logger.info("No action taken", { userId: from.id, action });
    }
  } catch (error) {
    logger.error("Failed to take action", { error, action, userId: from.id });
  }
};

/**
 * Mutes a user temporarily and keeps the message
 * @example
 * await muteUser(ctx, message, 'Ticket sale detected');
 */
const muteUser = async (
  ctx: IBotContext,
  message: Message,
  reason: string | undefined,
  recordedContent: string | null
): Promise<void> => {
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  try {
    // Get group-specific mute duration
    const groupSettings = await getGroupSettings(chat.id);
    const muteDurationMinutes = groupSettings.muteDurationMinutes || 60;

    // Calculate mute duration
    const untilDate = Math.floor(Date.now() / 1000) + muteDurationMinutes * 60;

    // Restrict user
    await ctx.restrictChatMember(
      from.id,
      {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
      },
      {
        until_date: untilDate,
      }
    );

    // Send ticket sale warning message
    const warningMsg = ticketSaleWarningMessage(
      from.first_name || from.username || "User",
      reason || "Potential ticket sale detected"
    );

    // For autodelete make this const = reply then use autodelete below
    await ctx.reply(warningMsg, { parse_mode: "HTML" });

    // // Auto-delete the warning message after 60 seconds
    // await autoDeleteMessage(ctx, reply.message_id, 60000);

    // Record the moderation action in database
    await recordModerationAction(
      chat.id,
      from.id,
      "mute",
      reason || defaultReasons.policyViolation,
      recordedContent,
      muteDurationMinutes
    );

    logger.info("User muted, message kept", {
      userId: from.id,
      chatId: chat.id,
      duration: muteDurationMinutes,
    });
  } catch (error) {
    logger.error("Failed to mute user", {
      error,
      userId: from.id,
    });
  }
};

/**
 * Bans a user from the group and deletes the message (and the rest of its album)
 * @example
 * await banUser(ctx, message, 'Severe violation');
 */
const banUser = async (
  ctx: IBotContext,
  message: Message,
  reason: string | undefined,
  recordedContent: string | null,
  extraMessageIds: number[]
): Promise<void> => {
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  try {
    // Delete first (message_id works for new and edited messages). A message
    // that is already gone (author deleted it, or the update was replayed
    // after downtime) must not save the sender from the ban
    const messageIds = [message.message_id, ...extraMessageIds];

    await Promise.all(
      messageIds.map((messageId) =>
        ctx.api.deleteMessage(chat.id, messageId).catch((error) => {
          logger.warn("Could not delete moderated message", {
            messageId,
            error: error instanceof Error ? error.message : String(error),
          });
        })
      )
    );

    // Ban user
    await ctx.banChatMember(from.id);

    // Send notification
    const banMsg = bannedUserMessage(
      from.username || from.first_name,
      reason || defaultReasons.severeViolation
    );

    const reply = await ctx.reply(banMsg, { parse_mode: "HTML" });

    // Auto-delete the ban notification after 30 seconds
    await autoDeleteMessage(ctx, reply.message_id, 30000);

    // Record the moderation action in database
    await recordModerationAction(
      chat.id,
      from.id,
      "ban",
      reason || defaultReasons.severeViolation,
      recordedContent,
      null
    );

    logger.info("User banned and message deleted", {
      userId: from.id,
      chatId: chat.id,
      reason: reason || defaultReasons.severeViolation,
    });
  } catch (error) {
    logger.error("Failed to ban user", { error, userId: from.id });
  }
};

/**
 * Handles user report for a specific message
 * @example
 * const result = await handleReport(ctx, targetUserId, messageId);
 */
export const handleReport = async (
  ctx: IBotContext,
  targetUserId: number,
  targetMessageId: number
): Promise<{ success: boolean; message: string; shouldBan?: boolean }> => {
  const { from, chat } = ctx;

  if (!from || !chat) {
    return { success: false, message: "Ошибка: недостаточно данных" };
  }

  // Prevent self-reporting
  if (from.id === targetUserId) {
    return { success: false, message: "Нельзя пожаловаться на самого себя" };
  }

  // Get group-specific settings (with fallback to default)
  const groupSettings = await getGroupSettings(chat.id);
  const maxReports = groupSettings.maxReports || 10;

  // Add report to database
  const result = await addReport(
    targetMessageId,
    chat.id,
    targetUserId,
    from.id
  );

  if (!result.success) {
    return { success: false, message: "Ошибка базы данных" };
  }

  if (result.alreadyReported) {
    return { success: false, message: "Вы уже пожаловались на это сообщение" };
  }

  logger.info("Message reported", {
    reporterId: from.id,
    targetUserId,
    targetMessageId,
    chatId: chat.id,
    reportCount: result.reportCount,
    threshold: maxReports,
  });

  // Check if threshold reached
  if (result.reportCount >= maxReports) {
    // Ban the user
    try {
      // Check if we should delete reported messages (configurable)
      const groupSettings = await getGroupSettings(chat.id);
      const shouldDeleteMessages =
        groupSettings.deleteReportedMessages !== false; // Default true

      if (shouldDeleteMessages) {
        // Try to delete the reported message
        try {
          await ctx.api.deleteMessage(chat.id, targetMessageId);
          logger.info("Deleted reported message", {
            targetMessageId,
            chatId: chat.id,
          });
        } catch (deleteError) {
          logger.warn("Could not delete reported message", {
            error: deleteError,
            targetMessageId,
            chatId: chat.id,
          });
          // Continue with ban even if message deletion fails
        }
      } else {
        logger.info("Skipping message deletion (disabled in settings)", {
          targetMessageId,
          chatId: chat.id,
        });
      }

      // Ban the user
      await ctx.banChatMember(targetUserId);

      // Send community ban message
      const banMsg = communityBannedUserMessage(`User ${targetUserId}`);

      const reply = await ctx.reply(banMsg, { parse_mode: "HTML" });

      // Auto-delete after 30 seconds
      await autoDeleteMessage(ctx, reply.message_id, 30000);

      // Record the moderation action in database
      await recordModerationAction(
        chat.id,
        targetUserId,
        "ban",
        "Заблокирован по жалобам участников группы",
        null,
        null,
        "community_reports"
      );

      logger.info("User banned by community reports", {
        targetUserId,
        targetMessageId,
        chatId: chat.id,
        reportCount: result.reportCount,
      });

      return {
        success: true,
        message: `Пользователь заблокирован (${result.reportCount}/${maxReports} жалоб)`,
        shouldBan: true,
      };
    } catch (error) {
      logger.error("Failed to ban user by reports", { error, targetUserId });
      return { success: false, message: "Ошибка при блокировке пользователя" };
    }
  }

  return {
    success: true,
    message: `Жалоба принята (${result.reportCount}/${maxReports})`,
  };
};

export default {
  handleMessage,
  handleEditedMessage,
  handleReport,
};
