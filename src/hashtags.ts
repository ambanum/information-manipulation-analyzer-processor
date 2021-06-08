import * as HashtagVolumetryManager from 'managers/HashtagVolumetryManager';
import * as ProcessorManager from 'managers/ProcessorManager';
import * as logging from 'common/logging';

import { HashtagStatuses, QueueItemActionTypes, QueueItemStatuses } from 'interfaces';

import QueueItemManager from 'managers/QueueItemManager';
import Scraper from 'common/node-snscrape';

const WAIT_TIME = 1 * 1000; // 1s
const NB_TWEETS_TO_SCRAPE = process.env?.NB_TWEETS_TO_SCRAPE;
const MIN_PRIORITY = parseInt(process.env?.MIN_PRIORITY || '0', 10);
const NEXT_PROCESS_IN_FUTURE = 60 * 60 * 1000;
const logPrefix = '[hashtag]';

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

      const volumetry = scraper.getVolumetry();

      // const session = await mongoose.startSession();

      // session.startTransaction();

      // FIXME @martin should it still be used ?
      // if (lastEvaluatedUntilTweetId) {
      //   // This to prevent overwriting the lastEvaluatedUntilTweetId in case there is a problem
      //   newHashtagData.metadata = { lastEvaluatedUntilTweetId };
      // }

      await HashtagVolumetryManager.batchUpsert(session)(
        item.hashtag._id,
        volumetry,
        Scraper.platformId
      );

      const users = scraper.getUsers();

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
