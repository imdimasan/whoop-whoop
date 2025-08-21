import winston from "winston";
import { config } from "../config/index.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 * @example
 * logger.info('Bot started', { userId: 123 });
 */
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
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
