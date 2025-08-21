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
