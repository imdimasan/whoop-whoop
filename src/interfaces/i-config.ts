import type { TOpenAIModel } from "../config/models";

export interface IConfig {
  telegram: {
    botToken: string;
    botUsername: string;
  };
  openai: {
    apiKey: string;
    model: TOpenAIModel;
  };
  images: {
    dailyLimit: number;
    minConfidence: number;
  };
  moderation: {
    thresholds: {
      ban: number;
      mute: number;
      delete: number;
    };
  };
  logging: {
    level: string;
  };
}
