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
  "фен",
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
];

const RX_DRUG_STRONG = DRUG_STEMS_STRONG.map((s) => stemToRegex(s));
const RX_DRUG_CONTEXT = DRUG_STEMS_CONTEXT.map((s) => stemToRegex(s));
const RX_PRICE = PRICE_STEMS.map((s) => stemToRegex(s, false));
const RX_UNIT = UNIT_STEMS.map((s) => stemToRegex(s, false));
const RX_DEAL = DEAL_STEMS.map((s) => stemToRegex(s, false));

/**
 * Main check for "drugs"
 */
export const hasDrugKeywordsSmart = (message: string): boolean => {
  const norm = normalizeBasic(message);
  const squeezed = squeezeLettersDigits(message);

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
