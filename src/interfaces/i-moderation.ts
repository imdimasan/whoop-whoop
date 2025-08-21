/**
 * Moderation action types
 */
export type TModerationAction =
  | "none"
  | "delete_message"
  | "mute_user"
  | "ban_user"
  | "warn_user"
  | "warn_group";

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
