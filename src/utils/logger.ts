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
 * JSON replacer that keeps Error details: message, stack and cause are
 * non-enumerable, so a plain JSON.stringify logs most errors as "{}"
 * @example
 * JSON.stringify({ error: new Error("boom") }, serializeError);
 */
const serializeError = (_key: string, value: unknown): unknown => {
  if (!(value instanceof Error)) {
    return value;
  }

  return {
    name: value.name,
    message: value.message,
    // Own enumerable fields carry the useful bits (code/errno/syscall, error_code/description)
    ...Object.fromEntries(Object.entries(value)),
    ...(value.cause !== undefined && { cause: value.cause }),
    // Connection failures to dual-stack hosts are AggregateErrors with an empty message
    ...(value instanceof AggregateError && { errors: value.errors }),
    stack: value.stack,
  };
};

/**
 * Stringifies log metadata without ever throwing (e.g. on circular references)
 * @example
 * const text = stringifyMeta({ error: new Error("boom"), chatId: 1 });
 */
const stringifyMeta = (meta: Record<string, unknown>): string => {
  try {
    return JSON.stringify(meta, serializeError);
  } catch {
    return "[unserializable metadata]";
  }
};

// Secrets that must never reach a log line. grammY keeps the raw fetch error
// of a failed request, and its message is the request URL with the bot token
const SECRETS = [config.telegram.botToken, config.openai.apiKey].filter(
  Boolean
);

/**
 * Masks configured secrets in a log line
 * @example
 * redactSecrets("request to https://api.telegram.org/bot123:ABC/getMe failed");
 */
const redactSecrets = (line: string): string =>
  SECRETS.reduce((acc, secret) => acc.split(secret).join("<redacted>"), line);

/**
 * Builds a readable log line from a log entry
 * @example
 * formatLine({ level: 'info', message: 'Analyzing message', userId: 123, messagePreview: 'Hello', messageLength: 5 });
 */
const formatLine = ({
  level,
  message,
  timestamp,
  ...metadata
}: winston.Logform.TransformableInfo): string => {
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

  // An attached error must not be dropped by the compact action format
  if (
    metadata.action &&
    typeof metadata.action === "string" &&
    !metadata.error
  ) {
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
      msg += ` ${stringifyMeta(cleanMeta)}`;
    }
  }

  return msg;
};

/**
 * Custom log format with readable output and masked secrets
 * @example
 * logger.info('Analyzing message', { userId: 123, messagePreview: 'Hello', messageLength: 5 });
 */
const logFormat = printf((info) => redactSecrets(formatLine(info)));

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
      // Hosting platforms take the severity from the stream: errors written to
      // stdout show up as "info" and never match an error filter
      stderrLevels: ["error"],
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
