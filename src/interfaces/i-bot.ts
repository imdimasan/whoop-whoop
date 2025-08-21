import { Context } from "grammy";
import { IUserWarning } from "./i-user";

/**
 * Bot command types
 */
export type TBotCommand = "start" | "help" | "stats" | "settings";

/**
 * Extended context with session data
 */
export interface IBotContext extends Context {
  session?: {
    warnings: Map<number, IUserWarning>;
  };
}
