import botFinder from './providers/social-networks-bot-finder';
import peren from './providers/peren';

export interface BotScoreResponse {
  botScore?: number;
  botScoreProvider?: string;
  botScoreUpdatedAt?: Date | string;
  botScoreMetadata?: any;
}
export type BotScoresResponse = BotScoreResponse[];

export interface GetBotScoreOptions {
  rawJson?: string;
}

export interface Adapter {
  getBotScore: (username: string, options?: GetBotScoreOptions) => Promise<BotScoreResponse>;
  getBotScores?: (options?: GetBotScoreOptions) => Promise<BotScoresResponse>;
}

const BOT_SCORE_PROVIDER = process.env.BOT_SCORE_PROVIDER;

const adapter: Adapter =
  BOT_SCORE_PROVIDER === 'peren'
    ? peren
    : BOT_SCORE_PROVIDER === 'social-networks-bot-finder'
    ? botFinder
    : ({} as Adapter);

export const getBotScore = async (username: string, options: GetBotScoreOptions = {}) => {
  if (!adapter) {
    return {
      botScore: -1,
    };
  }

  return adapter.getBotScore(username, options);
};
export const getBotScores = async (options: GetBotScoreOptions = {}) => {
  if (!adapter) {
    return {
      botScore: -1,
    };
  }

  return adapter.getBotScores(options);
};
