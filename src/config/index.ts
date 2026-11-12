import dotenv from "dotenv";
import { resolve } from "path";
import { IConfig } from "../interfaces/i-config";
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_MODELS,
  TOpenAIModel,
  isOpenAIModel,
} from "./models";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env") });

/**
 * Reads OPENAI_MODEL, falling back to the default when it is not set
 * @example
 * const model = readOpenAIModel(); // "gpt-6.1-terra"
 */
const readOpenAIModel = (): TOpenAIModel => {
  const value = process.env.OPENAI_MODEL?.trim();

  if (!value) {
    return DEFAULT_OPENAI_MODEL;
  }

  // Fail at startup: silently running another model would change moderation
  if (!isOpenAIModel(value)) {
    throw new Error(
      `OPENAI_MODEL must be one of: ${OPENAI_MODELS.join(", ")} (got "${value}")`
    );
  }

  return value;
};

/**
 * Reads a numeric env variable within [min, max], or returns the fallback
 * @example
 * const limit = readNumber("IMAGE_ANALYSIS_DAILY_LIMIT", 500, 0, 100000);
 */
const readNumber = (
  name: string,
  fallback: number,
  min: number,
  max: number
): number => {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number from ${min} to ${max} (got "${raw}")`);
  }

  return value;
};

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
      model: readOpenAIModel(),
    },
    images: {
      // Normal traffic is about ten photos a day; the cap bounds the bill
      // during a photo raid. 0 turns image analysis off
      dailyLimit: readNumber("IMAGE_ANALYSIS_DAILY_LIMIT", 500, 0, 100000),
      // Image verdicts are newer and less calibrated than text ones, so a
      // weak one is logged instead of acted on
      minConfidence: readNumber("IMAGE_MIN_CONFIDENCE", 0.8, 0, 1),
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
