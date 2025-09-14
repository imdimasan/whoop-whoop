import { logger } from "../utils/logger.js";
import { IModerationResult } from "../interfaces/i-moderation.js";
import classifyContent from "../helpers/classify-content.js";
import getActionForContentType from "../helpers/get-action.js";
import getSeverityForContentType from "../helpers/get-severity.js";

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

    // Classify content type using AI
    const classification = await classifyContent(message);
    const contentType = classification.category;

    logger.info("Message identified as", { contentType });

    // Skip moderation for default content
    if (contentType === "default" || contentType === "financial") {
      return {
        shouldModerate: false,
        severity: "low",
        suggestedAction: "none",
        confidence: 0,
      };
    }

    // Determine action based on content type
    const { action, reason } = getActionForContentType(contentType);

    const result = {
      shouldModerate: action !== "none",
      reason,
      severity: getSeverityForContentType(contentType),
      suggestedAction: action,
      confidence: classification.confidence || 0.8,
    };

    logger.info("Message analysis result", {
      action: result.suggestedAction,
      reason: result.reason,
    });

    return result;
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

// For backward compatibility, export the main function as default
export default { analyzeMessage };
