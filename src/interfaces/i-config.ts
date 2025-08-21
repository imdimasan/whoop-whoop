export interface IConfig {
  telegram: {
    botToken: string;
    botUsername: string;
  };
  openai: {
    apiKey: string;
  };
  moderation: {
    maxWarnings: number;
    muteDurationMinutes: number;
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
