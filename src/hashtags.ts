import * as HashtagVolumetryManager from 'managers/HashtagVolumetryManager';
import * as ProcessorManager from 'managers/ProcessorManager';
import * as UserManager from 'managers/UserManager';
import * as logging from 'common/logging';

import { HashtagStatuses, QueueItemActionTypes, QueueItemStatuses } from 'interfaces';

import { Client } from '@elastic/elasticsearch';
import QueueItemManager from 'managers/QueueItemManager';
import Scraper from 'common/node-snscrape';
import omit from 'lodash/fp/omit';

const WAIT_TIME = 1 * 1000; // 1s
const NB_TWEETS_TO_SCRAPE = process.env?.NB_TWEETS_TO_SCRAPE;
const MIN_PRIORITY = parseInt(process.env?.MIN_PRIORITY || '0', 10);
const NEXT_PROCESS_IN_FUTURE = 60 * 60 * 1000;
const logPrefix = '[hashtag]';

// version to change when data retrieved is changed
// this way we can display in the frontend a note saying that
// in order to have the full features, you need to relaunch the process
// v2: added users storing
const SCRAPE_VERSION = 2;
const client = new Client({ node: 'http://localhost:9200' });

// Because I could not find other way in tyepscript to get functions of a class
type Properties<T> = { [K in keyof T]: T[K] };

export default class HashtagPoller {
  private processorId: string;
  private logger: typeof logging;
  private queueItemManager: QueueItemManager;

  constructor({ processorId }) {
    this.processorId = processorId;
    this.logger = {
      debug: (...args: any[]) => logging.debug(logPrefix, ...args),
      info: (...args: any[]) => logging.info(logPrefix, ...args),
      warn: (...args: any[]) => logging.warn(logPrefix, ...args),
      error: (...args: any[]) => logging.error(logPrefix, ...args),
    };
    this.queueItemManager = new QueueItemManager({
      logger: this.logger,
      processorId,
      scrapeVersion: SCRAPE_VERSION,
    });
  }

  async init() {
    await this.queueItemManager.resetOutdated(QueueItemActionTypes.HASHTAG);
  }

  async pollHashtags() {
    const { item, count } = await this.queueItemManager.getPendingHashtags(MIN_PRIORITY);

    if (!item) {
      await ProcessorManager.update(this.processorId, { lastPollAt: new Date() });
      this.logger.debug(`No more items to go, waiting ${WAIT_TIME / 1000}s`);
      return setTimeout(() => process.nextTick(this.pollHashtags.bind(this)), WAIT_TIME);
    }

    this.logger.info(`------- ${count} item(s) to go -------`);

    const { lastEvaluatedUntilTweetId, lastEvaluatedSinceTweetId } = item?.metadata || {};

    const isRequestForPreviousData = !!lastEvaluatedUntilTweetId;
    const isRequestForNewData = !!lastEvaluatedSinceTweetId;
    const isFirstRequest = !isRequestForPreviousData && !isRequestForNewData;

    const session = undefined;

    const initScraper = (retries = 3): Scraper => {
      try {
        const scraper = new Scraper(item.hashtag.name, {
          resumeUntilTweetId: lastEvaluatedUntilTweetId,
          resumeSinceTweetId: lastEvaluatedSinceTweetId,
          nbTweetsToScrape: NB_TWEETS_TO_SCRAPE ? +NB_TWEETS_TO_SCRAPE : undefined,
          logger: this.logger,
        });
        return scraper;
      } catch (e) {
        if (retries - 1 >= 0) {
          this.logger.warn(
            `Scraper for ${item._id} (#${item.hashtag.name}) could not be processed correctly retrying again ${retries} times`
          );
          return initScraper(retries - 1);
        }

        throw e;
      }
    };

    try {
      await this.queueItemManager.startProcessingHashtag(item, {
        previous: isRequestForPreviousData,
        next: isRequestForNewData,
      });

      await ProcessorManager.update(this.processorId, { lastProcessedAt: new Date() });

      let scraper = initScraper();

      // "agg_metric": {
      //   "type": "aggregate_metric_double",
      //   "metrics": [ "min", "max", "sum", "value_count" ],
      //   "default_metric": "max"
      // }

      // save volumetry
      // ELASTIC SEARCH
      const tweets = scraper.getTweets();
      const users = scraper.getUsers();

      if (tweets.length > 0) {
        const bodyTweets = tweets.flatMap((doc) => [
          { index: { _index: 'tweets', _id: doc.id } },
          omit(['_type'])(doc),
        ]);
        const bodyUsers = users.flatMap((doc) => [
          { index: { _index: 'users', _id: doc.id } },
          omit(['_type'])(doc),
        ]);

        const aTweets: any = tweets.map((doc) => {
          // @ts-ignore
          const t: any = omit([
            '_type', // induce error on save
            'url', // can be recreated with a dynamic field `https://twitter.com/${username}/status/${id}`
            'tcooutlinks', // same as outlinks
            'renderedContent', // not used as we use real `content` instead
            'source', // not used as can be recalculated easily with `sourceUrl` instead
            'sourceLabel', // not used as can be recalculated easily with `sourceUrl` instead
          ])(doc);
          t.user = t.user.username;
          t.inReplyToUser = t.inReplyToUser ? t.inReplyToUser.id : null;
          t.quotedTweet = t.quotedTweet ? t.quotedTweet.id : null;
          t.retweetedTweet = t.retweetedTweet ? t.retweetedTweet.id : null;
          t.mentionedUsers = t.mentionedUsers ? t.mentionedUsers.map((u) => u.username) : null;
          t.media = t.media
            ? t.media.map((media) => {
                const filteredMedia: any = omit([
                  'variants', // induce error on save
                  '_type', // induce error on save
                ])(media);
                filteredMedia.type = media._type
                  .replace('snscrape.modules.twitter.', '')
                  .toLowerCase();
                if (media.variants) {
                  const variants: any[] = media.variants.sort(
                    (a: any, b: any) => a.bitrate - b.bitrate
                  );
                  const variant = variants[0];
                  filteredMedia.fullUrl = variant.url;
                  filteredMedia.bitrate = variant.bitrate;
                  filteredMedia.contentType = variant.contentType;
                }
                return filteredMedia;
              })
            : null;
          return t;
        });

        const aUsers: any = users.map((doc) => {
          const t: any = omit([
            '_type', // induce error on save
            'url', // can be recreated with a dynamic field `https://twitter.com/${username}`
            'rawDescription', // use description instead
            'descriptionUrls', // as we do not use rawDescription
            'linkTcourl', // same as outlinks
          ])(doc);
          return t;
        });

        // {
        //   "date": "2021-08-11T20:55:03+00:00",
        //   "content": "🔔Movie Theater AMC to Accept Bitcoin Payments by Year-End🎥🎬 @AMCTheatres #BTC #Bitcoin \nhttps://t.co/Ywxf4cHks0 https://t.co/anECtqsQTm",
        //   "id": "1425561421144858628",
        //   "user": "remitano",
        //   "replyCount": 0,
        //   "retweetCount": 1,
        //   "likeCount": 4,
        //   "quoteCount": 0,
        //   "conversationId": 1425561421144858600,
        //   "lang": "en",
        //   "sourceUrl": "https://www.hootsuite.com",
        //   "outlinks": [
        //     "https://www.cryptoglobe.com/latest/2021/08/movie-theater-chain-amc-to-accept-bitcoin-payments-by-year-end/"
        //   ],
        //   "media": [
        //     "https://pbs.twimg.com/media/E8icju3XEAsaRPu?format=jpg&name=large"
        //   ],
        //   "retweetedTweet": null,
        //   "quotedTweet": null,
        //   "inReplyToTweetId": null,
        //   "inReplyToUser": null,
        //   "mentionedUsers": [
        //     "AMCTheatres"
        //   ],
        //   "coordinates": null,
        //   "place": null,
        //   "hashtags": [
        //     "BTC",
        //     "Bitcoin"
        //   ],
        //   "cashtags": null
        // }

        // {
        //   "username": "jaygould",
        //   "id": "1414971",
        //   "displayname": "Jay Gould",
        //   "description": "Sold @yashi for $33 million.  #Bitcoin",
        //   "verified": true,
        //   "created": "2007-03-18T13:16:15+00:00",
        //   "followersCount": 32351,
        //   "friendsCount": 301,
        //   "statusesCount": 2083,
        //   "favouritesCount": 2643,
        //   "listedCount": 222,
        //   "mediaCount": 272,
        //   "location": "Paradise",
        //   "protected": false,
        //   "linkUrl": "https://en.wikipedia.org/wiki/Jay_Gould_(entrepreneur)",
        //   "profileImageUrl": "https://pbs.twimg.com/profile_images/1425532557047836674/0ZuAxsHz_normal.jpg",
        //   "profileBannerUrl": "https://pbs.twimg.com/profile_banners/1414971/1615849119"
        // }

        console.log(''); //eslint-disable-line
        console.log('╔════START══t══════════════════════════════════════════════════'); //eslint-disable-line
        console.log(JSON.stringify(aTweets[0], null, 2)); //eslint-disable-line
        console.log(JSON.stringify(aUsers[0], null, 2)); //eslint-disable-line
        console.log(JSON.stringify(aTweets, null, 2)); //eslint-disable-line
        console.log('╚════END════t══════════════════════════════════════════════════'); //eslint-disable-line
        // process.exit();
        await client.indices.create(
          {
            index: 'tweets',
            body: {
              mappings: {
                properties: {
                  id: { type: 'integer' },
                  text: { type: 'text' },
                  user: { type: 'keyword' },
                  time: { type: 'date' },
                },
              },
            },
          },
          { ignore: [400] }
        );
        const { body: bulkResponse } = await client.bulk({
          refresh: true,
          body: [...bodyTweets, ...bodyUsers],
        });

        // ELASTIC SEARCH
      }
      // process.exit();
      const volumetry = scraper.getVolumetry();
      await HashtagVolumetryManager.batchUpsert(session)(
        item.hashtag._id,
        volumetry,
        Scraper.platformId
      );

      // save users
      await UserManager.batchUpsert(session)(users, Scraper.platformId);

      // const session = await mongoose.startSession();

      // session.startTransaction();

      // FIXME @martin should it still be used ?
      // if (lastEvaluatedUntilTweetId) {
      //   // This to prevent overwriting the lastEvaluatedUntilTweetId in case there is a problem
      //   newHashtagData.metadata = { lastEvaluatedUntilTweetId };
      // }

      const newHashtagData: Partial<
        Parameters<Properties<QueueItemManager>['stopProcessingHashtag']>[2]
      > = {};

      const { id: lastProcessedUntilTweetId, date: lastProcessedTweetCreatedAt } =
        scraper.getLastProcessedTweet() || {};
      const { id: firstProcessedUntilTweetId } = scraper.getFirstProcessedTweet() || {};

      if (isFirstRequest || isRequestForPreviousData) {
        if (lastProcessedTweetCreatedAt) {
          newHashtagData.oldestProcessedDate = lastProcessedTweetCreatedAt;
        }

        if (lastEvaluatedUntilTweetId !== lastProcessedUntilTweetId && lastProcessedUntilTweetId) {
          // There might be some more data to retrieve
          await this.queueItemManager.createHashtag(item.hashtag._id, {
            lastEvaluatedUntilTweetId: lastProcessedUntilTweetId,
            priority: item.priority + 1,
          });

          newHashtagData.status = HashtagStatuses.PROCESSING_PREVIOUS;
        } else {
          // This is the last occurence of all times
          newHashtagData.firstOccurenceDate = lastProcessedTweetCreatedAt;
        }

        if (isFirstRequest) {
          await this.queueItemManager.createHashtag(item.hashtag._id, {
            lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
            priority: QueueItemManager.PRIORITIES.HIGH,
            processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          });
        }
        await this.queueItemManager.stopProcessingHashtag(item, {}, newHashtagData);
      } else if (isRequestForNewData) {
        if (!firstProcessedUntilTweetId) {
          // reuse same queueitem to prevent having too many of them
          // and just change the date
          await this.queueItemManager.stopProcessingHashtag(
            item,
            {
              status: QueueItemStatuses.PENDING,
              processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
              metadata: {
                ...(item.metadata || {}),
                numberTimesCrawled: (item.metadata.numberTimesCrawled || 0) + 1,
              },
            },
            {
              newestProcessedDate: new Date(),
            }
          );
        } else {
          await this.queueItemManager.createHashtag(item.hashtag._id, {
            lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
            priority: QueueItemManager.PRIORITIES.HIGH,
            processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          });
          await this.queueItemManager.stopProcessingHashtag(
            item,
            {},
            {
              newestProcessedDate: new Date(),
            }
          );
        }
      }

      // await session.commitTransaction();
      scraper.purge();
      this.logger.info(`Item ${item._id} processing is done, waiting ${WAIT_TIME / 1000}s`);
    } catch (e) {
      // await session.abortTransaction();
      this.logger.error(e);

      // we have found some volumetry
      await this.queueItemManager.stopProcessingHashtagWithError(item, {
        error: e.toString(),
      });
      this.logger.error(
        `Item ${item._id} could not be processed correctly retrying in ${WAIT_TIME / 1000}s`
      );
    }
    // session.endSession();

    return setTimeout(() => {
      return process.nextTick(this.pollHashtags.bind(this));
    }, WAIT_TIME);
  }
}
