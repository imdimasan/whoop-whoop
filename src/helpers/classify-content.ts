import { createHmac } from "crypto";
import OpenAI, { BadRequestError } from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
} from "openai/resources/chat/completions";
import type { ResponseFormatJSONSchema } from "openai/resources/shared";
import logger from "../utils/logger";
import { config } from "../config/index.js";
import {
  CONTENT_CLASSIFICATION_PROMPT,
  IMAGE_POSTS_PROMPT,
} from "../config/prompts/index.js";
import { CONTENT_TYPES, TContentType } from "../interfaces/i-content";

// Updates are handled one by one, so a slow classification stalls moderation
// in every group. The SDK timeout (default: 10 minutes) limits one attempt
// until the response headers arrive; the deadline limits the whole call,
// including retries, the wait between them and a stalled response body
const ATTEMPT_TIMEOUT_MS = 15000;
const CLASSIFICATION_DEADLINE_MS = 30000;

// The verdict is about 60 tokens and effort "none" generates no reasoning;
// the headroom covers a long explanation without paying for runaway output
const MAX_COMPLETION_TOKENS = 500;

// Report a streak of failed classifications every N messages: a streak means
// messages are not being moderated at all (expired key, quota, outage)
const FAILURE_STREAK_REPORT_EVERY = 20;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  timeout: ATTEMPT_TIMEOUT_MS,
});

// The rules are the same for every call. On GPT-5.6+ the default (implicit)
// cache breakpoint sits after the changing user message, so the prompt would
// be written to cache on every call and never read back; an explicit
// breakpoint right after the rules makes them a reusable cached prefix
const RULES_PART: ChatCompletionContentPartText = {
  type: "text",
  text: CONTENT_CLASSIFICATION_PROMPT,
  prompt_cache_breakpoint: { mode: "explicit" },
};

const IMAGE_RULES_PART: ChatCompletionContentPartText = {
  type: "text",
  text: IMAGE_POSTS_PROMPT,
};

// Strict mode makes the model emit exactly this shape, keys in this order,
// with a known category
const VERDICT_FORMAT: ResponseFormatJSONSchema = {
  type: "json_schema",
  json_schema: {
    name: "moderation_verdict",
    strict: true,
    schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: [...CONTENT_TYPES] },
        confidence: { type: "number" },
        reasoning: { type: "string" },
      },
      required: ["category", "confidence", "reasoning"],
      additionalProperties: false,
    },
  },
};

let failedInRow = 0;

/**
 * Why a classification has no verdict: "rejected" means OpenAI refused or
 * could not read this input (it may work without the images); "unavailable"
 * means the service itself failed (timeout, outage, quota)
 */
export type TClassificationFailure = "rejected" | "unavailable";

/**
 * What the classifier looks at
 */
export interface IClassificationInput {
  /** Message text or photo caption; empty when there is none */
  text: string;
  /** Images as data URLs, present for photo posts */
  images?: string[];
  /** Telegram user id; OpenAI only receives a keyed hash of it */
  userId: number;
}

/**
 * Content classification result interface
 */
export interface IClassificationResult {
  category: TContentType;
  confidence: number;
  reasoning: string;
  /** Set when there is no verdict and "default" is only the fail-open answer */
  failed?: TClassificationFailure;
}

/**
 * Counts a classification that produced no verdict and reports the streak
 * @example
 * recordFailure();
 */
const recordFailure = (): void => {
  failedInRow += 1;

  if (failedInRow % FAILURE_STREAK_REPORT_EVERY === 0) {
    logger.error(
      "AI classification keeps failing: messages are NOT being moderated",
      { failedInRow }
    );
  }
};

/**
 * Ends a failure streak once a verdict was parsed
 * @example
 * recordSuccess();
 */
const recordSuccess = (): void => {
  if (failedInRow >= FAILURE_STREAK_REPORT_EVERY) {
    logger.info("AI classification is working again", {
      unmoderatedMessages: failedInRow,
    });
  }

  failedInRow = 0;
};

/**
 * Fail open: without an AI verdict the message is left alone. Keyword
 * matching is too imprecise to punish on its own ("работа" is inside
 * "не работает", "кет" inside "маркета") and has banned regular sellers
 * @example
 * return unmoderated("Классификация недоступна", "unavailable");
 */
const unmoderated = (
  reasoning: string,
  failed: TClassificationFailure
): IClassificationResult => {
  recordFailure();
  return { category: "default", confidence: 0, reasoning, failed };
};

/**
 * Stable pseudonymous id for OpenAI's per-end-user abuse handling: a flagged
 * spammer gets blocked alone instead of the whole API organization. Keyed,
 * because plain hashes of numeric Telegram ids are easy to reverse
 * @example
 * safetyIdentifier(123); // "4f1c…" (32 hex chars)
 */
const safetyIdentifier = (userId: number): string =>
  createHmac("sha256", config.telegram.botToken)
    .update(`telegram:${userId}`)
    .digest("hex")
    .slice(0, 32);

/**
 * Builds the user turn: plain text, or the caption line plus the images
 * @example
 * buildUserContent({ text: "", images: [dataUrl], userId: 1 });
 */
const buildUserContent = (
  input: IClassificationInput
): string | ChatCompletionContentPart[] => {
  if (!input.images?.length) {
    return input.text;
  }

  return [
    { type: "text", text: `Подпись: ${input.text || "нет"}` },
    // "high" caps the image at 2048 px; the default ("auto") sends the
    // original size, whose token count has no upper bound on GPT-6
    ...input.images.map(
      (url): ChatCompletionContentPart => ({
        type: "image_url",
        image_url: { url, detail: "high" },
      })
    ),
  ];
};

/**
 * Clamps a model-reported confidence into 0..1 (0 when it is not a number)
 * @example
 * toConfidence(1.7); // 1
 */
const toConfidence = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;

/**
 * Validates a complete model answer; null means it cannot be acted on
 * @example
 * parseVerdict('{"category":"default","confidence":0.9,"reasoning":"…"}');
 */
const parseVerdict = (content: string): IClassificationResult | null => {
  try {
    const parsed = JSON.parse(content) as Partial<
      Record<keyof IClassificationResult, unknown>
    >;
    const category = CONTENT_TYPES.find((type) => type === parsed.category);

    if (!category) {
      return null;
    }

    return {
      category,
      confidence: toConfidence(parsed.confidence),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
  } catch {
    return null;
  }
};

/**
 * Reads category and confidence from an answer cut off at the token limit.
 * They come before the reasoning, so a caption that asks for an endless
 * explanation cannot turn the verdict into a fail-open pass
 * @example
 * salvageTruncated('{"category":"drugs","confidence":0.97,"reasoning":"Длинн');
 */
const salvageTruncated = (content: string): IClassificationResult | null => {
  const match = content.match(
    /^\s*\{\s*"category"\s*:\s*"([a-z]+)"\s*,\s*"confidence"\s*:\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/
  );
  const category = CONTENT_TYPES.find((type) => type === match?.[1]);

  if (!match || !category) {
    return null;
  }

  return {
    category,
    confidence: toConfidence(Number(match[2])),
    reasoning: "Ответ модели обрезан по лимиту токенов",
  };
};

/**
 * Error text that is safe to log (the logger also masks configured secrets)
 * @example
 * describeError(new Error("timeout")); // "Error: timeout"
 */
const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/**
 * Classifies a message (text, or photo with caption) into a moderation category
 * @example
 * const classification = await classifyContent({ text: 'Выгуливать собаку 4500₽/день', userId: 1 });
 * console.log(classification.category); // "jobs"
 */
const classifyContent = async (
  input: IClassificationInput
): Promise<IClassificationResult> => {
  const imageCount = input.images?.length ?? 0;

  try {
    logger.info("Classifying content with AI", {
      model: config.openai.model,
      imageCount,
      messageLength: input.text.length,
      messagePreview: input.text.substring(0, 50),
    });

    const startedAt = Date.now();
    const signal = AbortSignal.timeout(CLASSIFICATION_DEADLINE_MS);

    const request = openai.chat.completions.create(
      {
        model: config.openai.model,
        messages: [
          {
            role: "system",
            content: imageCount ? [RULES_PART, IMAGE_RULES_PART] : [RULES_PART],
          },
          { role: "user", content: buildUserContent(input) },
        ],
        // The API default ("medium") rejects temperature and adds latency;
        // "none" behaves like the non-reasoning classifier this replaced
        reasoning_effort: "none",
        temperature: 0,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: VERDICT_FORMAT,
        prompt_cache_options: { mode: "explicit" },
        safety_identifier: safetyIdentifier(input.userId),
      },
      { signal }
    );

    // The signal aborts the request itself, but the SDK does not watch it
    // while it waits before a retry, so the deadline is enforced here as well
    const deadline = new Promise<never>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });

    const response = await Promise.race([request, deadline]);
    const choice = response.choices[0];
    const usage = response.usage;

    logger.info("Classification usage", {
      model: response.model,
      latencyMs: Date.now() - startedAt,
      promptTokens: usage?.prompt_tokens,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens,
      cacheWriteTokens: usage?.prompt_tokens_details?.cache_write_tokens,
      imageTokens: usage?.prompt_tokens_details?.image_tokens,
      completionTokens: usage?.completion_tokens,
    });

    // OpenAI's safety layer may refuse content such as drug ads
    if (choice?.message?.refusal) {
      logger.warn("Classification refused by the model", {
        refusal: choice.message.refusal.substring(0, 200),
      });
      return unmoderated(
        "Модель отказалась классифицировать сообщение",
        "rejected"
      );
    }

    const content = choice?.message?.content ?? "";
    const verdict =
      choice?.finish_reason === "stop"
        ? parseVerdict(content)
        : choice?.finish_reason === "length"
          ? salvageTruncated(content)
          : null;

    if (!verdict) {
      logger.warn("Unusable classification response", {
        finishReason: choice?.finish_reason,
        contentPreview: content.substring(0, 200),
      });
      return unmoderated("Ошибка разбора ответа классификации", "rejected");
    }

    recordSuccess();

    logger.info("Content classified", {
      category: verdict.category,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
    });

    return verdict;
  } catch (error) {
    if (error instanceof BadRequestError && error.code === "cyber_policy") {
      // OpenAI's cyber safeguard rejects some hacking-related posts outright,
      // more often after repeats. The post stays (fail open, /report covers
      // it); retrying would only add flagged requests
      logger.warn(
        "Classification blocked by OpenAI cyber policy, message left alone"
      );
    } else {
      logger.error("Error in content classification", {
        error: describeError(error),
      });
    }

    // A 400 is about this input (e.g. a file that is not a real image), not
    // about the service: the caller may retry without the images
    return unmoderated(
      "Классификация недоступна, сообщение оставлено без модерации",
      error instanceof BadRequestError ? "rejected" : "unavailable"
    );
  }
};

export default classifyContent;
