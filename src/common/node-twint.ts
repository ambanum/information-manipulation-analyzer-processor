import { execCmd } from 'common/cmd-utils';
import * as logging from 'common/logging';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface ReplyTo {
  screen_name: string;
  name: string;
  id: string;
}

interface Tweet {
  id: Date;
  conversation_id: string;
  created_at: string;
  date: string;
  time: string;
  timezone: string;
  user_id: number;
  username: string;
  name: string;
  place: string;
  tweet: string;
  language: string;
  mentions: any[];
  urls: any[];
  photos: any[];
  replies_count: number;
  retweets_count: number;
  likes_count: number;
  hashtags: string[];
  cashtags: string[];
  link: string;
  retweet: boolean;
  quote_url: string;
  video: number;
  thumbnail: string;
  near: string;
  geo: string;
  source: string;
  user_rt_id: string;
  user_rt: string;
  retweet_id: string;
  reply_to: ReplyTo[];
  retweet_date: string;
  translate: string;
  trans_src: string;
  trans_dest: string;
}

export interface Volumetry {
  [key: string]: {
    tweets: number;
    retweets: number;
    likes: number;
    quotes: number;
    usernames: {
      [key: string]: number;
    };
  };
}

export default class Twint {
  private tweets: Tweet[];
  private hashtag: string;
  private originalFilePath: string;
  private formattedFilePath: string;
  private dir: string;
  static platformId = 'twitter';

  static getVersion = () => {
    return execCmd('pip show twint | grep Version');
  };

  constructor(hashtag: string) {
    this.hashtag = hashtag;
    this.dir = path.join(os.tmpdir(), 'information-manipulation-analyzer', hashtag);
    logging.info(`Creating Twint instance for ${hashtag} in dir ${this.dir}`);
    fs.mkdirSync(this.dir, { recursive: true });
    this.originalFilePath = `${this.dir}/original.json`;
    this.formattedFilePath = `${this.dir}/formatted.json`;
    this.downloadTweets();
  }

  private downloadTweets = () => {
    if (this.tweets) {
      return this.tweets;
    }

    if (!fs.existsSync(this.formattedFilePath)) {
      logging.info(`Download tweets to ${this.formattedFilePath}`);
      execCmd(`twint -s "${this.hashtag}" --limit 3000 --json -o ${this.originalFilePath}`);
      execCmd(`(jq -s . < ${this.originalFilePath}) > ${this.formattedFilePath}`);
    }

    this.tweets = require(this.formattedFilePath);

    return this.tweets;
  };

  public getVolumetry = () => {
    logging.info(`Get volumetry for #${this.hashtag}`);
    const volumetry = this.tweets.reduce((acc: Volumetry, tweet) => {
      const date = `${tweet.created_at.substr(0, 13)}:00:00`;
      return {
        ...acc,
        [date]: {
          tweets: (acc[date]?.tweets || 0) + 1,
          retweets: (acc[date]?.retweets || 0) + tweet.retweets_count,
          likes: (acc[date]?.likes || 0) + tweet.likes_count,
          quotes: (acc[date]?.quotes || 0) + tweet.replies_count,
          usernames: {
            ...(acc[date]?.usernames || {}),
            [tweet.username]: (acc[date]?.usernames[tweet.username] || 0) + 1,
          },
        },
      };
    }, {});
    return volumetry;
  };

  public getFirstOccurence = () => {
    logging.info(`Get First occurence for #${this.hashtag}`);

    // const volumetry = this.tweets.reduce((acc: Volumetry, tweet) => {
    //   const date = `${tweet.created_at.substr(0, 13)}:00:00`;
    //   return {
    //     ...acc,
    //     [date]: {
    //       tweets: (acc[date]?.tweets || 0) + 1,
    //       retweets: (acc[date]?.retweets || 0) + tweet.retweets_count,
    //       usernames: {
    //         ...(acc[date]?.usernames || {}),
    //         [tweet.username]: (acc[date]?.usernames[tweet.username] || 0) + 1,
    //       },
    //     },
    //   };
    // }, {});
    return '';
  };
}
