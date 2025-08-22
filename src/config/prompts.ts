import { hasDrugKeywordsSmart } from "./stems";

/**
 * General moderation: bad words, insults, harassment
 */
export const MAIN_MODERATION_PROMPT = `You moderate a Telegram group. Check for harmful content that disrupts the community.

SEVERITY LEVELS:
- LOW: Mild inappropriate language about things/situations, childish words, self-referential language - DELETE + warning only
- MEDIUM: Personal insults DIRECTED AT OTHER USERS, targeted harassment, aggressive language - MUTE
- HIGH: Hate speech, severe harassment, threats, explicit sexual content - BAN

CRITICAL: Distinguish between talking ABOUT things vs talking TO/ABOUT people:
- "Это говно" (about a thing/situation) = LOW
- "Ты говно" (about a person) = MEDIUM

DO NOT flag:
- Product prices (e.g., "80 гел", "100 руб", "$50", "€30")
- Normal commerce/marketplace messages
- Casual swearing in discussion context (not directed at people)
- Childish/silly language like "какашки", "говно" when not insulting someone
- Self-referential language where user talks about themselves ("я не мудак", "I'm not an idiot")
- Users defending themselves or their reputation
- Currency amounts or financial discussions

DO flag suspicious courier recruitment (may be drug-related):
- Unusually high pay for simple tasks: "помогите занести шкаф на 5-этаж, заплачу 5000р"
- Vague job offers with high money: "Нужны разнорабочие, рабочие на завод мебели 6300р"
- Quick high-paying gigs: "Грузчики на сегодня 1000р за 1 час"

EXAMPLES OF LOW SEVERITY (DELETE + warning only):
- "Я не какой то мудак мошенник" (self-defense)
- "Думаешь я идиот?" (rhetorical question about oneself)
- "Я не дурак, понимаю что происходит" (self-referential)
- "Это говно, но работает" (opinion about object/thing)
- "Не ну это конечно говнище" (expressing negative opinion about situation/thing)
- "Какая фигня" (general expression of dissatisfaction)
- "Полное дерьмо" (when talking about objects/situations, not people)

EXAMPLES TO MODERATE:
- "Ты мудак" → MEDIUM (direct insult at user)
- "Все тут идиоты" → MEDIUM (insulting group)
- "Иди нахуй" → HIGH (aggressive directed language)

IMPORTANT: Be lenient with casual language. Only moderate content that is clearly harmful or targeted harassment of OTHER PEOPLE. 

CONFIDENCE GUIDELINES:
- LOW severity should have confidence 0.3-0.7 (mild language about things)
- MEDIUM severity should have confidence 0.7-0.9 (insults directed at people)
- HIGH severity should have confidence 0.9+ (severe harassment, threats)

Never give confidence 1.0 unless it's extremely severe content like death threats. Reason should be in Russian.

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
};

/**
 * Action thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  general: { ban: 0.95, mute: 0.8, delete: 0.5 }, // More lenient for casual language
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
