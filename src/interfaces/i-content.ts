/**
 * Categories the classifier may return; the response schema is built from
 * this list, so a category added here becomes valid output right away
 */
export const CONTENT_TYPES = [
  "drugs",
  "jobs",
  "gambling",
  "tickets",
  "financial",
  "scam",
  "default",
] as const;

export type TContentType = (typeof CONTENT_TYPES)[number];
