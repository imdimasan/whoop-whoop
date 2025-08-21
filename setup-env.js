import { writeFileSync, existsSync } from "fs";
import { createInterface } from "readline";

/**
 * Readline interface
 */
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Ask a question and return the answer
 */
const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

/**
 * Setup the bot environment
 */
const setup = async () => {
  console.log("🤖 Telegram Bot Setup\n");

  // Check if .env already exists
  if (existsSync(".env")) {
    const overwrite = await question(
      ".env file already exists. Overwrite? (y/n): "
    );
    if (overwrite.toLowerCase() !== "y") {
      console.log("Setup cancelled.");
      process.exit(0);
    }
  }

  console.log("\nPlease provide the following information:\n");

  // Get bot token
  const botToken = await question("Telegram Bot Token (from BotFather): ");

  // Get OpenAI API key
  const openaiKey = await question("OpenAI API Key: ");

  // Get bot username
  const botUsername =
    (await question("Bot Username (default: whoop_whoop_bot): ")) ||
    "whoop_whoop_bot";

  // Get moderation settings
  const maxWarnings =
    (await question("Max warnings before action (default: 3): ")) || "3";
  const muteDuration =
    (await question("Mute duration in minutes (default: 5): ")) || "5";

  console.log("\nAction thresholds (0.0-1.0, higher = stricter):");
  const banThreshold =
    (await question("Ban threshold (default: 0.95): ")) || "0.95";
  const muteThreshold =
    (await question("Mute threshold (default: 0.8): ")) || "0.8";
  const deleteThreshold =
    (await question("Delete/Warning threshold (default: 0.3): ")) || "0.3";

  // Create .env content
  const envContent = `# Telegram Bot Configuration
BOT_TOKEN=${botToken}

# OpenAI Configuration
OPENAI_API_KEY=${openaiKey}

# Bot Configuration
BOT_USERNAME=${botUsername}
LOG_LEVEL=info

# Moderation Settings
MAX_WARNINGS=${maxWarnings}
MUTE_DURATION_MINUTES=${muteDuration}

# Action Thresholds (0.0-1.0)
BAN_THRESHOLD=${banThreshold}
MUTE_THRESHOLD=${muteThreshold}
DELETE_THRESHOLD=${deleteThreshold}`;

  // Write .env file
  writeFileSync(".env", envContent);

  console.log("\n✅ Configuration saved to .env file");
  console.log("\n📝 Next steps:");
  console.log('1. Run "npm run dev" to start the bot in development mode');
  console.log("2. Add the bot to your Telegram group");
  console.log(
    "3. Make the bot an administrator with delete and restrict permissions"
  );
  console.log("4. The bot will automatically moderate messages in the group");

  rl.close();
};

setup().catch(console.error);
