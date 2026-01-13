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
import { processMessageForOCR } from "../helpers/ocr.js";
import { hasDrugKeywordsSmart } from "../config/stems.js";

// Store last moderation action timestamps to prevent spam
const lastModerationAction: Map<number, number> = new Map();

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

    // Check if bot has admin rights
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

      return;
    }

    // Get message text (handle both Message.text and Message.caption)
    const text =
      ("text" in message ? message.text : undefined) ||
      ("caption" in message ? message.caption : undefined) ||
      "";

    // Skip commands (messages starting with /) from moderation
    if (text.startsWith("/")) {
      logger.debug("Skipping command from moderation", {
        userId: from.id,
        command: text.split(" ")[0],
      });
      return;
    }

    // OCR path: single photo + no text (only for new messages, not edits)
    if (!text && !isEdited) {
      const ocrText = await processMessageForOCR(ctx);

      if (ocrText && ocrText.length >= 3) {
        logger.info("OCR text extracted", {
          userId: from.id,
          messagePreview: ocrText.substring(0, 50),
          messageLength: ocrText.length,
        });

        // Check for drugs using stems first (fast path)
        if (hasDrugKeywordsSmart(ocrText.toLowerCase())) {
          logger.info("Message identified as", { contentType: "drugs" });
          logger.info("Message analysis result", {
            action: "ban",
            reason: "Обнаружен контент, связанный с наркотиками (OCR)",
          });

          await takeAction(
            ctx,
            message,
            "ban",
            "Обнаружен контент, связанный с наркотиками (OCR)"
          );
          return;
        }

        // Run full AI analysis for other content types
        const moderationResult = await analyzeMessage(ocrText, from.id);

        if (moderationResult.shouldModerate) {
          await takeAction(
            ctx,
            message,
            moderationResult.suggestedAction,
            moderationResult.reason
          );
        }
      }

      return;
    }

    // Skip very short messages (likely not harmful)
    if (text.trim().length < 3) {
      return;
    }

    // Log if this is an edited message being checked
    if (isEdited) {
      logger.info("Checking edited message for moderation", {
        userId: from.id,
        messageId: message.message_id,
        textPreview: text.substring(0, 50),
      });
    }

    // Run full AI analysis for other content types
    const moderationResult = await analyzeMessage(text, from.id);

    // Take action if needed
    if (moderationResult.shouldModerate) {
      // Apply cooldown to prevent rapid successive actions
      const now = Date.now();
      const lastAction = lastModerationAction.get(from.id) || 0;
      const cooldownMs = 10000; // 10 seconds cooldown

      if (now - lastAction < cooldownMs) {
        return;
      }

      // Update last action timestamp
      lastModerationAction.set(from.id, now);

      await takeAction(
        ctx,
        message,
        moderationResult.suggestedAction,
        moderationResult.reason
      );
    }
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
 * Takes moderation action based on analysis
 * @example
 * await takeAction(ctx, message, 'delete', 'Spam detected');
 */
const takeAction = async (
  ctx: IBotContext,
  message: Message,
  action: TModerationAction,
  reason?: string
): Promise<void> => {
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  try {
    switch (action) {
      case "mute":
        await muteUser(ctx, message, reason);
        break;

      case "ban":
        await banUser(ctx, message, reason);
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
  reason?: string
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

    // Get message text for logging
    const messageText =
      ("text" in message ? message.text : undefined) ||
      ("caption" in message ? message.caption : undefined) ||
      null;

    // Record the moderation action in database
    await recordModerationAction(
      chat.id,
      from.id,
      "mute",
      reason || defaultReasons.policyViolation,
      messageText,
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
 * Bans a user from the group and deletes the message
 * @example
 * await banUser(ctx, message, 'Severe violation');
 */
const banUser = async (
  ctx: IBotContext,
  message: Message,
  reason?: string
): Promise<void> => {
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  try {
    // Delete the message first (use message_id for both new and edited messages)
    await ctx.api.deleteMessage(chat.id, message.message_id);

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

    // Get message text for logging
    const messageText =
      ("text" in message ? message.text : undefined) ||
      ("caption" in message ? message.caption : undefined) ||
      null;

    // Record the moderation action in database
    await recordModerationAction(
      chat.id,
      from.id,
      "ban",
      reason || defaultReasons.severeViolation,
      messageText,
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
