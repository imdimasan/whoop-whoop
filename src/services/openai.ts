import OpenAI from "openai";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import {
  IModerationResult,
  TModerationAction,
} from "../interfaces/i-moderation.js";
import {
  getPromptForContent,
  getThresholdsForContent,
  determineContentType,
  MODERATION_CATEGORY_TRANSLATIONS,
  translateReason,
} from "../config/prompts.js";

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
      model: "omni-moderation-latest",
      input: message,
    });

    const { results } = moderation;

    if (Boolean(!results?.length)) {
      return {
        shouldModerate: false,
        severity: "low",
        suggestedAction: "none",
        confidence: 0,
      };
    }

    const [result] = results;
    const { flagged, categories, category_scores } = result;

    // Check if content is flagged by OpenAI moderation
    if (flagged) {
      const flaggedCategories = Object.entries(categories)
        .filter(([_, value]) => value)
        .map(([key]) => key);

      const maxScore = Math.max(...Object.values(category_scores));

      // Translate categories to Russian
      const translatedCategories = flaggedCategories
        .map(
          (category) =>
            MODERATION_CATEGORY_TRANSLATIONS[
              category as keyof typeof MODERATION_CATEGORY_TRANSLATIONS
            ] || category
        )
        .join(", ");

      return {
        shouldModerate: true,
        reason: `Нарушение контента: ${translatedCategories}`,
        severity: determineSeverity(maxScore),
        suggestedAction: determinActionByContentType(maxScore, "general"),
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
 * Performs custom content analysis using GPT with specialized prompts
 * @example
 * const result = await performCustomAnalysis('Check this message');
 */
const performCustomAnalysis = async (
  message: string
): Promise<IModerationResult> => {
  try {
    // First, determine content type and get appropriate prompt
    const contentType = determineContentType(message);
    const prompt = getPromptForContent(message);

    logger.info("Performing custom analysis", {
      message: message.substring(0, 50),
      contentType,
      promptType: contentType,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: "json_object" },
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

    logger.info("OpenAI analysis result", {
      contentType,
      analysis: {
        shouldModerate:
          analysis.shouldModerate ||
          analysis.isDrugRelated ||
          analysis.isScam ||
          false,
        reason: analysis.reason,
        confidence: analysis.confidence,
        ...(analysis.scamType && { scamType: analysis.scamType }),
        ...(analysis.substances && { substances: analysis.substances }),
        ...(analysis.evidence_phrases && {
          evidence: analysis.evidence_phrases,
        }),
        ...(analysis.isGambling && { isGambling: analysis.isGambling }),
      },
    });

    // Handle different response formats based on content type
    if (contentType === "drugs") {
      return handleDrugAnalysis(analysis);
    }

    if (contentType === "gambling") {
      return handleGamblingAnalysis(analysis);
    }

    if (contentType === "tickets") {
      return handleTicketAnalysis(analysis);
    }

    // Handle general moderation response
    const shouldModerate = analysis.shouldModerate || false;

    // Check if this is ticket-related content that slipped through
    let suggestedAction: TModerationAction = "none";

    if (shouldModerate) {
      suggestedAction = determinActionByContentType(
        analysis.confidence || 0,
        contentType
      );
    }

    const finalResult = {
      shouldModerate,
      reason: translateReason(analysis.reason),
      severity: analysis.severity || "low",
      suggestedAction,
      confidence: analysis.confidence || 0,
    };

    logger.info("Final moderation result", {
      contentType,
      result: {
        shouldModerate: finalResult.shouldModerate,
        action: finalResult.suggestedAction,
        reason: finalResult.reason,
        confidence: finalResult.confidence,
      },
    });

    return finalResult;
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
 * Handles drug-related content analysis
 * @example
 * const result = handleDrugAnalysis(analysis, message);
 */
const handleDrugAnalysis = (analysis: any): IModerationResult => {
  const isDrugRelated = analysis.isDrugRelated || false;

  if (isDrugRelated) {
    const result = {
      shouldModerate: true,
      reason:
        translateReason(analysis.reason) ||
        "Обнаружен контент, связанный с наркотиками",
      severity: "high" as const,
      suggestedAction: "ban_user" as const,
      confidence: analysis.confidence || 0.9,
    };

    logger.info("Drug content detected", {
      result: {
        shouldModerate: result.shouldModerate,
        action: result.suggestedAction,
        reason: result.reason,
        confidence: result.confidence,
        substances: analysis.substances || [],
      },
    });

    return result;
  }

  return {
    shouldModerate: false,
    severity: "low",
    suggestedAction: "none",
    confidence: analysis.confidence || 0.1,
  };
};

/**
 * Handles gambling-related content analysis
 * @example
 * const result = handleGamblingAnalysis(analysis);
 */
const handleGamblingAnalysis = (analysis: any): IModerationResult => {
  const isGambling = analysis.isGambling || false;

  if (isGambling) {
    const confidence = analysis.confidence || 0.8;

    const result = {
      shouldModerate: true,
      reason:
        translateReason(analysis.reason) ||
        "Обнаружен спам казино/азартных игр",
      severity: confidence >= 0.7 ? ("high" as const) : ("medium" as const),
      suggestedAction: determinActionByContentType(confidence, "gambling"),
      confidence,
    };

    logger.info("Gambling content detected", {
      result: {
        shouldModerate: result.shouldModerate,
        action: result.suggestedAction,
        reason: result.reason,
        confidence: result.confidence,
      },
    });

    return result;
  }

  return {
    shouldModerate: false,
    severity: "low",
    suggestedAction: "none",
    confidence: analysis.confidence || 0.1,
  };
};

/**
 * Handles ticket-related content analysis
 * @example
 * const result = handleTicketAnalysis(analysis);
 */
const handleTicketAnalysis = (analysis: any): IModerationResult => {
  const isTicket = analysis.isTicket || false;

  if (isTicket) {
    const confidence = analysis.confidence || 0.75;

    // For tickets, mute user but keep the message visible
    const result = {
      shouldModerate: true,
      reason:
        translateReason(analysis.reason) ||
        "Обнаружена продажа билетов - возможный риск мошенничества",
      severity: "medium" as const,
      suggestedAction: "mute_user_keep_message" as TModerationAction,
      confidence,
    };

    logger.info("Ticket sale detected", {
      result: {
        shouldModerate: result.shouldModerate,
        action: result.suggestedAction,
        reason: result.reason,
        confidence: result.confidence,
      },
    });

    return result;
  }

  return {
    shouldModerate: false,
    severity: "low",
    suggestedAction: "none",
    confidence: analysis.confidence || 0.1,
  };
};

/**
 * Determines action based on confidence score and content type
 * @example
 * const action = determinActionByContentType(0.9, 'drugs');
 */
const determinActionByContentType = (
  score: number,
  contentType: "drugs" | "tickets" | "general" | "gambling"
): TModerationAction => {
  const thresholds = getThresholdsForContent(contentType);

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

// For backward compatibility, export the main function as default
export default { analyzeMessage };
