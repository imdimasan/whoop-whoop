import { hasDrugKeywordsSmart } from "./stems";

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
    "выгуливать",
    "выгул",
    "дегустация",
    "дегустировать",
    "тестировать",
    "тестирование",
    "услуги",
    "помощник",
    "помощь",
    "няня",
    "уборка",
    "убирать",
    "мытье",
    "готовка",
    "готовить",
    "присмотр",
    "сиделка",
    "репетитор",
    "массаж",
    "фотосессия",
    "модель",
    "актер",
    "промоутер",
    "консультант",
    "менеджер",
    "администратор",
    "оператор",
    "водитель",
    "таксист",
    "переводчик",
    "дизайнер",
    "программист",
    "мастер",
    "специалист",
    "исполнитель",
    "фрилансер",
    "удаленно",
    "дистанционно",
    "почасовая",
    "ставка",
    "оплата",
    "зарплата",
    "доход",
    "₽/день",
    "₽/час",
    "₽ в день",
    "₽ в час",
    "руб/день",
    "руб/час",
    "рублей в день",
    "рублей в час",
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
 * Determine content type based on message analysis
 */
export const determineContentType = (
  message: string
): "default" | "jobs" | "tickets" | "drugs" | "gambling" => {
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

  // Default to default (no moderation needed)
  return "default";
};
