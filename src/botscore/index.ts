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

const adapter: Adapter = BOT_SCORE_PROVIDER
  ? require(`./providers/${BOT_SCORE_PROVIDER}.ts`).default
  : {};

export const getBotScore = async (username: string) => {
  if (!adapter) {
    return {
      botScore: -1,
    };
  }

  return adapter.getBotScore(username);
};
