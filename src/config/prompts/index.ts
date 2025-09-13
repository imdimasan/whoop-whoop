import loadMarkdownFile from "../../helpers/load-md-files";

/**
 * Financial moderation prompt loaded from markdown file - for marketplace sales and financial schemes
 */
export const FINANCIAL_MODERATION_PROMPT = loadMarkdownFile(
  "financial-moderation.md"
);

/**
 * Job/hiring detection: moderate job offers and recruitment
 */
export const JOB_HIRING_DETECTION_PROMPT = loadMarkdownFile(
  "job-hiring-detection.md"
);

/**
 * Ticket detection: mute user but keep message
 */
export const TICKET_DETECTION_PROMPT = loadMarkdownFile("ticket-detection.md");

/**
 * Drug detection: immediate ban
 */
export const DRUG_DETECTION_PROMPT = loadMarkdownFile("drugs-detection.md");

/**
 * Gambling detection: immediate ban
 */
export const GAMBLING_DETECTION_PROMPT = loadMarkdownFile(
  "gambling-detection.md"
);

/**
 * Content classification: AI-powered content type detection
 */
export const CONTENT_CLASSIFICATION_PROMPT = loadMarkdownFile(
  "content-classification.md"
);
