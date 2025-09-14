import {
  near,
  normalizeBasic,
  squeezeLettersDigits,
  stemToRegex,
} from "../helpers/drug-detection";

/**
 * Hard stems - enough match to consider "drugs"
 */
const DRUG_STEMS_STRONG = [
  "трав",
  "шиш",
  "гаш",
  "марихуан",
  "каннаб",
  "конопл",
  "спайс",
  "джойнт",
  "косяк",
  "кокаин",
  "кокс",
  "crack",
  "coke",
  "амфетамин",
  "амф",
  "speed",
  "метамфетамин",
  "мет",
  "кристал",
  "crystal",
  "ice",
  "мефедрон",
  "меф",
  "meph",
  "mephedrone",
  "пвп",
  "apvp",
  "a-pvp",
  "альфапвп",
  "соль",
  "соли",
  "bathsalt",
  "salt",
  "мдма",
  "экстаз",
  "ecstasy",
  "mdma",
  "molly",
  "xtc",
  "лсд",
  "acid",
  "блоттер",
  "blotter",
  "грибы",
  "псило",
  "psilo",
  "psilocybin",
  "героин",
  "opiat",
  "opioid",
  "opiate",
  "кетамин",
  "кет",
  "keta",
  "ketamine",
  "оксикод",
  "oxy",
  "codein",
  "кодеин",
  "tramadol",
] as const;

/**
 * Context stems - require "neighboring" price/unit or deal verbs
 */
const DRUG_STEMS_CONTEXT = [
  "лед",
  "айс",
  "снег",
  "скорост",
  "микс",
  "табл",
  "таблы",
  "товар",
  "продукт",
  "материал",
  "stuff",
  "клады",
  "клад",
] as const;

/**
 * Price/unit/deal markers
 */
const PRICE_STEMS = [
  "₾",
  "лари",
  "gel",
  "$",
  "usd",
  "евро",
  "eur",
  "€",
  "₽",
  "руб",
  "за г",
  "за грам",
  "0.5г",
  "1г",
  "2г",
];
const UNIT_STEMS = [
  "гр",
  "грам",
  "г",
  "mg",
  "мг",
  "шт",
  "таб",
  "dose",
  "doses",
];
const DEAL_STEMS = [
  "продам",
  "куплю",
  "в наличии",
  "налич",
  "опт",
  "достав",
  "курьер",
  "в лс",
  "в л/с",
  "в дм",
  "dm",
  "pm",
  "telegram",
  "телеграм",
  "meek900",
  "MEEK900",
  "тг поиске",
  "тг поиск",
];

const RX_DRUG_STRONG = DRUG_STEMS_STRONG.map((s) => stemToRegex(s));
const RX_DRUG_CONTEXT = DRUG_STEMS_CONTEXT.map((s) => stemToRegex(s));
const RX_PRICE = PRICE_STEMS.map((s) => stemToRegex(s, false));
const RX_UNIT = UNIT_STEMS.map((s) => stemToRegex(s, false));
const RX_DEAL = DEAL_STEMS.map((s) => stemToRegex(s, false));

/**
 * Pet grass context markers to avoid false positives ("кошачья трава")
 * @example
 * // returns true for messages like "трава для кошек пророщенная"
 */
const PET_CONTEXT_MARKERS = [
  "кош", // кошка/кошек/кошачья
  "кот", // кот/кота/котам
] as const;

/**
 * Plant/sprout markers commonly used with pet grass
 * @example
 * // helps disambiguate from drug slang
 */
const PET_PLANT_MARKERS = [
  "пророщ", // пророщенная/проростки
  "овес",
  "овёс",
  "ячмен",
  "пшениц",
  "семен", // семена/семян
] as const;

const RX_TRAVA = stemToRegex("трав");
const RX_FEN = stemToRegex("фен");

/**
 * Medical equipment and supplies context markers to avoid false positives
 * @example
 * // returns false for messages like "omron медицинский бесконтактный термометр"
 */
const MEDICAL_DEVICE_MARKERS = [
  // generic medical context
  "медицинск",
  "аптеч",
  "стерил",
  // common medical devices
  "термометр",
  "тонометр",
  "пульсоксиметр",
  "глюкометр",
  "небулайзер",
  "ингалятор",
  "пульсометр",
  // brands and descriptors
  "omron",
  "омрон",
  "электронн",
  "бесконтактн",
  // accessories / supplies
  "маск",
  "повязк",
  "пластыр",
  "антисептик",
] as const;

/**
 * Utility: check if any token is included in text
 * @example
 * containsAny('трава для кошек', ['кош']) // true
 */
const containsAny = (text: string, tokens: readonly string[]): boolean => {
  for (const token of tokens) {
    const normToken = normalizeBasic(token);

    if (text.includes(normToken)) {
      return true;
    }
  }
  return false;
};

/**
 * Main check for "drugs"
 */
export const hasDrugKeywordsSmart = (message: string): boolean => {
  const norm = normalizeBasic(message);
  const squeezed = squeezeLettersDigits(message);

  // Guard: "кошачья трава" or similar pet-grass products should not be flagged
  const hasTrava = RX_TRAVA.test(norm) || RX_TRAVA.test(squeezed);
  if (hasTrava) {
    const hasPetContext = containsAny(norm, PET_CONTEXT_MARKERS);
    const hasPlantContext = containsAny(norm, PET_PLANT_MARKERS);

    if (hasPetContext || (hasPetContext && hasPlantContext)) {
      return false;
    }
  }

  // Guard: "фен" as hair dryer should not be flagged
  const HAIR_DRYER_MARKERS = [
    "волос",
    "уклад",
    "сушка",
    "насадк",
    "щетк",
    "щётк",
    "диффузор",
    "мощност",
    "ватт",
    "режим",
    "температур",
    "иониз",
    "ion",
    "турмалин",
    "керамик",
    "компакт",
    "дорожн",
    "профессионал",
    // sale/price/condition markers
    "продам",
    "продаю",
    "куплю",
    "обмен",
    "меняю",
    "цена",
    "бу",
    "б/у",
    "₾",
    "лар",
    "лари",
    "gel",
    "$",
    "usd",
    "руб",
    "₽",
    // common brands
    "dyson",
    "philips",
    "rowenta",
    "remington",
    "braun",
    "panasonic",
    "xiaomi",
  ] as const;

  const hasFen = RX_FEN.test(norm) || RX_FEN.test(squeezed);
  if (hasFen) {
    const hairDryerContext = containsAny(norm, HAIR_DRYER_MARKERS);
    if (hairDryerContext) {
      return false;
    }
  }

  // Guard: medical equipment context should not be flagged
  // Examples: "omron медицинский бесконтактный термометр", "тонометр OMRON"
  if (containsAny(norm, MEDICAL_DEVICE_MARKERS)) {
    return false;
  }

  // 1) Hard stems - immediately true (catches Koeks, TPABA, m-e-f etc.)
  if (RX_DRUG_STRONG.some((rx) => rx.test(norm) || rx.test(squeezed))) {
    return true;
  }

  // 2) Context stems - only if price/unit/deal verbs are nearby
  const ctx = RX_DRUG_CONTEXT.some((rx) => rx.test(norm) || rx.test(squeezed));

  if (!ctx) {
    return false;
  }

  const hasPriceOrUnit =
    near(RX_DRUG_CONTEXT, [...RX_PRICE, ...RX_UNIT], norm) ||
    near(RX_DRUG_CONTEXT, [...RX_PRICE, ...RX_UNIT], squeezed);
  const hasDeal =
    near(RX_DRUG_CONTEXT, RX_DEAL, norm) ||
    near(RX_DRUG_CONTEXT, RX_DEAL, squeezed);

  return hasPriceOrUnit || hasDeal;
};
