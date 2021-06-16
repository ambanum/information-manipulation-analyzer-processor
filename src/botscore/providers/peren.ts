import { Adapter } from '../index';
import axios from 'axios';
const PEREN_API_KEY = process.env.PEREN_API_KEY;

interface PerenBotScoreResponse {
  bot_score: number;
  base_value: number;
  shap_values: {
    statuses_count: number;
    followers_count: number;
    friends_count: number;
    favourites_count: number;
    listed_count: number;
    default_profile: number;
    profile_use_background_image: number;
    verified: number;
    label: number;
    description_length: number;
    name_length: number;
    num_digits_in_name: number;
    screen_name_length: number;
    num_digits_in_screen_name: number;
    tweet_frequence: number;
    followers_growth_rate: number;
    friends_growth_rate: number;
    favourites_growth_rate: number;
    listed_growth_rate: number;
  };
}

const getBotScore: Adapter['getBotScore'] = async (username: string) => {
  const { data } = await axios.get<PerenBotScoreResponse>(
    `https://bots.peren.fr/twitter?id=${username}&key=${PEREN_API_KEY}`
  );

  const { bot_score, ...metadata } = data;

  return {
    botScore: data.bot_score,
    botScoreProvider: 'peren',
    botScoreUpdatedAt: new Date(),
    botScoreMetadata: metadata,
  };
};

const adapter: Adapter = {
  getBotScore,
};

export default adapter;
