import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { handleMessage, handleReport } from "./handlers/moderation.js";
import { getModerationStats } from "./services/database.js";
import { IBotContext } from "./interfaces/i-bot.js";
import { initializeTables } from "./services/database.js";
import {
  showSettingsMenu,
  handleSettingsCallback,
  handleSettingUpdate,
  handleSettingsBack,
} from "./handlers/settings.js";
import {
  welcomePrivateMessage,
  welcomeGroupMessage,
  helpMessage,
  statsMessage,
  errorMessages,
} from "./config/messages.js";

/**
 * Initialize and start the bot
 * @example
 * startBot().catch(console.error);
 */
const startBot = async (): Promise<void> => {
  const { botToken } = config?.telegram || {};

  if (!botToken) {
    throw new Error("BOT_TOKEN is required in environment variables");
  }
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
    const { botUsername } = config?.telegram || {};

    if (!chat || !botUsername) {
      return;
    }

    if (chat.type === "private") {
      const welcomeMsg = welcomePrivateMessage(botUsername);
      await ctx.reply(welcomeMsg, { parse_mode: "HTML" });
    } else {
      const groupMsg = welcomeGroupMessage(botUsername);
      await ctx.reply(groupMsg, { parse_mode: "HTML" });
    }
  });

  // Help command
  bot.command("help", async (ctx) => {
    const helpMsg = helpMessage();
    const reply = await ctx.reply(helpMsg, { parse_mode: "HTML" });

    // Auto-delete help message after 60 seconds
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat?.id || 0, reply.message_id);
      } catch (error) {
        // Ignore deletion errors
      }
    }, 60000);
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

    // Get moderation statistics from database
    const moderationStats = await getModerationStats(chat.id);

    const statsMsg = statsMessage(
      chat.title || "Unknown",
      canDelete,
      canRestrict,
      missingPerms,
      moderationStats
    );
    const reply = await ctx.reply(statsMsg, { parse_mode: "HTML" });

    // Auto-delete stats message after 45 seconds
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat?.id || 0, reply.message_id);
      } catch (error) {
        // Ignore deletion errors
      }
    }, 45000);
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

    await showSettingsMenu(ctx);
  });

  // Report command
  bot.command("report", async (ctx) => {
    const { from, message, chat } = ctx;

    if (!from || !message || !chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply(errorMessages.groupOnly);
      return;
    }

    // Get target message and user from reply
    const targetMessage = message.reply_to_message;
    const targetUser = targetMessage?.from;

    if (!targetMessage || !targetUser) {
      const errorMsg = await ctx.reply(
        "❌ Ответьте на сообщение пользователя, чтобы пожаловаться на него.",
        { parse_mode: "HTML" }
      );

      // Auto-delete error message after 10 seconds
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(chat.id, errorMsg.message_id);
        } catch (error) {
          // Ignore deletion errors
        }
      }, 10000);
      return;
    }

    // Skip bots
    if (targetUser.is_bot) {
      const errorMsg = await ctx.reply("❌ Нельзя пожаловаться на бота.", {
        parse_mode: "HTML",
      });

      // Auto-delete error message after 10 seconds
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(chat.id, errorMsg.message_id);
        } catch (error) {
          // Ignore deletion errors
        }
      }, 10000);
      return;
    }

    // Handle the report with message ID
    const result = await handleReport(
      ctx,
      targetUser.id,
      targetMessage.message_id
    );

    // Update ban message with actual username
    let responseMessage = result.message;
    if (result.shouldBan && result.success) {
      // Update the community ban message with proper username
      const banMsg = `${
        targetUser.username || targetUser.first_name
      } заблокирован на основании жалоб участников группы.`;
      responseMessage = banMsg;
    }

    const reply = await ctx.reply(
      result.success ? `✅ ${responseMessage}` : `❌ ${result.message}`,
      { parse_mode: "HTML" }
    );

    // Auto-delete response after 15 seconds (unless it's a ban message)
    if (!result.shouldBan) {
      setTimeout(async () => {
        try {
          await ctx.api.deleteMessage(chat.id, reply.message_id);
        } catch (error) {
          // Ignore deletion errors
        }
      }, 15000);
    }
  });

  // Handle callback queries for settings
  bot.on("callback_query", async (ctx) => {
    const { data } = ctx.callbackQuery || {};

    if (!data) {
      return;
    }

    // Back to settings (check this first before generic settings_)
    if (data === "settings_back") {
      await handleSettingsBack(ctx);
      return;
    }

    // Settings callbacks
    if (data.startsWith("settings_")) {
      await handleSettingsCallback(ctx);
      return;
    }

    // Mute duration callbacks
    if (data.startsWith("set_mute_")) {
      const minutes = parseInt(data.replace("set_mute_", ""));
      await handleSettingUpdate(ctx, "mute", minutes);
      return;
    }

    // Max reports callbacks
    if (data.startsWith("set_reports_")) {
      const reports = parseInt(data.replace("set_reports_", ""));
      await handleSettingUpdate(ctx, "reports", reports);
      return;
    }
  });

  logger.info("Commands registered");
};

/**
 * Main entry point
 */
const main = async (): Promise<void> => {
  try {
    logger.info("Initializing bot...");

    // Initialize database tables
    await initializeTables();

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
