import winston from "winston";
import { config } from "../config/index.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Color codes for different action types
 */
const ACTION_COLORS = {
  none: "\x1b[32m", // Green
  mute: "\x1b[33m", // Yellow
  ban: "\x1b[31m", // Red
  reset: "\x1b[0m", // Reset
};

/**
 * Formats action with color coding
 * @example
 * const coloredAction = formatAction('ban');
 */
const formatAction = (action: string): string => {
  const color =
    ACTION_COLORS[action as keyof typeof ACTION_COLORS] || ACTION_COLORS.reset;
  return `${color}${action}${ACTION_COLORS.reset}`;
};

/**
 * Custom log format with readable output
 * @example
 * logger.info('Analyzing message', { userId: 123, messagePreview: 'Hello', messageLength: 5 });
 */
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Handle specific log types with clean formatting
  if (metadata.userId && metadata.messagePreview && metadata.messageLength) {
    msg += ` (userId: ${metadata.userId}, preview: "${metadata.messagePreview}", length: ${metadata.messageLength})`;
    return msg;
  }

  if (metadata.contentType && typeof metadata.contentType === "string") {
    msg += ` -> ${metadata.contentType.toUpperCase()}`;
    return msg;
  }

  if (metadata.action && typeof metadata.action === "string") {
    const coloredAction = formatAction(metadata.action);
    msg += ` -> ${coloredAction}`;
    if (metadata.reason) {
      msg += ` (${metadata.reason})`;
    }
    return msg;
  }

  // For other metadata, use minimal formatting
  if (Object.keys(metadata).length > 0) {
    const cleanMeta = Object.entries(metadata)
      .filter(([, value]) => value !== null && value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    if (Object.keys(cleanMeta).length > 0) {
      msg += ` ${JSON.stringify(cleanMeta)}`;
    }
  }

  return msg;
});

/**
 * Creates and configures Winston logger instance
 * @example
 * logger.info('Processing message', { messageId: 456 });
 * logger.error('Failed to process', { error: err });
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});

export default logger;
