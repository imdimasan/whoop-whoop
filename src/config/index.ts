import dotenv from "dotenv";
import { resolve } from "path";
import { IConfig } from "../interfaces/i-config";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env") });

/**
 * Validates and returns application configuration
 * @example
 * const config = getConfig();
 * console.log(config.telegram.botToken);
 */
export const getConfig = (): IConfig => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const BOT_USERNAME = process.env.BOT_USERNAME;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN is required in environment variables");
  }

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in environment variables");
  }

  return {
    telegram: {
      botToken: BOT_TOKEN || "",
      botUsername: BOT_USERNAME || "",
    },
    openai: {
      apiKey: OPENAI_API_KEY,
    },
    moderation: {
      thresholds: {
        ban: parseFloat(process.env.BAN_THRESHOLD || "0.95"),
        mute: parseFloat(process.env.MUTE_THRESHOLD || "0.8"),
        delete: parseFloat(process.env.DELETE_THRESHOLD || "0.3"),
      },
    },
    logging: {
      level: process.env.LOG_LEVEL || "info",
    },
  };
};

export const config = getConfig();
