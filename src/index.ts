import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import {
  handleMessage,
  getWarningCount,
  clearWarnings,
} from "./handlers/moderation.js";
import { IBotContext } from "./interfaces/i-bot.js";

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
      await ctx.reply(
        `👋 <b>Welcome to ${config.telegram.botUsername}!</b>\n\n` +
          `I'm an AI-powered moderation bot that helps keep Telegram groups safe and friendly.\n\n` +
          `<b>Features:</b>\n` +
          `• AI-powered content moderation\n` +
          `• Automatic spam detection\n` +
          `• Inappropriate content filtering\n` +
          `• Warning system for violations\n` +
          `• Temporary muting and banning\n\n` +
          `<b>How to use:</b>\n` +
          `1. Add me to your group\n` +
          `2. Make me an administrator with delete and restrict permissions\n` +
          `3. I'll automatically moderate messages\n\n` +
          `Use /help for more information.`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        `✅ <b>${config.telegram.botUsername} is active!</b>\n` +
          `I'll moderate messages in this group automatically.\n` +
          `Make sure I have admin permissions to delete messages and restrict users.`,
        { parse_mode: "HTML" }
      );
    }
  });

  // Help command
  bot.command("help", async (ctx) => {
    await ctx.reply(
      `📚 <b>Bot Commands:</b>\n\n` +
        `/start - Initialize the bot\n` +
        `/help - Show this help message\n` +
        `/stats - View moderation statistics\n` +
        `/settings - Configure bot settings (admin only)\n` +
        `/warnings @user - Check user warnings\n` +
        `/clearwarnings @user - Clear user warnings (admin only)\n\n` +
        `<b>Admin Requirements:</b>\n` +
        `• Delete messages permission\n` +
        `• Restrict members permission\n\n` +
        `<b>Moderation Actions:</b>\n` +
        `• <b>Warning:</b> After content violation\n` +
        `• <b>Mute:</b> After ${config.moderation.maxWarnings} warnings or medium severity\n` +
        `• <b>Ban:</b> For severe violations\n\n` +
        `The bot uses OpenAI to analyze messages for spam, inappropriate content, and policy violations.`,
      { parse_mode: "HTML" }
    );
  });

  // Stats command
  bot.command("stats", async (ctx) => {
    const { chat } = ctx;

    if (!chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply("📊 This command only works in groups.");
      return;
    }

    // Check bot permissions
    const botMember = await ctx.getChatMember(ctx.me.id);
    const canDelete =
      botMember.status === "administrator" && botMember.can_delete_messages;
    const canRestrict =
      botMember.status === "administrator" && botMember.can_restrict_members;

    const permissionStatus =
      canDelete && canRestrict
        ? "✅ Properly configured"
        : "❌ Missing permissions";
    const missingPerms = [];
    if (!canDelete) missingPerms.push("Delete messages");
    if (!canRestrict) missingPerms.push("Restrict members");

    await ctx.reply(
      `📊 <b>Moderation Statistics</b>\n\n` +
        `Group: ${chat.title || "Unknown"}\n` +
        `Bot Status: ${permissionStatus}\n` +
        `OpenAI: ✅ Connected\n\n` +
        `<b>Permissions:</b>\n` +
        `Delete messages: ${canDelete ? "✅" : "❌"}\n` +
        `Restrict members: ${canRestrict ? "✅" : "❌"}\n` +
        (missingPerms.length > 0
          ? `\n⚠️ Missing: ${missingPerms.join(", ")}`
          : "") +
        `\n\n<i>Detailed statistics coming soon...</i>`,
      { parse_mode: "HTML" }
    );
  });

  // Settings command (admin only)
  bot.command("settings", async (ctx) => {
    const { from, chat } = ctx;

    if (!from || !chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply("⚙️ This command only works in groups.");
      return;
    }

    // Check if user is admin
    const member = await ctx.getChatMember(from.id);
    const isAdmin =
      member.status === "administrator" || member.status === "creator";

    if (!isAdmin) {
      await ctx.reply("❌ Only administrators can use this command.");
      return;
    }

    await ctx.reply(
      `⚙️ <b>Bot Settings</b>\n\n` +
        `<b>Warning System:</b>\n` +
        `Max Warnings: ${config.moderation.maxWarnings}\n` +
        `Mute Duration: ${config.moderation.muteDurationMinutes} minutes\n\n` +
        `<b>Action Thresholds:</b>\n` +
        `Ban: ${(config.moderation.thresholds.ban * 100).toFixed(
          0
        )}% confidence\n` +
        `Mute: ${(config.moderation.thresholds.mute * 100).toFixed(
          0
        )}% confidence\n` +
        `Delete/Warn: ${(config.moderation.thresholds.delete * 100).toFixed(
          0
        )}% confidence\n\n` +
        `<i>Lower thresholds = more warnings, higher = stricter</i>`,
      { parse_mode: "HTML" }
    );
  });

  // Warnings command
  bot.command("warnings", async (ctx) => {
    const { message, chat } = ctx;

    if (!message || !chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply("This command only works in groups.");
      return;
    }

    // Get mentioned user or reply target
    const targetUser = message.reply_to_message?.from;

    if (!targetUser) {
      await ctx.reply(
        "Please reply to a user's message to check their warnings."
      );
      return;
    }

    const warningCount = getWarningCount(targetUser.id);

    await ctx.reply(
      `⚠️ <b>User Warnings</b>\n\n` +
        `User: ${targetUser.first_name}\n` +
        `Warnings: ${warningCount}/${config.moderation.maxWarnings}`,
      { parse_mode: "HTML" }
    );
  });

  // Clear warnings command (admin only)
  bot.command("clearwarnings", async (ctx) => {
    const { from, message, chat } = ctx;

    if (!from || !message || !chat) {
      return;
    }

    if (chat.type === "private") {
      await ctx.reply("This command only works in groups.");
      return;
    }

    // Check if user is admin
    const member = await ctx.getChatMember(from.id);
    const isAdmin =
      member.status === "administrator" || member.status === "creator";

    if (!isAdmin) {
      await ctx.reply("❌ Only administrators can use this command.");
      return;
    }

    // Get mentioned user or reply target
    const targetUser = message.reply_to_message?.from;

    if (!targetUser) {
      await ctx.reply(
        "Please reply to a user's message to clear their warnings."
      );
      return;
    }

    clearWarnings(targetUser.id);

    await ctx.reply(`✅ Warnings cleared for ${targetUser.first_name}`, {
      parse_mode: "HTML",
    });
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
