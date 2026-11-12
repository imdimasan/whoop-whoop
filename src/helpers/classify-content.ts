import OpenAI from "openai";
import logger from "../utils/logger";
import { config } from "../config/index.js";
import { CONTENT_CLASSIFICATION_PROMPT } from "../config/prompts/index.js";
import { TContentType } from "../interfaces/i-content";

// Updates are handled one by one, so a slow classification stalls moderation
// in every group. The SDK timeout (default: 10 minutes) limits one attempt
// until the response headers arrive; the deadline limits the whole call,
// including retries, the wait between them and a stalled response body
const ATTEMPT_TIMEOUT_MS = 15000;
const CLASSIFICATION_DEADLINE_MS = 30000;

// Report a streak of failed classifications every N messages: a streak means
// messages are not being moderated at all (expired key, quota, outage)
const FAILURE_STREAK_REPORT_EVERY = 20;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  timeout: ATTEMPT_TIMEOUT_MS,
});

let failedInRow = 0;

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
 * Content classification result interface
 */
interface IClassificationResult {
  category: TContentType;
  confidence: number;
  reasoning: string;
}

/**
 * Classifies message content using AI to determine appropriate moderation prompt
 * @example
 * const classification = await classifyContent('Выгуливать собаку 4500₽/день');
 * console.log(classification.category); // "jobs"
 */
const classifyContent = async (
  message: string
): Promise<IClassificationResult> => {
  try {
    logger.info("Classifying content with AI", {
      messageLength: message.length,
      messagePreview: message.substring(0, 50),
    });

    const signal = AbortSignal.timeout(CLASSIFICATION_DEADLINE_MS);

    const request = openai.chat.completions.create(
      {
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: CONTENT_CLASSIFICATION_PROMPT,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0,
        top_p: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
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

    const content = response.choices[0]?.message?.content;

    if (!content) {
      logger.warn("No classification response from OpenAI");
      recordFailure();
      return {
        category: "default",
        confidence: 0.5,
        reasoning: "Не удалось классифицировать сообщение",
      };
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      logger.warn("No JSON found in classification response", { content });
      recordFailure();
      return {
        category: "default",
        confidence: 0.5,
        reasoning: "Ошибка парсинга ответа классификации",
      };
    }

    const classification = JSON.parse(jsonMatch[0]) as IClassificationResult;

    recordSuccess();

    logger.info("Content classified", {
      category: classification.category,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    });

    return classification;
  } catch (error) {
    logger.error("Error in content classification", { error });

    recordFailure();

    // Fail open: without an AI verdict the message is left alone. Keyword
    // matching is too imprecise to punish on its own ("работа" is inside
    // "не работает", "кет" inside "маркета") and has banned regular sellers
    return {
      category: "default",
      confidence: 0,
      reasoning: "Классификация недоступна, сообщение оставлено без модерации",
    };
  }
};

export default classifyContent;
