import OpenAI from "openai";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import {
  IModerationResult,
  TModerationAction,
} from "../interfaces/i-moderation.js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Analyzes message content for moderation
 * @example
 * const result = await analyzeMessage('Hello world', 123);
 * if (result.shouldModerate) {
 *   console.log('Message needs moderation:', result.reason);
 * }
 */
export const analyzeMessage = async (
  message: string,
  userId: number
): Promise<IModerationResult> => {
  try {
    logger.info("Analyzing message", {
      userId,
      messageLength: message.length,
      messagePreview: message.substring(0, 50),
    });

    // First, use OpenAI's moderation endpoint
    const moderation = await openai.moderations.create({
      input: message,
    });

    const { results } = moderation;

    if (!results || results.length === 0) {
      return {
        shouldModerate: false,
        severity: "low",
        suggestedAction: "none",
        confidence: 0,
      };
    }

    const result = results[0];
    const { flagged, categories, category_scores } = result;

    // Check if content is flagged by OpenAI moderation
    if (flagged) {
      const flaggedCategories = Object.entries(categories)
        .filter(([_, value]) => value)
        .map(([key]) => key);

      const maxScore = Math.max(...Object.values(category_scores));

      return {
        shouldModerate: true,
        reason: `Content violates: ${flaggedCategories.join(", ")}`,
        severity: determineSeverity(maxScore),
        suggestedAction: determinAction(maxScore),
        confidence: maxScore,
      };
    }

    // Additional custom analysis using GPT
    const customAnalysis = await performCustomAnalysis(message);

    return customAnalysis;
  } catch (error) {
    logger.error("Failed to analyze message", { error, userId });

    return {
      shouldModerate: false,
      severity: "low",
      suggestedAction: "none",
      confidence: 0,
    };
  }
};

/**
 * Performs custom content analysis using GPT
 * @example
 * const result = await performCustomAnalysis('Check this message');
 */
const performCustomAnalysis = async (
  message: string
): Promise<IModerationResult> => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a content moderator for a Telegram group. Analyze the message and determine if it needs moderation.
          Consider: spam, scams, inappropriate content, hate speech, harassment, or off-topic content.
          Respond in JSON format: {"shouldModerate": boolean, "reason": string or null, "severity": "low"|"medium"|"high", "confidence": 0-1}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return {
        shouldModerate: false,
        severity: "low",
        suggestedAction: "none",
        confidence: 0,
      };
    }

    const analysis = JSON.parse(response);

    const shouldModerate = analysis.shouldModerate || false;

    return {
      shouldModerate,
      reason: analysis.reason,
      severity: analysis.severity || "low",
      suggestedAction: shouldModerate
        ? determinAction(analysis.confidence || 0)
        : "none",
      confidence: analysis.confidence || 0,
    };
  } catch (error) {
    logger.error("Custom analysis failed", { error });

    return {
      shouldModerate: false,
      severity: "low",
      suggestedAction: "none",
      confidence: 0,
    };
  }
};

/**
 * Determines severity based on confidence score
 * @example
 * const severity = determineSeverity(0.8);
 */
const determineSeverity = (score: number): "low" | "medium" | "high" => {
  if (score >= 0.8) {
    return "high";
  }

  if (score >= 0.5) {
    return "medium";
  }

  return "low";
};

/**
 * Determines action based on confidence score
 * @example
 * const action = determinAction(0.9);
 */
const determinAction = (score: number): TModerationAction => {
  const { thresholds } = config.moderation;

  if (score >= thresholds.ban) {
    return "ban_user";
  }

  if (score >= thresholds.mute) {
    return "mute_user";
  }

  if (score >= thresholds.delete) {
    return "delete_message";
  }

  return "none";
};

// For backward compatibility, export the main function as default
export default { analyzeMessage };
