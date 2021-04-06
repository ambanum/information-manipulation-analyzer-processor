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
  resumeSinceTweetId?: string;
  resumeUntilTweetId?: string;
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
  private firstProcessedTweet?: Tweet;
  private lastProcessedTweet?: Tweet;
  private nbTweetsToScrape?: number;
  private filter?: string;
  private dir: string;
  static platformId = 'twitter';

  static getVersion = () => {
    return execCmd('pip show twint | grep Version');
  };

  constructor(
    hashtag: string,
    {
      resumeUntilTweetId,
      resumeSinceTweetId,
      nbTweetsToScrapeFirstTime = NB_TWEETS_TO_SCRAPE_FIRST_TIME_DEFAULT,
      nbTweetsToScrape = NB_TWEETS_TO_SCRAPE_DEFAULT,
    }: TwintOptions = {}
  ) {
    this.hashtag = hashtag;
    this.dir = path.join(os.tmpdir(), 'information-manipulation-analyzer', hashtag);

    this.filter = resumeUntilTweetId
      ? `max_id:${resumeUntilTweetId}`
      : resumeSinceTweetId
      ? `since_id:${resumeSinceTweetId}`
      : '';

    this.nbTweetsToScrape = !this.filter ? nbTweetsToScrapeFirstTime : nbTweetsToScrape;

    logging.info(`Using Twint to search ${this.nbTweetsToScrape} ${hashtag} ${this.filter}`);
    logging.debug(`in dir ${this.dir}`);
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
      logging.debug(`Download tweets to ${this.formattedFilePath} ${this.filter}`);
      const cmd = `${TWINT_PATH} -s "#${this.hashtag}${
        this.filter ? ` ${this.filter}` : ''
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

    this.firstProcessedTweet = this.tweets[0];
    this.lastProcessedTweet = this.tweets[this.tweets.length - 1];

    if (this.filter) {
      // remove last beginning tweet to not count it twice
      this.tweets = this.tweets.filter((t) => t.id !== this.filter.split(':')[1]);
    }

    // DEBUG
    // this.tweets.forEach((tweet, i) => {
    //   console.log(i, tweet?.id, tweet?.date, tweet?.time, tweet?.username, tweet?.tweet);
    // });
    return this.tweets;
  };

  public getVolumetry = () => {
    logging.info(
      `Formatting ${this.tweets.length} into volumetry for #${this.hashtag} ${this.filter}`
    );

    // FIXME PERF REDUCE
    const volumetry = this.tweets.reduce((acc: Volumetry, tweet) => {
      const date = `${tweet.created_at.substr(0, 13)}:00:00`;

      const associatedHashtags = acc[date]?.associatedHashtags || {};
      tweet.hashtags.forEach((hashtag) => {
        if (
          this.hashtag ===
          hashtag
            // replace all accents with plain
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            // kepp only allowed characters in hashtag
            .replace(/[^a-zA-Z\d_]/gim, '')
            .toLowerCase()
        ) {
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

    return volumetry;
  };

  public getLastProcessedTweet = () => {
    logging.debug(
      `Get Last Processed tweet for ${this.hashtag} ${this.lastProcessedTweet?.created_at}`
    );
    return this.lastProcessedTweet;
  };

  public getFirstProcessedTweet = () => {
    logging.debug(
      `Get First Processed tweet for ${this.hashtag} ${this.firstProcessedTweet?.created_at}`
    );
    return this.firstProcessedTweet;
  };

  public purge = () => {
    logging.debug(`Remove ${this.dir}`);
    rimraf.sync(this.dir);
  };
}
