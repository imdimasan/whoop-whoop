import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { IModerationResult } from "../interfaces/i-moderation.js";
import classifyContent, {
  IClassificationInput,
} from "../helpers/classify-content.js";
import getActionForContentType from "../helpers/get-action.js";
import getSeverityForContentType from "../helpers/get-severity.js";

const NO_ACTION: IModerationResult = {
  shouldModerate: false,
  severity: "low",
  suggestedAction: "none",
  confidence: 0,
};

/**
 * Analyzes a message (text, or photo with caption) for moderation
 * @example
 * const result = await analyzeMessage({ text: 'Hello world', userId: 123 });
 * if (result.shouldModerate) {
 *   console.log('Message needs moderation:', result.reason);
 * }
 */
export const analyzeMessage = async (
  input: IClassificationInput
): Promise<IModerationResult> => {
  const isImagePost = Boolean(input.images?.length);

  try {
    logger.info("Analyzing message", {
      userId: input.userId,
      messageLength: input.text.length,
      messagePreview: input.text.substring(0, 50),
    });

    // Classify content type using AI
    const classification = await classifyContent(input);

    // An image the API rejects (a non-image file sent as image/*, a refusal)
    // must not spare the caption: judge the text alone, as when the download
    // or the daily cap skips the image. Not after timeouts: a second call
    // would double the stall in the one-update-at-a-time loop
    if (
      isImagePost &&
      classification.failed === "rejected" &&
      input.text.trim().length >= 3
    ) {
      logger.info("Image request rejected, checking the caption alone");
      return analyzeMessage({ ...input, images: [] });
    }

    const contentType = classification.category;

    logger.info("Message identified as", { contentType });

    // Skip moderation for default content only
    if (contentType === "default") {
      return NO_ACTION;
    }

    if (isImagePost && classification.confidence < config.images.minConfidence) {
      logger.info("Image verdict below confidence floor, no action taken", {
        category: contentType,
        confidence: classification.confidence,
        floor: config.images.minConfidence,
      });
      return NO_ACTION;
    }

    // Determine action based on content type
    const { action, reason } = getActionForContentType(contentType);

    const result = {
      shouldModerate: action !== "none",
      // The public notice says when the picture decided it: helps admins
      // review bans of posts whose text looks harmless
      reason: isImagePost ? `${reason} (по изображению)` : reason,
      severity: getSeverityForContentType(contentType),
      suggestedAction: action,
      confidence: classification.confidence,
    };

    logger.info("Message analysis result", {
      action: result.suggestedAction,
      reason: result.reason,
    });

    return result;
  } catch (error) {
    logger.error("Failed to analyze message", { error, userId: input.userId });

    return NO_ACTION;
  }
};

// For backward compatibility, export the main function as default
export default { analyzeMessage };
