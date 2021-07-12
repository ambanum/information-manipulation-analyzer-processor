import { Adapter } from '../index';
import { execCmd } from 'common/cmd-utils';

const BOT_SCORE_SOCIAL_NETWORKS_PATH = process.env.BOT_SCORE_SOCIAL_NETWORKS_PATH || 'botfinder';

export interface BotScore {
  botScore: number;
  details: {
    base_value: number;
    statuses_count: number;
    followers_count: number;
    favourites_count: number;
    friends_count: number;
    listed_count: number;
    default_profile: number;
    profile_use_background_image: number;
    verified: number;
    age: number;
    tweet_frequence: number;
    followers_growth_rate: number;
    favourites_growth_rate: number;
    listed_growth_rate: number;
    friends_followers_ratio: number;
    followers_friend_ratio: number;
    name_length: number;
    screenname_length: number;
    name_digits: number;
    screen_name_digits: number;
    description_length: number;
  };
}

const getBotScore: Adapter['getBotScore'] = async (username: string, options) => {
  let cmd: string;

  if (options.rawJson) {
    cmd = `${BOT_SCORE_SOCIAL_NETWORKS_PATH} --rawjson '${options.rawJson.replace(/'/gi, ' ')}'`;
  } else {
    cmd = `${BOT_SCORE_SOCIAL_NETWORKS_PATH} --username  ${username}`;
  }
  const result = execCmd(cmd);

  const { botScore, details }: BotScore = JSON.parse(result);

  return {
    botScore,
    botScoreProvider: 'social-networks-bot-finder',
    botScoreUpdatedAt: new Date(),
    botScoreMetadata: details,
  };
};

const adapter: Adapter = {
  getBotScore,
};

export default adapter;
