import logger from "../utils/logger";
import { config } from "../config/index.js";

// One account must not use up the shared daily cap (an album counts 10)
const MAX_IMAGES_PER_USER_PER_DAY = 30;

// Counters for the current UTC day; they reset on restart, which errs on the
// side of checking more images, not fewer
let budgetDay = "";
let imagesToday = 0;
let limitReported = false;
const imagesPerUser = new Map<number, number>();

/**
 * Starts fresh counters when the UTC day changes
 * @example
 * rollDay();
 */
const rollDay = (): void => {
  const today = new Date().toISOString().slice(0, 10);

  if (today !== budgetDay) {
    budgetDay = today;
    imagesToday = 0;
    limitReported = false;
    imagesPerUser.clear();
  }
};

/**
 * How many more images of this user may be analyzed today (the daily cap
 * protects the bill during raids; 0 means skip the image check)
 * @example
 * const allowed = remainingImageBudget(userId);
 */
export const remainingImageBudget = (userId: number): number => {
  rollDay();

  const limit = config.images.dailyLimit;
  const globalLeft = Math.max(0, limit - imagesToday);
  const userLeft = Math.max(
    0,
    MAX_IMAGES_PER_USER_PER_DAY - (imagesPerUser.get(userId) ?? 0)
  );

  if (globalLeft === 0 && !limitReported) {
    logger.warn(
      limit === 0
        ? "Image analysis is disabled (IMAGE_ANALYSIS_DAILY_LIMIT=0)"
        : "Daily image analysis limit reached: photos are not checked until UTC midnight",
      { limit }
    );
    limitReported = true;
  }

  return Math.min(globalLeft, userLeft);
};

/**
 * Counts images that are actually sent for analysis
 * @example
 * consumeImageBudget(userId, images.length);
 */
export const consumeImageBudget = (userId: number, count: number): void => {
  if (count <= 0) {
    return;
  }

  rollDay();
  imagesToday += count;
  imagesPerUser.set(userId, (imagesPerUser.get(userId) ?? 0) + count);
};
