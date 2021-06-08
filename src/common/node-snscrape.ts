import * as logging from 'common/logging';

import { execCmd } from 'common/cmd-utils';
import fs from 'fs';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';
import { sanitizeHashtag } from 'utils/sanitizer';

interface User {
  username: string;
  displayname: string;
  id: string;
  description: string;
  rawDescription: string;
  descriptionUrls: string[];
  verified: boolean;
  created: string;
  followersCount: number;
  friendsCount: number;
  statusesCount: number;
  favouritesCount: number;
  listedCount: number;
  mediaCount: number;
  location: string;
  protected: boolean;
  linkUrl: null;
  linkTcourl: null;
  profileImageUrl: string;
  profileBannerUrl: string;
  url: string;
}

interface Tweet {
  url: string;
  date: string;
  content: string;
  renderedContent: string;
  id: string;
  user: User;
  outlinks: any[];
  tcooutlinks: any[];
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  quoteCount: number;
  conversationId: number;
  lang: string;
  source: string;
  sourceUrl: string;
  sourceLabel: string;
  media: null;
  retweetedTweet: null;
  quotedTweet: null;
  mentionedUsers: User[];
  coordinates?: string;
  place?: string;
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

export interface SnscrapeOptions {
  resumeSinceTweetId?: string;
  resumeUntilTweetId?: string;
  nbTweetsToScrapeFirstTime?: number;
  nbTweetsToScrape?: number;
  logger?: typeof logging;
}

const NB_TWEETS_TO_SCRAPE_FIRST_TIME_DEFAULT = 1000;
const NB_TWEETS_TO_SCRAPE_DEFAULT = 3000;
const SNSCRAPE_PATH = process.env.SNSCRAPE_PATH || 'snscrape';

export default class Snscrape {
  private tweets: Tweet[];
  private hashtag: string;
  private originalFilePath: string;
  private formattedFilePath: string;
  private firstProcessedTweet?: Tweet;
  private lastProcessedTweet?: Tweet;
  private nbTweetsToScrape?: number;
  private filter?: string;
  private dir: string;
  private logger: typeof logging;
  static platformId = 'twitter';

  static getVersion = () => {
    return execCmd(`${SNSCRAPE_PATH} --version`);
  };
  static getPath = () => {
    return SNSCRAPE_PATH;
  };

  constructor(
    hashtag: string,
    {
      resumeUntilTweetId,
      resumeSinceTweetId,
      nbTweetsToScrapeFirstTime = NB_TWEETS_TO_SCRAPE_FIRST_TIME_DEFAULT,
      nbTweetsToScrape = NB_TWEETS_TO_SCRAPE_DEFAULT,
      logger,
    }: SnscrapeOptions = {}
  ) {
    this.logger = logger || logging;
    this.hashtag = hashtag;
    this.dir = path.join(os.tmpdir(), 'information-manipulation-analyzer', hashtag);

    this.filter = resumeUntilTweetId
      ? `max_id:${resumeUntilTweetId}`
      : resumeSinceTweetId
      ? `since_id:${resumeSinceTweetId}`
      : '';

    this.nbTweetsToScrape = !this.filter ? nbTweetsToScrapeFirstTime : nbTweetsToScrape;

    this.logger.info(`Using Snscrape to search ${this.nbTweetsToScrape} ${hashtag} ${this.filter}`);
    this.logger.debug(`in dir ${this.dir}`);
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
      this.logger.debug(`Download tweets to ${this.formattedFilePath} ${this.filter}`);
      const cmd = `${SNSCRAPE_PATH} --with-entity --max-results ${
        this.nbTweetsToScrape
      } --jsonl twitter-hashtag "${this.hashtag}${this.filter ? ` ${this.filter}` : ''}" > ${
        this.originalFilePath
      }`;
      execCmd(cmd);
      try {
        // id are number that are tool big to be parsed by jq so change them in string
        execCmd(`perl -i -pe 's/"id":\\s(\\d+)/"id":"$1"/g' ${this.originalFilePath}`);
        // json format given by twint is weird and we need jq to recreate them
        execCmd(`(jq -s . < ${this.originalFilePath}) > ${this.formattedFilePath}`);
      } catch (e) {
        this.logger.error(e); // eslint-disable-line

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
    this.logger.info(
      `Formatting ${this.tweets.length} into volumetry for #${this.hashtag} ${this.filter}`
    );

    // FIXME PERF REDUCE
    const volumetry = this.tweets.reduce((acc: Volumetry, tweet) => {
      const date = `${tweet.date.replace(/\d\d:\d\d\+(.*)/, '00:00+$1')}`;
      if (!tweet.date.endsWith('+00:00')) {
        this.logger.error('tweet has a date that does not end with +00:00');
        this.logger.error(tweet);
      }

      const associatedHashtags = acc[date]?.associatedHashtags || {};
      tweet.content
        .split(/[\s\n\r]/gim)
        .filter((v) => v.startsWith('#') && v !== '#')
        .forEach((hashtag) => {
          const sanitizedHashtag = sanitizeHashtag(hashtag);
          if (this.hashtag === sanitizedHashtag) {
            return;
          }
          if (!sanitizedHashtag) {
            this.logger.error(
              `Hashtag "${hashtag}" has been sanitized to an empty string -> skipping ${tweet.content}`
            );
            return;
          }

          const existingNumber =
            associatedHashtags[sanitizedHashtag] &&
            typeof associatedHashtags[sanitizedHashtag] === 'number'
              ? associatedHashtags[sanitizedHashtag]
              : 0;

          associatedHashtags[sanitizedHashtag] = existingNumber + 1;
        });

      return {
        ...acc,
        [date]: {
          tweets: (acc[date]?.tweets || 0) + 1,
          retweets: (acc[date]?.retweets || 0) + tweet.retweetCount,
          likes: (acc[date]?.likes || 0) + tweet.likeCount,
          quotes: (acc[date]?.quotes || 0) + tweet.replyCount,
          usernames: {
            ...(acc[date]?.usernames || {}),
            [tweet.user.username]: (acc[date]?.usernames[tweet.user.username] || 0) + 1,
          },
          languages: {
            ...(acc[date]?.languages || {}),
            [tweet.lang]: (acc[date]?.languages[tweet.lang] || 0) + 1,
          },
          associatedHashtags,
        },
      };
    }, {});
    return volumetry;
  };

  public getLastProcessedTweet = () => {
    this.logger.debug(
      `Get Last Processed tweet for ${this.hashtag} ${this.lastProcessedTweet?.date}`
    );
    return this.lastProcessedTweet;
  };

  public getFirstProcessedTweet = () => {
    this.logger.debug(
      `Get First Processed tweet for ${this.hashtag} ${this.firstProcessedTweet?.date}`
    );
    return this.firstProcessedTweet;
  };

  public getUsers = (): User[] => {
    this.logger.debug(`Get users from tweets for ${this.hashtag}`);
    const uniqueUsers = {};
    this.tweets.forEach((tweet) => (uniqueUsers[tweet.user.id] = tweet.user));
    return Object.values(uniqueUsers);
  };

  public getTweets = () => {
    return this.tweets;
  };

  public purge = () => {
    this.logger.debug(`Remove ${this.dir}`);
    rimraf.sync(this.dir);
  };
}
