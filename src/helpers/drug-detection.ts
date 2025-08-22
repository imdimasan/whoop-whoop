/**
 * Normalization & Regex helpers
 */
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
};

/**
 * Latin <-> Cyrillic: visually similar letters in one «canon»
 */
const CONFUSABLES: Record<string, string> = {
  а: "a",
  a: "a",
  е: "e",
  e: "e",
  о: "o",
  o: "o",
  р: "p",
  p: "p",
  с: "c",
  c: "c",
  у: "y",
  y: "y",
  х: "x",
  x: "x",
  к: "k",
  k: "k",
  м: "m",
  m: "m",
  т: "t",
  t: "t",
  н: "h",
  h: "h",
  в: "b",
  b: "b",
};

const SEP = String.raw`[\s\p{P}\p{S}_-]*`;

/**
 * Basic normalization without aggressive removal of separators
 */
export const normalizeBasic = (input: string): string => {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[013456789]/g, (d) => LEET_MAP[d] ?? d)
    .replace(/./gu, (ch) => CONFUSABLES[ch] ?? ch);
};

/**
 * Squeezed version: remove everything except letters/digits to catch t.r.a.v.a
 */
export const squeezeLettersDigits = (input: string): string => {
  return normalizeBasic(input).replace(/[^\p{L}\p{N}]+/gu, "");
};

/**
 * Build regex from stem with separators and repeats allowed
 */
export const stemToRegex = (stem: string, allowRepeats = true): RegExp => {
  const norm = normalizeBasic(stem);
  const parts = Array.from(norm).map((ch) => {
    // build class for letters from CONFUSABLES, otherwise escape
    const base = CONFUSABLES[ch] ?? ch;
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // allow repeats of letters (meeeph, meeeeph)
    return allowRepeats ? `${esc}+` : esc;
  });
  return new RegExp(parts.join(SEP), "iu");
};

/**
 * Check proximity (±window characters) - for contextual words
 */
export const near = (
  a: RegExp[],
  b: RegExp[],
  text: string,
  window = 35
): boolean => {
  const hitsA: number[] = [];
  a.forEach((rx) => {
    let m: RegExpExecArray | null;
    const regexp = new RegExp(
      rx,
      rx.flags.includes("g") ? rx.flags : rx.flags + "g"
    );
    while ((m = regexp.exec(text))) hitsA.push(m.index);
  });
  if (!hitsA.length) return false;

  const hitsB: number[] = [];

  b.forEach((rx) => {
    let m: RegExpExecArray | null;
    const regexp = new RegExp(
      rx,
      rx.flags.includes("g") ? rx.flags : rx.flags + "g"
    );
    while ((m = regexp.exec(text))) hitsB.push(m.index);
  });

  return hitsA.some((i) => hitsB.some((j) => Math.abs(i - j) <= window));
};
