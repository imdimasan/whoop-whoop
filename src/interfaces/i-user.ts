/**
 * User warning tracking
 */
export interface IUserWarning {
  userId: number;
  chatId: number;
  count: number;
  lastWarning: Date;
  reasons: string[];
}

/**
 * User report tracking
 */
export interface IUserReport {
  targetUserId: number;
  chatId: number;
  reporterIds: Set<number>;
  reportCount: number;
  firstReport: Date;
  lastReport: Date;
}
