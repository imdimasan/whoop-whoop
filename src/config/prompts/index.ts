import loadMarkdownFile from "../../helpers/load-md-files";

/**
 * Content classification: AI-powered content type detection
 */
export const CONTENT_CLASSIFICATION_PROMPT = loadMarkdownFile(
  "content-classification.md"
);

/**
 * Extra rules for photo posts, sent after the classification rules
 */
export const IMAGE_POSTS_PROMPT = loadMarkdownFile("image-posts.md");
