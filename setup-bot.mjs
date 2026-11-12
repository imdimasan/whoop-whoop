import { config } from "dotenv";
import fetch from "node-fetch";

// Load environment variables
config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;

if (!BOT_TOKEN || !BOT_USERNAME) {
  console.error("❌ ERROR: Please set BOT_TOKEN and BOT_USERNAME in .env file");
  console.log("Create .env file with:");
  console.log('BOT_TOKEN="your_bot_token_here"');
  console.log('BOT_USERNAME="@your_bot_username"');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Makes a POST request to Telegram Bot API
 */
const postToTelegram = async (endpoint, data) => {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      console.warn(`⚠️  ${endpoint} returned HTTP ${response.status}`);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`✅ ${endpoint} updated successfully`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${endpoint}:`, error.message);
  }
};

/**
 * Bot configurations for different languages
 */
const botConfigs = {
  ru: {
    name: "Whoop Whoop",
    shortDescription:
      "...that's the sound of da police 🚔. Модерация сообщений и изображений",
    description:
      "Whoop Whoop - модератор для чатов: проверка сообщений и изображений.\n\n Мои функции:\n• Проверка сообщений пользователей на соблюдение законодательства\n• Анализ изображений (OpenAI)\n• Система жалоб через команду /report\n• Автоматическое удаление/блокировка нарушителей\n",
    commands: [
      {
        command: "report",
        description: "Пожаловаться на сообщение (ответить на сообщение)",
      },
    ],
  },

  en: {
    name: "Whoop Whoop",
    shortDescription:
      "...that's the sound of da police 🚔. Message and image moderation",
    description:
      "Whoop Whoop - chat moderator: checking messages and images.\n\n My features:\n• Checking user messages for legal compliance\n• Image analysis (OpenAI)\n• Reporting system via /report command\n• Automatic deletion/blocking of violators\n",
    commands: [
      { command: "report", description: "Report a message (reply to message)" },
    ],
  },

  ka: {
    name: "Whoop Whoop",
    shortDescription:
      "...that's the sound of da police 🚔. შეტყობინებისა და სურათების მოდერაცია",
    description:
      "Whoop Whoop - ჩატის მოდერატორი: შეტყობინებისა და სურათების შემოწმება.\n\n ჩემი ფუნქციები:\n• მომხმარებლის შეტყობინებების კანონთან შესაბამისობის შემოწმება\n• სურათების ანალიზი (OpenAI)\n• საჩივრების სისტემა /report ბრძანებით\n• დამრღვევების ავტომატური წაშლა/დაბლოკვა\n",
    commands: [
      {
        command: "report",
        description: "შეტყობინებაზე საჩივარი (უპასუხეთ შეტყობინებას)",
      },
    ],
  },
};

/**
 * Setup bot for all supported languages
 */
const setupBot = async () => {
  console.log("🤖 Setting up Whoop Whoop Anti-Drug Moderation Bot...\n");

  for (const [locale, config] of Object.entries(botConfigs)) {
    console.log(`\n📋 Setting up ${locale.toUpperCase()} locale:`);

    // Set bot name
    await postToTelegram("setMyName", {
      name: config.name,
      language_code: locale,
    });

    // Set short description
    await postToTelegram("setMyShortDescription", {
      short_description: config.shortDescription,
      language_code: locale,
    });

    // Set full description
    await postToTelegram("setMyDescription", {
      description: config.description,
      language_code: locale,
    });

    // Set commands
    await postToTelegram("setMyCommands", {
      commands: config.commands,
      language_code: locale,
    });
  }

  console.log("\n✅ Bot setup completed!");
  console.log("\n📝 Next steps:");
  console.log("1. Add your bot to a group");
  console.log("2. Make it administrator with required permissions");
  console.log("3. Use /settings to configure group-specific options");
  console.log("4. Test with /start and /help commands");
  console.log("\n🔧 Manual BotFather setup (if needed):");
  console.log("• /setjoingroups → Enable");
  console.log("• /setprivacy → Disable");
  console.log("• /setcommands → Already set by this script");
};

// Run the setup
setupBot().catch(console.error);
