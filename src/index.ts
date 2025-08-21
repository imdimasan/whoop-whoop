import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import {
  handleMessage,
  getWarningCount,
  clearWarnings,
} from "./handlers/moderation.js";
import { IBotContext } from "./interfaces/i-bot.js";
import {
  welcomePrivateMessage,
  welcomeGroupMessage,
  helpMessage,
  statsMessage,
  settingsMessage,
  userWarningsMessage,
  warningsClearedMessage,
  errorMessages,
} from "./config/messages.js";

/**
 * Initialize and start the bot
 * @example
 * startBot().catch(console.error);
 */
const startBot = async (): Promise<void> => {
  // Create bot instance
  const bot = new Bot<IBotContext>(config.telegram.botToken);

  // Register command handlers
  registerCommands(bot);

  // Register message handler for moderation
  bot.on("message", async (ctx) => {
    // Only process messages in groups and supergroups
    const { chat } = ctx;

    if (!chat) {
      return;
    }

    if (chat.type === "group" || chat.type === "supergroup") {
      await handleMessage(ctx);
    }
  });

  // Error handler
  bot.catch((err) => {
    const { ctx, error } = err;

    logger.error("Error in bot", {
      update: ctx.update,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof GrammyError) {
      logger.error("Grammy error:", error);
    } else if (error instanceof HttpError) {
      logger.error("Network error:", error);
    } else {
      logger.error("Unknown error:", error);
    }
  });

  // Start bot
  logger.info("Starting bot...");

  await bot.start({
    onStart: (botInfo) => {
      logger.info("Bot started successfully", {
        username: botInfo.username,
        id: botInfo.id,
      });
    },
  });
};

/**
 * Register bot commands
 * @example
 * registerCommands(bot);
 */
const registerCommands = (bot: Bot<IBotContext>): void => {
  // Start command
  bot.command("start", async (ctx) => {
    const { chat } = ctx;

    if (!chat) {
      return;
    }

    if (chat.type === "private") {
      const welcomeMsg = welcomePrivateMessage(config.telegram.botUsername);
      await ctx.reply(welcomeMsg, { parse_mode: "HTML" });
    } else {
      const groupMsg = welcomeGroupMessage(config.telegram.botUsername);
      await ctx.reply(groupMsg, { parse_mode: "HTML" });
    }
  });

  // Help command
  bot.command("help", async (ctx) => {
    const helpMsg = helpMessage(config.moderation.maxWarnings);
    await ctx.reply(helpMsg, { parse_mode: "HTML" });
  });

  // Stats command
  bot.command("stats", async (ctx) => {
    const { chat } = ctx;

    if (!chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply(errorMessages.privateOnly);
      return;
    }

    // Check bot permissions
    const botMember = await ctx.getChatMember(ctx.me.id);
    const canDelete =
      botMember.status === "administrator" && botMember.can_delete_messages;
    const canRestrict =
      botMember.status === "administrator" && botMember.can_restrict_members;

    const missingPerms = [];
    if (!canDelete) missingPerms.push("Delete messages");
    if (!canRestrict) missingPerms.push("Restrict members");

    const statsMsg = statsMessage(
      chat.title || "Unknown",
      canDelete,
      canRestrict,
      missingPerms
    );
    await ctx.reply(statsMsg, { parse_mode: "HTML" });
  });

  // Settings command (admin only)
  bot.command("settings", async (ctx) => {
    const { from, chat } = ctx;

    if (!from || !chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply(errorMessages.groupOnly);
      return;
    }

    // Check if user is admin
    const member = await ctx.getChatMember(from.id);
    const isAdmin =
      member.status === "administrator" || member.status === "creator";

    if (!isAdmin) {
      await ctx.reply(errorMessages.adminOnly);
      return;
    }

    const settingsMsg = settingsMessage(
      config.moderation.maxWarnings,
      config.moderation.muteDurationMinutes,
      Math.round(config.moderation.thresholds.ban * 100),
      Math.round(config.moderation.thresholds.mute * 100),
      Math.round(config.moderation.thresholds.delete * 100)
    );
    await ctx.reply(settingsMsg, { parse_mode: "HTML" });
  });

  // Warnings command
  bot.command("warnings", async (ctx) => {
    const { message, chat } = ctx;

    if (!message || !chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply(errorMessages.groupOnly);
      return;
    }

    // Get mentioned user or reply target
    const targetUser = message.reply_to_message?.from;

    if (!targetUser) {
      await ctx.reply(errorMessages.replyRequired);
      return;
    }

    const warningCount = getWarningCount(targetUser.id);
    const warningsMsg = userWarningsMessage(
      targetUser.first_name,
      warningCount,
      config.moderation.maxWarnings
    );
    await ctx.reply(warningsMsg, { parse_mode: "HTML" });
  });

  // Clear warnings command (admin only)
  bot.command("clearwarnings", async (ctx) => {
    const { from, message, chat } = ctx;

    if (!from || !message || !chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply(errorMessages.groupOnly);
      return;
    }

    // Check if user is admin
    const member = await ctx.getChatMember(from.id);
    const isAdmin =
      member.status === "administrator" || member.status === "creator";

    if (!isAdmin) {
      await ctx.reply(errorMessages.adminOnly);
      return;
    }

    // Get mentioned user or reply target
    const targetUser = message.reply_to_message?.from;

    if (!targetUser) {
      await ctx.reply(errorMessages.replyRequiredClear);
      return;
    }

    clearWarnings(targetUser.id);

    const clearedMsg = warningsClearedMessage(targetUser.first_name);
    await ctx.reply(clearedMsg, { parse_mode: "HTML" });
  });

  logger.info("Commands registered");
};

/**
 * Main entry point
 */
const main = async (): Promise<void> => {
  try {
    logger.info("Initializing bot...");
    await startBot();
  } catch (error) {
    logger.error("Failed to start bot", { error });
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start the bot
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
