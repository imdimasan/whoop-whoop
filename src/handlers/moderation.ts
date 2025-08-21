import { analyzeMessage } from "../services/openai.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { TModerationAction } from "../interfaces/i-moderation.js";
import { IUserWarning } from "../interfaces/i-user.js";
import { IBotContext } from "../interfaces/i-bot.js";

// Store warnings in memory (could be moved to database later)
const warnings: Map<number, IUserWarning> = new Map();

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

      default:
        logger.info("No action taken", { userId: from.id, action });
    }
  } catch (error) {
    logger.error("Failed to take action", { error, action, userId: from.id });
  }
};

/**
 * Deletes a message and warns the user
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

    // Track warning
    await addWarning(from.id, ctx.chat?.id || 0, reason || "Content violation");

    // Send warning message
    const warningCount = warnings.get(from.id)?.count || 1;
    const warningMessage = await ctx.reply(
      `⚠️ <b>Warning ${warningCount}/${config.moderation.maxWarnings}</b>\n` +
        `${from.first_name}, your message was deleted.\n` +
        `Reason: ${reason || "Content violation"}\n` +
        `Please follow the group rules.`,
      { parse_mode: "HTML" }
    );

    // Delete warning message after 10 seconds
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(
          ctx.chat?.id || 0,
          warningMessage.message_id
        );
      } catch (error) {
        logger.error("Failed to delete warning message", { error });
      }
    }, 10000);
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
    await ctx.reply(
      `🔇 <b>User Muted</b>\n` +
        `${from.first_name} has been muted for ${config.moderation.muteDurationMinutes} minutes.\n` +
        `Reason: ${reason || "Policy violation"}`,
      { parse_mode: "HTML" }
    );

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
    await ctx.reply(
      `🚫 <b>User Banned</b>\n` +
        `${from.first_name} has been permanently banned from this group.\n` +
        `Reason: ${reason || "Severe policy violation"}`,
      { parse_mode: "HTML" }
    );

    // Clear warnings
    warnings.delete(from.id);

    logger.info("User banned", { userId: from.id, chatId: chat.id, reason });
  } catch (error) {
    logger.error("Failed to ban user", { error, userId: from.id });
  }
};

/**
 * Adds a warning for a user
 * @example
 * await addWarning(123, 456, 'Spam');
 */
const addWarning = async (
  userId: number,
  chatId: number,
  reason: string
): Promise<void> => {
  const existing = warnings.get(userId);

  if (existing) {
    existing.count++;
    existing.lastWarning = new Date();
    existing.reasons.push(reason);

    // Check if max warnings reached
    if (existing.count >= config.moderation.maxWarnings) {
      // Reset warnings and escalate to mute
      warnings.delete(userId);
      logger.info("Max warnings reached, escalating", {
        userId,
        warnings: existing.count,
      });
    }
  } else {
    warnings.set(userId, {
      userId,
      chatId,
      count: 1,
      lastWarning: new Date(),
      reasons: [reason],
    });
  }
};

/**
 * Gets warning count for a user
 * @example
 * const count = getWarningCount(123);
 */
export const getWarningCount = (userId: number): number => {
  return warnings.get(userId)?.count || 0;
};

/**
 * Clears warnings for a user
 * @example
 * clearWarnings(123);
 */
export const clearWarnings = (userId: number): void => {
  warnings.delete(userId);
};

// For backward compatibility, export the main functions as default
export default {
  handleMessage,
  getWarningCount,
  clearWarnings,
};
