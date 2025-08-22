import { analyzeMessage } from "../services/openai.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { TModerationAction } from "../interfaces/i-moderation.js";
import { IBotContext } from "../interfaces/i-bot.js";
import { IUserReport } from "../interfaces/i-user.js";
import {
  mutedUserMessage,
  bannedUserMessage,
  defaultReasons,
  ticketSaleWarningMessage,
  mildViolationWarning,
  communityBannedUserMessage,
} from "../config/messages.js";

// Store last moderation action timestamps to prevent spam
const lastModerationAction: Map<number, number> = new Map();

// Store user reports (targetUserId -> IUserReport)
const userReports: Map<number, IUserReport> = new Map();

// Report threshold - number of reports needed to ban a user
const REPORT_THRESHOLD = 1;

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

    if (!text) {
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

    // Calculate mute duration
    const untilDate =
      Math.floor(Date.now() / 1000) +
      config.moderation.muteDurationMinutes * 60;

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
      config.moderation.muteDurationMinutes,
      reason || defaultReasons.policyViolation
    );

    const reply = await ctx.reply(muteMsg, { parse_mode: "HTML" });

    // Auto-delete the mute notification after 30 seconds
    await autoDeleteMessage(ctx, reply.message_id, 30000);

    logger.info("User muted", {
      userId: from.id,
      chatId: chat.id,
      duration: config.moderation.muteDurationMinutes,
    });
  } catch (error) {
    logger.error("Failed to mute user", { error, userId: from.id });
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
 * Handles user report
 * @example
 * const result = await handleReport(ctx, targetUserId);
 */
export const handleReport = async (
  ctx: IBotContext,
  targetUserId: number
): Promise<{ success: boolean; message: string; shouldBan?: boolean }> => {
  const { from, chat } = ctx;

  if (!from || !chat) {
    return { success: false, message: "Ошибка: недостаточно данных" };
  }

  // Prevent self-reporting
  if (from.id === targetUserId) {
    return { success: false, message: "Нельзя пожаловаться на самого себя" };
  }

  const reportKey = targetUserId;
  const now = new Date();

  // Get or create report record
  let reportRecord = userReports.get(reportKey);

  if (!reportRecord) {
    reportRecord = {
      targetUserId,
      chatId: chat.id,
      reporterIds: new Set(),
      reportCount: 0,
      firstReport: now,
      lastReport: now,
    };
    userReports.set(reportKey, reportRecord);
  }

  // Check if user already reported this person
  if (reportRecord.reporterIds.has(from.id)) {
    return {
      success: false,
      message: "Вы уже пожаловались на этого пользователя",
    };
  }

  // Add report
  reportRecord.reporterIds.add(from.id);
  reportRecord.reportCount++;
  reportRecord.lastReport = now;

  logger.info("User reported", {
    reporterId: from.id,
    targetUserId,
    chatId: chat.id,
    reportCount: reportRecord.reportCount,
    threshold: REPORT_THRESHOLD,
  });

  // Check if threshold reached
  if (reportRecord.reportCount >= REPORT_THRESHOLD) {
    // Ban the user
    try {
      await ctx.banChatMember(targetUserId);

      // Send community ban message
      const banMsg = communityBannedUserMessage(
        `User ${targetUserId}` // We'll get the username from the context in the command handler
      );

      const reply = await ctx.reply(banMsg, { parse_mode: "HTML" });

      // Auto-delete after 30 seconds
      await autoDeleteMessage(ctx, reply.message_id, 30000);

      // Clear reports for this user
      userReports.delete(reportKey);

      logger.info("User banned by community reports", {
        targetUserId,
        chatId: chat.id,
        reportCount: reportRecord.reportCount,
      });

      return {
        success: true,
        message: `Пользователь заблокирован (${reportRecord.reportCount}/${REPORT_THRESHOLD} жалоб)`,
        shouldBan: true,
      };
    } catch (error) {
      logger.error("Failed to ban user by reports", { error, targetUserId });
      return { success: false, message: "Ошибка при блокировке пользователя" };
    }
  }

  return {
    success: true,
    message: `Жалоба принята (${reportRecord.reportCount}/${REPORT_THRESHOLD})`,
  };
};

// For backward compatibility, export the main functions as default
export default {
  handleMessage,
  handleReport,
};
