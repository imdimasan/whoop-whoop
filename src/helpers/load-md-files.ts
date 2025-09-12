import { readFileSync } from "fs";
import { join } from "path";
import logger from "../utils/logger";

/**
 * Utility function to load markdown prompts from files
 * @example
 * const prompt = loadPromptFromFile('main-moderation.md');
 */
const loadMarkdownFile = (filename: string): string => {
  const promptPath = join(__dirname, "..", "config", "prompts", filename);

  try {
    return readFileSync(promptPath, "utf-8");
  } catch (error) {
    logger.debug("Failed to load prompt file", {
      filename,
      error,
    });

    // Fallback to inline prompt if file loading fails
    return "Rules for moderation are not loaded. Please skip moderation.";
  }
};

export default loadMarkdownFile;
