import { TModerationAction } from "./i-actions.js";

/**
 * Moderation result from OpenAI
 */
export interface IModerationResult {
  shouldModerate: boolean;
  reason?: string;
  severity: "low" | "medium" | "high";
  suggestedAction: TModerationAction;
  confidence: number;
}
