import { hasDrugKeywordsSmart } from "./stems";

/**
 * General moderation: suspicious job offers (potential drug courier recruitment)
 */
export const MAIN_MODERATION_PROMPT = `You moderate a Telegram group. Focus ONLY on detecting suspicious job offers that may be drug-related courier recruitment.

IGNORE ALL OF THESE (DO NOT MODERATE):
- Bad words, swearing, profanity in ANY context
- Personal insults between users  
- Casual inappropriate language
- Product prices and normal commerce
- Regular marketplace messages
- ANY conversation content, arguments, or language issues

ONLY FLAG suspicious job/work offers that match these patterns:

SUSPICIOUS COURIER/DELIVERY JOBS:
- Unusually high pay for simple physical tasks
- Vague job descriptions with high money
- "Easy money" delivery/transport jobs
- Quick gigs with disproportionate payment
- Warehouse work with suspiciously high daily rates

EXAMPLES TO MODERATE (HIGH severity only):
- "Сортировка на складе, 3.200 в день" (warehouse sorting, 3200 per day - too high)
- "помогите занести шкаф на 5-этаж, заплачу 5000р" (help carry furniture, 5000r - suspicious)
- "Нужны разнорабочие, рабочие на завод мебели 6300р" (workers needed, 6300r - too much)
- "Грузчики на сегодня 1000р за 1 час" (movers today 1000r per hour - suspicious)
- "Доставка документов, хорошая оплата" (document delivery, good pay - vague)
- "Курьер на день, до 5000р" (courier for a day, up to 5000r - suspicious)

EXAMPLES NOT TO MODERATE:
- Normal job offers with reasonable pay (under 2000r per day)
- Legitimate business advertisements  
- ANY language, swearing, arguments, conversations
- Regular commerce and sales

IMPORTANT: Only flag job offers that seem designed to recruit drug couriers through unusually high pay for simple tasks. Ignore ALL other content including any language issues. Reason should be in Russian. Include 1–2 evidence_phrases verbatim from the message.

Return JSON: {"shouldModerate": boolean, "reason": string|null, "severity": "high", "confidence": number(0.7..0.9)}`;

/**
 * Ticket detection: warning only
 */
export const TICKET_DETECTION_PROMPT = `Detect ticket sales vs ticket buying requests. 

ONLY FLAG ticket SALES (warn the group about potential fraud):
- "Продаю/продам билеты", "перепродам", "реализую"
- "Есть лишний билет, продам"
- "Билеты на футбол/концерт, цена договорная"

DO NOT FLAG ticket BUYING requests (allowed):
- "Куплю", "ищу", "нужен", "приобрету" билет(ы)
- Questions like "Кто продает билеты?" (this is a buying intent)

If both BUY and SELL appear, classify as SELL and explain why. Reason should be in Russian.

Return JSON: {"isTicket": true|false, "confidence": number, "reason": string|null}`;

/**
 * Drug detection: immediate ban
 */
export const DRUG_DETECTION_PROMPT = `Detect drug sales/abuse. Flag any: drug sales, purchases, drug slang. Reason should be in Russian.

Return JSON: {"isDrugRelated": true|false, "confidence": number, "reason": string|null, "substances": []}`;

/**
 * Gambling detection: immediate ban
 */
export const GAMBLING_DETECTION_PROMPT = `Detect gambling/casino spam. Flag any gambling promotion, casino advertising, betting spam.

GAMBLING INDICATORS:
- Casino/gambling site promotion
- Free spins, bonuses, jackpots
- "поднял деньги", "нашел топовый каз", "фри спины"
- Gambling wins bragging: "выиграл", "поднял", "слил", "занос"
- Casino screenshots, slot machine images
- Betting/gambling referral links
- "Топовое казино", "проверенное казино"
- Large money amounts with gambling context

EXAMPLES TO FLAG:
- "поднял 50к в казино"
- "нашел топовый каз, регай"
- "фри спины за регистрацию"
- Screenshots of slot machines, roulette, poker
- "выиграл джекпот"
- Any casino/gambling promotional content

Return JSON: {"isGambling": true|false, "confidence": number, "reason": string|null}`;

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
 * Minimal detection patterns - ready for your additions
 */
export const DETECTION_PATTERNS = {
  general: [],
  tickets: ["билет", "билета", "билеты", "билетов"],
  drugs: [],
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
 * Action thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  general: { ban: 0.85, mute: 0.75, delete: 0.7 }, // For suspicious job offers only
  tickets: { ban: 1.0, mute: 1.0, delete: 1.0 }, // Never ban/mute tickets
  drugs: { ban: 0.5, mute: 0.3, delete: 0.1 }, // Aggressive for drugs
  gambling: { ban: 0.6, mute: 0.4, delete: 0.2 }, // Aggressive for gambling spam
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

  // Check gambling (second priority)
  const hasGamblingKeywords = DETECTION_PATTERNS.gambling.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (hasGamblingKeywords) {
    return GAMBLING_DETECTION_PROMPT;
  }

  // Check tickets
  const hasTicketKeywords = DETECTION_PATTERNS.tickets.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (hasTicketKeywords) {
    return TICKET_DETECTION_PROMPT;
  }

  // Default to general moderation (suspicious job offers)
  return MAIN_MODERATION_PROMPT;
};

/**
 * Get thresholds for content type
 */
export const getThresholdsForContent = (
  contentType: "general" | "tickets" | "drugs" | "gambling"
) => {
  return CONFIDENCE_THRESHOLDS[contentType];
};

/**
 * Determine content type
 */
export const determineContentType = (
  message: string
): "general" | "tickets" | "drugs" | "gambling" => {
  const lowerMessage = message.toLowerCase();

  if (hasDrugKeywordsSmart(lowerMessage)) {
    return "drugs";
  }

  if (
    DETECTION_PATTERNS.gambling.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    )
  ) {
    return "gambling";
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
