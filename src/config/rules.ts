import loadMarkdownFile from "../helpers/load-md-files";
import { hasDrugKeywordsSmart } from "./stems";

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
 * Translation map for OpenAI moderation categories to Russian
 */
export const MODERATION_CATEGORY_TRANSLATIONS = {
  harassment: "Преследование",
  "harassment/threatening": "Угрозы и преследование",
  hate: "Разжигание ненависти",
  "hate/threatening": "Угрозы на почве ненависти",
  "self-harm": "Причинение вреда себе",
  "self-harm/intent": "Намерение причинить вред себе",
  "self-harm/instructions": "Инструкции по причинению вреда себе",
  sexual: "Сексуальный контент",
  "sexual/minors": "Сексуальный контент с участием несовершеннолетних",
  violence: "Насилие",
  "violence/graphic": "Графическое насилие",
} as const;

/**
 * Common English phrases that might appear in reasons and their Russian translations
 */
export const REASON_TRANSLATIONS = {
  "Inappropriate content": "Неподходящий контент",
  "inappropriate content": "неподходящий контент",
  "random numbers": "случайные числа",
  "Inappropriate content (random numbers)":
    "Неподходящий контент (случайные числа)",
  spam: "спам",
  Spam: "Спам",
  harassment: "преследование",
  Harassment: "Преследование",
  "hate speech": "разжигание ненависти",
  "Hate speech": "Разжигание ненависти",
  violence: "насилие",
  Violence: "Насилие",
  "sexual content": "сексуальный контент",
  "Sexual content": "Сексуальный контент",
} as const;

/**
 * Translates reason from English to Russian if needed
 * @example
 * const translated = translateReason('Inappropriate content (random numbers)');
 */
export const translateReason = (reason: string): string => {
  if (!reason) {
    return reason;
  }

  let translatedReason = reason;

  // Apply translations for known phrases
  Object.entries(REASON_TRANSLATIONS).forEach(([english, russian]) => {
    translatedReason = translatedReason.replace(
      new RegExp(english, "gi"),
      russian
    );
  });

  return translatedReason;
};

/**
 * Detection patterns organized by category
 */
export const DETECTION_PATTERNS = {
  // Financial schemes for main moderation
  financial: [
    "займ",
    "кредит",
    "быстрые деньги",
    "легкие деньги",
    "финансовая помощь",
    "деньги в долг",
  ],
  // Job offers and recruitment
  jobs: [
    "работа",
    "вакансия",
    "требуется",
    "требуются",
    "курьер",
    "грузчик",
    "подработка",
    "заработок",
    "сотрудник",
    "разнорабочий",
    "доставка",
    "склад",
    "ищем сотрудников",
    "приглашаем на работу",
  ],
  // Ticket sales
  tickets: [
    "билет",
    "билета",
    "билеты",
    "билетов",
    "bilet",
    "bileta",
    "bilety",
    "ticket",
    "tickets",
  ],
  // Gambling and casino content
  gambling: [
    "казино",
    "каз",
    "фри спины",
    "поднял",
    "выиграл",
    "джекпот",
    "слот",
    "рулетка",
    "ставки",
    "бонус",
    "занос",
    "слил",
    "топовый каз",
    "регай",
  ],
};

/**
 * Action thresholds by content type
 */
export const CONFIDENCE_THRESHOLDS = {
  // Financial schemes in main moderation
  financial: { ban: 0.8, mute: 0.6, delete: 0.4 },
  // Job offers and recruitment
  jobs: { ban: 0.8, mute: 0.6, delete: 0.4 }, // High-pay jobs get higher confidence
  // Ticket sales - mute only
  tickets: { ban: 1.0, mute: 0.7, delete: 1.0 }, // Mute at 0.7, never ban or delete
  // Drug-related content - aggressive
  drugs: { ban: 0.5, mute: 0.3, delete: 0.1 }, // Aggressive for drugs
  // Gambling spam - aggressive
  gambling: { ban: 0.6, mute: 0.4, delete: 0.2 }, // Aggressive for gambling spam
};

/**
 * Route to appropriate prompt based on content analysis
 */
export const getPromptForContent = (message: string): string => {
  const lowerMessage = message.toLowerCase();

  // Check drugs first (highest priority)
  const hasDrugKeywords = hasDrugKeywordsSmart(lowerMessage);

  if (hasDrugKeywords) {
    return DRUG_DETECTION_PROMPT;
  }

  // Check job keywords (second priority)
  const hasJobKeywords = DETECTION_PATTERNS.jobs.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (hasJobKeywords) {
    return JOB_HIRING_DETECTION_PROMPT;
  }

  // Check gambling (third priority)
  const hasGamblingKeywords = DETECTION_PATTERNS.gambling.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (hasGamblingKeywords) {
    return GAMBLING_DETECTION_PROMPT;
  }

  // Check tickets (fourth priority)
  const hasTicketKeywords = DETECTION_PATTERNS.tickets.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (hasTicketKeywords) {
    return TICKET_DETECTION_PROMPT;
  }

  // Check financial schemes
  const hasFinancialKeywords = DETECTION_PATTERNS.financial.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );
  if (hasFinancialKeywords) {
    return FINANCIAL_MODERATION_PROMPT;
  }

  // Default to financial moderation for general marketplace content
  return FINANCIAL_MODERATION_PROMPT;
};

/**
 * Get thresholds for content type
 */
export const getThresholdsForContent = (
  contentType: "financial" | "jobs" | "tickets" | "drugs" | "gambling"
) => {
  return CONFIDENCE_THRESHOLDS[contentType];
};

/**
 * Determine content type based on message analysis
 */
export const determineContentType = (
  message: string
): "financial" | "jobs" | "tickets" | "drugs" | "gambling" => {
  const lowerMessage = message.toLowerCase();

  // Check drugs first (highest priority)
  if (hasDrugKeywordsSmart(lowerMessage)) {
    return "drugs";
  }

  // Check job keywords
  if (
    DETECTION_PATTERNS.jobs.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    )
  ) {
    return "jobs";
  }

  // Check gambling
  if (
    DETECTION_PATTERNS.gambling.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    )
  ) {
    return "gambling";
  }

  // Check tickets
  if (
    DETECTION_PATTERNS.tickets.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    )
  ) {
    return "tickets";
  }

  // Check financial schemes
  if (
    DETECTION_PATTERNS.financial.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    )
  ) {
    return "financial";
  }

  // Default to financial for main moderation
  return "financial";
};
