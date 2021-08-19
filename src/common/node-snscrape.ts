import * as logging from 'common/logging';

import { execCmd } from 'common/cmd-utils';
import fs from 'fs';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';

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

export interface TweetPlace {
  fullName: string;
  name: string;
  type: string;
  country: string;
  countryCode: string;
}

export interface Media {
  _type: string;
  thumbnailUrl?: string;
  variants?: {
    _type: string;
    contentType: string;
    url: string;
    bitrate: number | null;
  }[];
  duration?: number;
  views?: number;

  previewUrl?: string;
  fullUrl?: string;
}
export interface Tweet {
  url: string;
  date: string;
  content: string;
  renderedContent: string;
  id: string;
  user: User;
  outlinks: string[] | null;
  tcooutlinks: string[] | null;
  replyCount: number | null;
  retweetCount: number | null;
  likeCount: number | null;
  quoteCount: number | null;
  conversationId: number | null;
  lang: string | null;
  source: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  media: null | Media[];
  retweetedTweet: Tweet | null;
  mentionedUsers: User[];
  coordinates?: { latitude: string; longitude: string } | null;
  inReplyToTweetId: string | null;
  quotedTweet: Tweet | null;
  place: TweetPlace;
  inReplyToUser: User;
  hashtags: string[] | null;
  cashtags: string[] | null;
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
  logger?: logging.Logger;
}

const NB_TWEETS_TO_SCRAPE_FIRST_TIME_DEFAULT = 1000;
const NB_TWEETS_TO_SCRAPE_DEFAULT = 3000;
const SNSCRAPE_PATH = process.env.SNSCRAPE_PATH || 'snscrape';

export default class Snscrape {
  private tweets: Tweet[];
  private search: string;
  private originalFilePath: string;
  private formattedFilePath: string;
  private firstProcessedTweet?: Tweet;
  private lastProcessedTweet?: Tweet;
  private nbTweetsToScrape?: number;
  private filter?: string;
  private dir: string;
  private logger: logging.Logger;
  static platformId = 'twitter';

  static getVersion = () => {
    return execCmd(`${SNSCRAPE_PATH} --version`);
  };
  static getPath = () => {
    return SNSCRAPE_PATH;
  };

  constructor(
    search: string,
    {
      resumeUntilTweetId,
      resumeSinceTweetId,
      nbTweetsToScrapeFirstTime = NB_TWEETS_TO_SCRAPE_FIRST_TIME_DEFAULT,
      nbTweetsToScrape = NB_TWEETS_TO_SCRAPE_DEFAULT,
      logger,
    }: SnscrapeOptions = {}
  ) {
    this.logger = logger || logging.getLogger();
    this.search = search;

    this.dir = path.join(
      os.tmpdir(),
      'information-manipulation-analyzer',
      search.replace(/[/\\?&%*:$|"<>]/g, '-') // replace invalid characters for a folder
    );

    this.filter = resumeUntilTweetId
      ? `max_id:${resumeUntilTweetId}`
      : resumeSinceTweetId
      ? `since_id:${resumeSinceTweetId}`
      : '';

    this.nbTweetsToScrape = !this.filter ? nbTweetsToScrapeFirstTime : nbTweetsToScrape;

    this.logger.info(`Using Snscrape to search ${this.nbTweetsToScrape} ${search} ${this.filter}`);
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
      } --jsonl twitter-search "+${this.search.replace('$', '\\$')}${
        this.filter ? ` ${this.filter}` : ''
      }" > ${this.originalFilePath}`;
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
      `Formatting ${this.tweets.length} into volumetry for ${this.search} ${this.filter}`
    );

    // FIXME PERF REDUCE
    const volumetry = this.tweets.reduce((acc: Volumetry, tweet) => {
      if (!tweet) {
        return acc;
      }

      const date = `${tweet.date.replace(/\d\d:\d\d\+(.*)/, '00:00+$1')}`;
      if (!tweet.date.endsWith('+00:00')) {
        this.logger.error('tweet has a date that does not end with +00:00');
        this.logger.error(tweet);
      }

      const associatedHashtags = acc[date]?.associatedHashtags || {};

      (tweet.hashtags || []).forEach((tweetHashtag) => {
        const existingNumber =
          associatedHashtags[tweetHashtag] && typeof associatedHashtags[tweetHashtag] === 'number'
            ? associatedHashtags[tweetHashtag]
            : 0;

        associatedHashtags[tweetHashtag] = existingNumber + 1;
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
      `Get Last Processed tweet for ${this.search} ${this.lastProcessedTweet?.date}`
    );
    return this.lastProcessedTweet;
  };

  public getFirstProcessedTweet = () => {
    this.logger.debug(
      `Get First Processed tweet for ${this.search} ${this.firstProcessedTweet?.date}`
    );
    return this.firstProcessedTweet;
  };

  public getUsers = (): User[] => {
    this.logger.debug(`Get users from tweets for ${this.search}`);
    const uniqueUsers = {};
    this.tweets.forEach((tweet) => (uniqueUsers[tweet.user.id] = tweet.user));
    return Object.values(uniqueUsers);
  };

  public getTweets = () => {
    return this.tweets;
  };

  static getUser = (
    username: string
  ): { status: 'active' | 'notfound' | 'suspended'; user?: User } => {
    const cmd = `${SNSCRAPE_PATH} --with-entity --max-results 0 --jsonl twitter-user ${username}`;

    try {
      const user = execCmd(cmd);

      if (!user) {
        return {
          status: 'notfound',
        };
      }
      return { status: 'active', user: JSON.parse(user) };
    } catch (e) {
      return {
        status: 'suspended',
      };
    }
  };

  public purge = () => {
    this.logger.debug(`Remove ${this.dir}`);
    rimraf.sync(this.dir);
  };
}
