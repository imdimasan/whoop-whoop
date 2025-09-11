import { analyzeMessage } from "../services/openai.js";
import { logger } from "../utils/logger.js";
import { TModerationAction } from "../interfaces/i-moderation.js";
import { IBotContext } from "../interfaces/i-bot.js";
import {
  addReport,
  getGroupSettings,
  recordModerationAction,
} from "../services/database.js";
import {
  mutedUserMessage,
  bannedUserMessage,
  defaultReasons,
  ticketSaleWarningMessage,
  mildViolationWarning,
  communityBannedUserMessage,
} from "../config/messages.js";
import { processMessageForOCR } from "../helpers/ocr.js";

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
 * Handles incoming messages for moderation
 * @example
 * await handleMessage(ctx);
 */
export const handleMessage = async (ctx: IBotContext): Promise<void> => {
  try {
    // Check if message exists and is from a user
    const { message } = ctx;
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

    // Get message text
    const text = message?.text || message?.caption || "";

    // OCR path: single photo + no text
    if (!text) {
      const ocrText = await processMessageForOCR(ctx);

      if (ocrText && ocrText.length >= 3) {
        // Re-run moderation on OCR text under same user
        const moderationResult = await analyzeMessage(ocrText, from.id);

        logger.info("OCR message analyzed", {
          userId: from.id,
          chatId: ctx.chat?.id,
          shouldModerate: moderationResult.shouldModerate,
          action: moderationResult.suggestedAction,
        });

        if (moderationResult.shouldModerate) {
          await takeAction(
            ctx,
            moderationResult.suggestedAction,
            moderationResult.reason
          );
        }
      }

      return;
    }

    // Skip commands (messages starting with /) from moderation
    if (text.startsWith("/")) {
      logger.debug("Skipping command from moderation", {
        userId: from.id,
        command: text.split(" ")[0],
      });
      return;
    }

    // Skip very short messages (likely not harmful)
    if (text.trim().length < 3) {
      logger.debug("Skipping very short message from moderation", {
        userId: from.id,
        messageLength: text.trim().length,
      });

      return;
    }

    // Analyze message with OpenAI
    const moderationResult = await analyzeMessage(text, from.id);

    logger.info("Message analyzed", {
      userId: from.id,
      chatId: ctx.chat?.id,
      shouldModerate: moderationResult.shouldModerate,
      action: moderationResult.suggestedAction,
    });

    // Take action if needed
    if (moderationResult.shouldModerate) {
      // Apply cooldown to prevent rapid successive actions (except for group warnings)
      if (moderationResult.suggestedAction !== "warn_group") {
        const now = Date.now();
        const lastAction = lastModerationAction.get(from.id) || 0;
        const cooldownMs = 10000; // 10 seconds cooldown for punitive actions

        if (now - lastAction < cooldownMs) {
          logger.info("Skipping moderation due to cooldown", {
            userId: from.id,
            action: moderationResult.suggestedAction,
            timeSinceLastAction: now - lastAction,
            cooldownMs,
          });

          return;
        }

        // Update last action timestamp for punitive actions only
        lastModerationAction.set(from.id, now);
      }

      await takeAction(
        ctx,
        moderationResult.suggestedAction,
        moderationResult.reason
      );
    }
  } catch (error) {
    logger.error("Failed to handle message", {
      error,
      messageId: ctx.message?.message_id,
    });
  }
};

/**
 * Takes moderation action based on analysis
 * @example
 * await takeAction(ctx, 'delete', 'Spam detected');
 */
const takeAction = async (
  ctx: IBotContext,
  action: TModerationAction,
  reason?: string
): Promise<void> => {
  const { message } = ctx;
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  try {
    switch (action) {
      case "delete_message":
        await deleteMessage(ctx, reason);
        break;

      case "mute_user":
        await muteUser(ctx, reason);
        break;

      case "mute_user_keep_message":
        await muteUserKeepMessage(ctx, reason);
        break;

      case "ban_user":
        await banUser(ctx, reason);
        break;

      case "warn_group":
        await warnGroup(ctx, reason);
        break;

      default:
        logger.info("No action taken", { userId: from.id, action });
    }
  } catch (error) {
    logger.error("Failed to take action", { error, action, userId: from.id });
  }
};

/**
 * Deletes a message and shows warning (auto-deletes)
 * @example
 * await deleteMessage(ctx, 'Inappropriate content');
 */
const deleteMessage = async (
  ctx: IBotContext,
  reason?: string
): Promise<void> => {
  const { message } = ctx;
  const { from } = message || {};

  if (!message || !from) {
    return;
  }

  try {
    // Delete the message
    await ctx.deleteMessage();

    // Send mild warning message
    const warningMsg = mildViolationWarning(
      from.first_name,
      reason || defaultReasons.contentViolation
    );

    const reply = await ctx.reply(warningMsg, { parse_mode: "HTML" });

    // Auto-delete the warning message after 15 seconds
    await autoDeleteMessage(ctx, reply.message_id, 15000);

    // Record the moderation action in database
    if (ctx.chat?.id) {
      await recordModerationAction(
        ctx.chat.id,
        from.id,
        "delete",
        reason || defaultReasons.contentViolation,
        message.text || message.caption || null
      );
    }

    logger.info("Message deleted with warning", {
      userId: from.id,
      chatId: ctx.chat?.id,
      reason: reason || defaultReasons.contentViolation,
    });
  } catch (error) {
    logger.error("Failed to delete message", {
      error,
      messageId: message.message_id,
    });
  }
};

/**
 * Mutes a user temporarily
 * @example
 * await muteUser(ctx, 'Repeated violations');
 */
const muteUser = async (ctx: IBotContext, reason?: string): Promise<void> => {
  const { message } = ctx;
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  try {
    // Delete the message first
    await ctx.deleteMessage();

    // Get group-specific mute duration
    const groupSettings = await getGroupSettings(chat.id);
    const muteDurationMinutes = groupSettings.muteDurationMinutes || 60;

    // // Delete all user messages before muting
    // const deletionResult = await deleteAllUserMessages(
    //   ctx,
    //   from.id,
    //   `User muted: ${reason || defaultReasons.policyViolation}`
    // );

    // logger.info("Bulk deletion completed for muted user", {
    //   userId: from.id,
    //   chatId: chat.id,
    //   deleted: deletionResult.deleted,
    //   errors: deletionResult.errors,
    // });

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

    // Send notification
    const muteMsg = mutedUserMessage(
      from.first_name,
      muteDurationMinutes,
      reason || defaultReasons.policyViolation
    );

    const reply = await ctx.reply(muteMsg, { parse_mode: "HTML" });

    // Auto-delete the mute notification after 30 seconds
    await autoDeleteMessage(ctx, reply.message_id, 30000);

    // Record the moderation action in database
    await recordModerationAction(
      chat.id,
      from.id,
      "mute",
      reason || defaultReasons.policyViolation,
      message?.text || message?.caption || null,
      muteDurationMinutes
    );

    logger.info("User muted", {
      userId: from.id,
      chatId: chat.id,
      duration: muteDurationMinutes,
    });
  } catch (error) {
    logger.error("Failed to mute user", { error, userId: from.id });
  }
};

/**
 * Mutes a user temporarily and keeps the message
 * @example
 * await muteUserKeepMessage(ctx, 'Repeated violations');
 */
const muteUserKeepMessage = async (
  ctx: IBotContext,
  reason?: string
): Promise<void> => {
  const { message } = ctx;
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

    // Send notification
    const muteMsg = mutedUserMessage(
      from.first_name,
      muteDurationMinutes,
      reason || defaultReasons.policyViolation
    );

    const reply = await ctx.reply(muteMsg, { parse_mode: "HTML" });

    // Auto-delete the mute notification after 30 seconds
    await autoDeleteMessage(ctx, reply.message_id, 30000);

    // Record the moderation action in database
    await recordModerationAction(
      chat.id,
      from.id,
      "mute_user_keep_message",
      reason || defaultReasons.policyViolation,
      message?.text || message?.caption || null,
      muteDurationMinutes
    );

    logger.info("User muted and message kept", {
      userId: from.id,
      chatId: chat.id,
      duration: muteDurationMinutes,
    });
  } catch (error) {
    logger.error("Failed to mute user and keep message", {
      error,
      userId: from.id,
    });
  }
};

/**
 * Bans a user from the group
 * @example
 * await banUser(ctx, 'Severe violation');
 */
const banUser = async (ctx: IBotContext, reason?: string): Promise<void> => {
  const { message } = ctx;
  const { from, chat } = message || {};

  if (!from || !chat) {
    return;
  }

  try {
    // Delete the message first
    await ctx.deleteMessage();

    // // Delete all user messages before banning
    // const deletionResult = await deleteAllUserMessages(
    //   ctx,
    //   from.id,
    //   `User banned: ${reason || defaultReasons.severeViolation}`
    // );

    // logger.info("Bulk deletion completed for banned user", {
    //   userId: from.id,
    //   chatId: chat.id,
    //   deleted: deletionResult.deleted,
    //   errors: deletionResult.errors,
    // });

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
      message?.text || message?.caption || null,
      null
    );

    logger.info("User banned", { userId: from.id, chatId: chat.id, reason });
  } catch (error) {
    logger.error("Failed to ban user", { error, userId: from.id });
  }
};

/**
 * Sends a warning message to the group about ticket sales
 * @example
 * await warnGroup(ctx, 'Potential ticket fraud detected');
 */
const warnGroup = async (ctx: IBotContext, reason?: string): Promise<void> => {
  const { message } = ctx;
  const { from } = message || {};

  if (!from) {
    return;
  }

  try {
    // Send warning message to the group
    const warningMsg = ticketSaleWarningMessage(
      from.first_name || from.username || "User",
      reason || "Potential ticket sale detected"
    );

    await ctx.reply(warningMsg, { parse_mode: "HTML" });

    logger.info("Group warning sent", {
      userId: from.id,
      chatId: ctx.chat?.id,
      reason,
      type: "ticket_sale",
    });
  } catch (error) {
    logger.error("Failed to send group warning", { error, userId: from.id });
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

// /**
//  * Deletes all messages from a specific user in the chat
//  * @example
//  * await deleteAllUserMessages(ctx, userId, 'User was banned');
//  */
// const deleteAllUserMessages = async (
//   ctx: IBotContext,
//   userId: number,
//   reason: string
// ): Promise<{ deleted: number; errors: number }> => {
//   const { chat } = ctx;

//   if (!chat) {
//     return { deleted: 0, errors: 0 };
//   }

//   let deleted = 0;
//   let errors = 0;
//   let lastMessageId = 0;

//   try {
//     logger.info("Starting bulk message deletion", {
//       userId,
//       chatId: chat.id,
//       reason,
//     });

//     // Get recent messages (Telegram API limitation - can't get all history)
//     // We'll try to delete messages by iterating through recent message IDs
//     // This is a best-effort approach due to Telegram Bot API limitations

//     // Start from current message ID and work backwards
//     const currentMessage = ctx.message;
//     if (currentMessage) {
//       lastMessageId = currentMessage.message_id;
//     }

//     // Try to delete messages in batches, going backwards from current message
//     const batchSize = 100; // Process in batches to avoid overwhelming the API
//     const maxAttempts = 500; // Limit total attempts to prevent infinite loops

//     for (
//       let attempt = 0;
//       attempt < maxAttempts && lastMessageId > 0;
//       attempt++
//     ) {
//       const startId = Math.max(1, lastMessageId - batchSize);
//       const promises: Promise<void>[] = [];

//       // Create batch of deletion promises
//       for (let messageId = lastMessageId; messageId >= startId; messageId--) {
//         promises.push(
//           ctx.api
//             .deleteMessage(chat.id, messageId)
//             .then(() => {
//               deleted++;
//               logger.debug("Deleted message", { messageId, userId });
//             })
//             .catch((error) => {
//               errors++;
//               // Only log non-expected errors (message not found is expected)
//               if (
//                 !error.description?.includes("message to delete not found") &&
//                 !error.description?.includes("message can't be deleted")
//               ) {
//                 logger.debug("Failed to delete message", {
//                   messageId,
//                   userId,
//                   error: error.description,
//                 });
//               }
//             })
//         );
//       }

//       // Wait for current batch to complete
//       await Promise.allSettled(promises);

//       // Move to next batch
//       lastMessageId = startId - 1;

//       // Add small delay between batches to respect rate limits
//       if (attempt < maxAttempts - 1) {
//         await new Promise((resolve) => setTimeout(resolve, 100));
//       }
//     }

//     logger.info("Bulk message deletion completed", {
//       userId,
//       chatId: chat.id,
//       deleted,
//       errors,
//       reason,
//     });

//     return { deleted, errors };
//   } catch (error) {
//     logger.error("Failed during bulk message deletion", {
//       error,
//       userId,
//       chatId: chat.id,
//       deleted,
//       errors,
//     });

//     return { deleted, errors };
//   }
// };

// For backward compatibility, export the main functions as default
export default {
  handleMessage,
  handleReport,
};
