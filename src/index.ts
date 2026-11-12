import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import {
  handleMessage,
  handleEditedMessage,
  handleReport,
} from "./handlers/moderation.js";
import { getModerationStats } from "./services/database.js";
import { flushPendingAlbums } from "./helpers/media-group.js";
import { IBotContext } from "./interfaces/i-bot.js";
import {
  initializeTablesWithRetry,
  closeDatabase,
} from "./services/database.js";
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

// Upper bound for a graceful shutdown before the process exits anyway. The
// message being handled may wait up to 30 s for the AI classification plus a
// few Telegram and DB calls; Railway's draining time must be longer than this
const SHUTDOWN_TIMEOUT_MS = 35000;

// During a deploy the old instance still polls for a moment, and Telegram
// answers one of the two polls with 409 Conflict: wait it out, do not exit
const POLLING_CONFLICT_RETRIES = 10;
const POLLING_CONFLICT_DELAY_MS = 3000;

// Shutdown state shared by the signal handler and the first middleware
let stopRequested = false;
let handlingUpdate = false;
let stopPolling: (() => void) | undefined;

/**
 * Handles SIGINT/SIGTERM: stops polling right away between updates, or after
 * the update being handled is done
 * @example
 * process.once("SIGTERM", requestShutdown);
 */
const requestShutdown = (signal: NodeJS.Signals): void => {
  if (stopRequested) {
    return;
  }

  stopRequested = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Never hang on a stuck handler: its update is not confirmed yet, so
  // Telegram sends it again to the next instance
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out, exiting");
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  if (!handlingUpdate) {
    stopPolling?.();
  }
};

/**
 * Initialize and start the bot. Resolves only after polling was stopped by a
 * shutdown signal.
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

  // Resolves once polling has stopped and the offset is confirmed
  let stopped: Promise<void> | undefined;

  // bot.stop() confirms to Telegram every update up to the last one fetched
  // for handling, so it must only run when no update is half-handled
  stopPolling = () => {
    stopped ??= bot.stop().catch((error) => {
      logger.error("Failed to stop bot cleanly", { error });
    });
  };

  // Must stay the first middleware. After a shutdown signal the rest of the
  // already fetched batch is skipped: it stays unconfirmed and Telegram sends
  // it again to the next instance. The update being handled when the signal
  // arrives is finished first and only then confirmed
  bot.use(async (_ctx, next) => {
    if (stopRequested) {
      return;
    }

    handlingUpdate = true;

    try {
      await next();
    } finally {
      handlingUpdate = false;

      if (stopRequested) {
        stopPolling?.();
      }
    }
  });

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

  // Register edited message handler for moderation
  bot.on("edited_message", async (ctx) => {
    // Only process edited messages in groups and supergroups
    const { chat } = ctx;

    if (!chat) {
      return;
    }

    if (chat.type === "group" || chat.type === "supergroup") {
      await handleEditedMessage(ctx);
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

  // A signal arrived before polling started (e.g. during the database init)
  if (stopRequested) {
    return;
  }

  // Start bot
  logger.info("Starting bot...");

  for (let attempt = 1; ; attempt += 1) {
    try {
      await bot.start({
        onStart: (botInfo) => {
          logger.info("Bot started successfully", {
            username: botInfo.username,
            id: botInfo.id,
          });
        },
      });
      break;
    } catch (error) {
      // Shutting down anyway, the error does not matter any more
      if (stopRequested) {
        break;
      }

      const isConflict =
        error instanceof GrammyError && error.error_code === 409;

      if (!isConflict || attempt >= POLLING_CONFLICT_RETRIES) {
        throw error;
      }

      logger.warn("Another instance of the bot is polling, retrying", {
        attempt,
        retryInSeconds: POLLING_CONFLICT_DELAY_MS / 1000,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, POLLING_CONFLICT_DELAY_MS)
      );

      if (stopRequested) {
        break;
      }
    }
  }

  // Polling loop has ended: wait until the update offset is confirmed
  await stopped;
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

    // Delete messages callbacks
    if (data === "set_delete_true") {
      await handleSettingUpdate(ctx, "delete", true);
      return;
    }

    if (data === "set_delete_false") {
      await handleSettingUpdate(ctx, "delete", false);
      return;
    }
  });

  logger.info("Commands registered");
};

/**
 * Main entry point
 */
const main = async (): Promise<void> => {
  // Registered before anything slow: as PID 1 in a container a signal with no
  // listener is ignored, and the instance would go on to start polling
  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  try {
    logger.info("Initializing bot...");

    // Initialize database tables. If the database is down this keeps retrying
    // in background, so moderation still starts without it
    await initializeTablesWithRetry();

    // Resolves only after a shutdown signal stopped the polling loop
    await startBot();

    // Buffered albums were already confirmed to Telegram: check them now or
    // never (the shutdown timeout still bounds this)
    await flushPendingAlbums();

    await closeDatabase();
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Failed to start bot", { error });
    process.exit(1);
  }
};

// Start the bot
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
