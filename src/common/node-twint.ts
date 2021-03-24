import * as logging from 'common/logging';

import { execCmd } from 'common/cmd-utils';
import fs from 'fs';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';

interface ReplyTo {
  screen_name: string;
  name: string;
  id: string;
}

interface Tweet {
  id: string;
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
    languages: {
      [key: string]: number;
    };
    associatedHashtags: {
      [key: string]: number;
    };
  };
}

export interface TwintOptions {
  resumeFromTweetId?: string;
  nbTweetsToScrapeFirstTime?: number;
  nbTweetsToScrape?: number;
}

const NB_TWEETS_TO_SCRAPE_FIRST_TIME_DEFAULT = 1000;
const NB_TWEETS_TO_SCRAPE_DEFAULT = 3000;
const TWINT_PATH = process.env.TWINT_PATH || 'twint';

export default class Twint {
  private tweets: Tweet[];
  private hashtag: string;
  private originalFilePath: string;
  private formattedFilePath: string;
  private lastEvaluatedTweet?: Tweet;
  private nbTweetsToScrape?: number;
  private resumeFromTweetId?: string;
  private dir: string;
  static platformId = 'twitter';

  static getVersion = () => {
    return execCmd('pip show twint | grep Version');
  };

  constructor(
    hashtag: string,
    {
      resumeFromTweetId,
      nbTweetsToScrapeFirstTime = NB_TWEETS_TO_SCRAPE_FIRST_TIME_DEFAULT,
      nbTweetsToScrape = NB_TWEETS_TO_SCRAPE_DEFAULT,
    }: TwintOptions = {}
  ) {
    this.hashtag = hashtag;
    this.dir = path.join(os.tmpdir(), 'information-manipulation-analyzer', hashtag);
    this.resumeFromTweetId = resumeFromTweetId;
    logging.info(
      `Creating Twint instance for ${hashtag} in dir ${this.dir} with resumeFromTweetId ${this.resumeFromTweetId}`
    );
    fs.mkdirSync(this.dir, { recursive: true });
    this.originalFilePath = `${this.dir}/original.json`;
    this.formattedFilePath = `${this.dir}/formatted.json`;
    this.nbTweetsToScrape = !resumeFromTweetId ? nbTweetsToScrapeFirstTime : nbTweetsToScrape;
    this.downloadTweets();
  }

  private downloadTweets = () => {
    if (this.tweets) {
      return this.tweets;
    }

    if (!fs.existsSync(this.formattedFilePath)) {
      logging.debug(
        `Download tweets to ${this.formattedFilePath} ${
          this.resumeFromTweetId ? `and resume from ${this.resumeFromTweetId}` : ''
        }`
      );
      const cmd = `${TWINT_PATH} -s "#${this.hashtag}${
        this.resumeFromTweetId ? ` max_id:${this.resumeFromTweetId}` : ''
      }" --limit ${this.nbTweetsToScrape} --json -o ${this.originalFilePath}`;
      execCmd(cmd);
      try {
        // id are number that are tool big to be parsed by jq so change them in string
        execCmd(`perl -i -pe 's/"id":\\s(\\d+)/"id":"$1"/g' ${this.originalFilePath}`);
        // json format given by twint is weird and we need jq to recreate them
        execCmd(`(jq -s . < ${this.originalFilePath}) > ${this.formattedFilePath}`);
      } catch (e) {
        logging.error(e); // eslint-disable-line
        // TODO either end with error or fallback gently, depending on the error
        execCmd(`echo "[]" > ${this.formattedFilePath}`);
      }
    }
    delete require.cache[require.resolve(this.formattedFilePath)];
    this.tweets = require(this.formattedFilePath);

    if (this.resumeFromTweetId && this.tweets.length > 1) {
      // when resuming, first tweet is the same as last previous tweet so skip it
      this.tweets.pop();
    }

    // DEBUG
    // this.tweets.forEach((tweet, i) => {
    //   console.log(i, tweet?.id, tweet?.date, tweet?.time, tweet?.username, tweet?.tweet);
    // });
    return this.tweets;
  };

  public getVolumetry = () => {
    logging.info(
      `Formatting ${this.tweets.length} into volumetry for #${this.hashtag} ${
        this.resumeFromTweetId ? `from tweetId: ${this.resumeFromTweetId}` : ''
      }`
    );

    // FIXME PERF REDUCE
    const volumetry = this.tweets.reduce((acc: Volumetry, tweet) => {
      const date = `${tweet.created_at.substr(0, 13)}:00:00`;

      const associatedHashtags = acc[date]?.associatedHashtags || {};
      tweet.hashtags.forEach((hashtag) => {
        if (hashtag === this.hashtag) {
          return;
        }
        associatedHashtags[hashtag] = (associatedHashtags[hashtag] || 0) + 1;
      });

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
          languages: {
            ...(acc[date]?.languages || {}),
            [tweet.language]: (acc[date]?.languages[tweet.language] || 0) + 1,
          },
          associatedHashtags,
        },
      };
    }, {});
    this.lastEvaluatedTweet = this.tweets[this.tweets.length - 1];

    return volumetry;
  };

  public getLastEvaluatedTweet = () => {
    logging.info(
      `Get Last Evaluated tweet for ${this.hashtag} ${this.lastEvaluatedTweet?.created_at}`
    );
    return this.lastEvaluatedTweet;
  };

  public purge = () => {
    logging.info(`Remove ${this.dir}`);
    rimraf.sync(this.dir);
  };
}
