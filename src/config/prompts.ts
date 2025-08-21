import { hasDrugKeywordsSmart } from "./stems";

/**
 * General moderation: bad words, insults, harassment
 */
export const MAIN_MODERATION_PROMPT = `You moderate a Telegram group. Check for: bad words, insults, harassment, hate speech, inappropriate content. Also try to detect unusual messages when drug dealers try to hire couriers by offering them easy jobs for high money, primary in RUR. 
Few examples of that messages: "помогите занести шкаф на 5-этаж , заплачу 5000р", "Нужны разнорабочие, рабочие на завод мебели 6300р.", "Грузчики на сегодня 1000р за 1 час" and so on. Reason should be in Russian.

Return JSON: {"shouldModerate": boolean, "reason": string|null, "severity": "low"|"medium"|"high", "confidence": number(0..1)}`;

/**
 * Ticket detection: warning only
 */
export const TICKET_DETECTION_PROMPT = `Detect ticket sales. Look for: concert tickets, event tickets, sports tickets being sold. Reason should be in Russian.

Return JSON: {"isTicket": true|false, "confidence": number, "reason": string|null}`;

/**
 * Drug detection: immediate ban
 */
export const DRUG_DETECTION_PROMPT = `Detect drug sales/abuse. Flag any: drug sales, purchases, drug slang. Reason should be in Russian.

Return JSON: {"isDrugRelated": true|false, "confidence": number, "reason": string|null, "substances": []}`;

/**
 * Minimal detection patterns - ready for your additions
 */
export const DETECTION_PATTERNS = {
  general: [],
  tickets: ["билет", "билета", "билеты", "билетов"],
  drugs: [],
};

/** Action thresholds */
export const CONFIDENCE_THRESHOLDS = {
  general: { ban: 0.9, mute: 0.7, delete: 0.4 }, // Standard for bad words
  tickets: { ban: 1.0, mute: 1.0, delete: 1.0 }, // Never ban/mute tickets
  drugs: { ban: 0.5, mute: 0.3, delete: 0.1 }, // Aggressive for drugs
};

/**
 * Route to appropriate prompt
 */
export const getPromptForContent = (message: string): string => {
  const lowerMessage = message.toLowerCase();

  // Check drugs first (highest priority)
  const hasDrugKeywords = hasDrugKeywordsSmart(lowerMessage);

  if (hasDrugKeywords) {
    return DRUG_DETECTION_PROMPT;
  }

  // Check tickets
  const hasTicketKeywords = DETECTION_PATTERNS.tickets.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (hasTicketKeywords) {
    return TICKET_DETECTION_PROMPT;
  }

  // Default to general moderation
  return MAIN_MODERATION_PROMPT;
};

/**
 * Get thresholds for content type
 */
export const getThresholdsForContent = (
  contentType: "general" | "tickets" | "drugs"
) => {
  return CONFIDENCE_THRESHOLDS[contentType];
};

/**
 * Determine content type
 */
export const determineContentType = (
  message: string
): "general" | "tickets" | "drugs" => {
  const lowerMessage = message.toLowerCase();

  if (hasDrugKeywordsSmart(lowerMessage)) {
    return "drugs";
  }

  if (
    DETECTION_PATTERNS.tickets.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    )
  ) {
    return "tickets";
  }

  return "general";
};
