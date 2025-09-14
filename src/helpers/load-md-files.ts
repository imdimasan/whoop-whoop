import { readFileSync } from "fs";
import { join } from "path";
import logger from "../utils/logger";

/**
 * Utility function to load markdown prompts from files
 * @example
 * const prompt = loadPromptFromFile('main-moderation.md');
 */
const loadMarkdownFile = (filename: string): string => {
  // Prefer source prompts during development; fall back to compiled prompts in production
  const srcPath = join(process.cwd(), "src", "config", "prompts", filename);
  const distPath = join(__dirname, "..", "config", "prompts", filename);

  // Try reading from src first
  try {
    const content = readFileSync(srcPath, "utf-8");
    logger.debug("Loaded prompt file", { filename, from: "src" });
    return content;
  } catch {}

  // Fall back to dist
  try {
    const content = readFileSync(distPath, "utf-8");
    logger.debug("Loaded prompt file", { filename, from: "dist" });
    return content;
  } catch (error) {
    logger.debug("Failed to load prompt file", {
      filename,
      srcPath,
      distPath,
      error,
    });

    // Fallback to inline prompt if file loading fails
    return "Rules for moderation are not loaded. Please skip moderation.";
  }
};

export default loadMarkdownFile;
