import peren from './providers/peren';

export interface BotScoreResponse {
  botScore?: number;
  botScoreProvider?: string;
  botScoreUpdatedAt?: Date | string;
  botScoreMetadata?: any;
}

export interface Adapter {
  getBotScore: (username: string) => Promise<BotScoreResponse>;
}

const BOT_SCORE_PROVIDER = process.env.BOT_SCORE_PROVIDER;

const adapter: Adapter = BOT_SCORE_PROVIDER === 'peren' ? peren : ({} as Adapter);

export const getBotScore = async (username: string) => {
  if (!adapter) {
    return {
      botScore: -1,
    };
  }

  return adapter.getBotScore(username);
};
