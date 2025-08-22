export interface IConfig {
  telegram: {
    botToken: string;
    botUsername: string;
  };
  openai: {
    apiKey: string;
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
