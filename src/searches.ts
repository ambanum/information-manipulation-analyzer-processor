import * as ProcessorManager from 'managers/ProcessorManager';
import * as SearchVolumetryManager from 'managers/SearchVolumetryManager';
import * as TweetManager from 'managers/TweetManager';
import * as UserManager from 'managers/UserManager';
import * as logging from 'common/logging';

import { QueueItemActionTypes, QueueItemStatuses, SearchStatuses } from 'interfaces';

import QueueItemManager from 'managers/QueueItemManager';
import Scraper from 'common/node-snscrape';
import { getUrlData } from 'url-scraper';

const WAIT_TIME = 1 * 1000; // 1s
const NB_TWEETS_TO_SCRAPE = process.env?.NB_TWEETS_TO_SCRAPE;
const NB_TWEETS_TO_SCRAPE_FIRST_TIME = process.env?.NB_TWEETS_TO_SCRAPE_FIRST_TIME;
const MIN_PRIORITY = parseInt(process.env?.MIN_PRIORITY || '0', 10);
const NEXT_PROCESS_IN_FUTURE = 60 * 60 * 1000;

// version to change when data retrieved is changed
// this way we can display in the frontend a note saying that
// in order to have the full features, you need to relaunch the process
// v2: added users storing
const SCRAPE_VERSION = 3;

// Because I could not find other way in tyepscript to get functions of a class
type Properties<T> = { [K in keyof T]: T[K] };

export default class SearchPoller {
  private processorId: string;
  private logger: logging.Logger;
  private queueItemManager: QueueItemManager;

  constructor({ processorId }) {
    this.processorId = processorId;
    this.logger = logging.getLogger('[search]');
    this.queueItemManager = new QueueItemManager({
      logger: this.logger,
      processorId,
      scrapeVersion: SCRAPE_VERSION,
    });
  }

  async init() {
    await this.queueItemManager.resetOutdated(QueueItemActionTypes.SEARCH);
  }

  async pollSearches() {
    const { item, count } = await this.queueItemManager.getPendingSearches(MIN_PRIORITY);

    if (!item) {
      await ProcessorManager.update(this.processorId, { lastPollAt: new Date() });
      this.logger.debug(`No more items to go, waiting ${WAIT_TIME / 1000}s`);
      return setTimeout(() => process.nextTick(this.pollSearches.bind(this)), WAIT_TIME);
    }

    this.logger.info(`------- ${count} item(s) to go -------`);

    const { lastEvaluatedUntilTweetId, lastEvaluatedSinceTweetId } = item?.metadata || {};

    const isRequestForPreviousData = !!lastEvaluatedUntilTweetId;
    const isRequestForNewData = !!lastEvaluatedSinceTweetId;
    const isFirstRequest = !isRequestForPreviousData && !isRequestForNewData;

    const session = undefined;

    const initScraper = (retries = 3): Scraper => {
      try {
        const scraper = new Scraper(item.search.name, {
          resumeUntilTweetId: lastEvaluatedUntilTweetId,
          resumeSinceTweetId: lastEvaluatedSinceTweetId,
          nbTweetsToScrape: NB_TWEETS_TO_SCRAPE ? +NB_TWEETS_TO_SCRAPE : undefined,
          nbTweetsToScrapeFirstTime: NB_TWEETS_TO_SCRAPE_FIRST_TIME
            ? +NB_TWEETS_TO_SCRAPE_FIRST_TIME
            : undefined,
          logger: this.logger,
        });
        return scraper;
      } catch (e) {
        if (retries - 1 >= 0) {
          this.logger.warn(
            `Scraper for ${item._id} (${item.search.name}) could not be processed correctly retrying again ${retries} times`
          );
          this.logger.error(e);
          return initScraper(retries - 1);
        }

        throw e;
      }
    };

    try {
      await this.queueItemManager.startProcessingSearch(item, {
        previous: isRequestForPreviousData,
        next: isRequestForNewData,
      });

      if (item.search.get('type') === 'URL' && !item.search?.metadata?.url?.scrapedAt) {
        const data = await getUrlData(item.search.name);

        item.search.set('metadata', {
          ...item.search.metadata,
          url: data,
        });
        await item.search.save();
      }

      await ProcessorManager.update(this.processorId, { lastProcessedAt: new Date() });

      let scraper = initScraper();

      // save volumetry
      const volumetry = scraper.getVolumetry();
      await SearchVolumetryManager.batchUpsert(session)(
        item.search._id,
        volumetry,
        Scraper.platformId
      );

      // save users
      const users = scraper.getUsers();
      const tweets = scraper.getTweets();

      await UserManager.batchUpsert(session)(users, item.search._id, Scraper.platformId);
      await TweetManager.batchUpsert(session)(tweets, item.search._id);

      // const session = await mongoose.startSession();

      // session.startTransaction();

      // FIXME @martin should it still be used ?
      // if (lastEvaluatedUntilTweetId) {
      //   // This to prevent overwriting the lastEvaluatedUntilTweetId in case there is a problem
      //   newSearchData.metadata = { lastEvaluatedUntilTweetId };
      // }

      const newSearchData: Partial<
        Parameters<Properties<QueueItemManager>['stopProcessingSearch']>[2]
      > = {};

      const { id: lastProcessedUntilTweetId, date: lastProcessedTweetCreatedAt } =
        scraper.getLastProcessedTweet() || {};
      const { id: firstProcessedUntilTweetId } = scraper.getFirstProcessedTweet() || {};

      if (isFirstRequest || isRequestForPreviousData) {
        if (lastProcessedTweetCreatedAt) {
          newSearchData.oldestProcessedDate = lastProcessedTweetCreatedAt;
        }

        if (lastEvaluatedUntilTweetId !== lastProcessedUntilTweetId && lastProcessedUntilTweetId) {
          // There might be some more data to retrieve
          await this.queueItemManager.createSearch(item.search._id, {
            lastEvaluatedUntilTweetId: lastProcessedUntilTweetId,
            priority: item.priority + 1,
          });

          newSearchData.status = SearchStatuses.PROCESSING_PREVIOUS;
        } else {
          // This is the last occurence of all times
          newSearchData.firstOccurenceDate = lastProcessedTweetCreatedAt;
        }

        if (isFirstRequest) {
          await this.queueItemManager.createSearch(item.search._id, {
            lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
            priority: QueueItemManager.PRIORITIES.HIGH,
            processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          });
          newSearchData.newestProcessedDate = new Date();
        }
        await this.queueItemManager.stopProcessingSearch(item, {}, newSearchData);
      } else if (isRequestForNewData) {
        if (!firstProcessedUntilTweetId) {
          // reuse same queueitem to prevent having too many of them
          // and just change the date
          await this.queueItemManager.stopProcessingSearch(
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
          await this.queueItemManager.createSearch(item.search._id, {
            lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
            priority: QueueItemManager.PRIORITIES.HIGH,
            processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          });
          await this.queueItemManager.stopProcessingSearch(
            item,
            {},
            {
              newestProcessedDate: new Date(),
              ...(item.search.get('status') === SearchStatuses.PROCESSING_PREVIOUS
                ? { status: SearchStatuses.PROCESSING_PREVIOUS }
                : {}),
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
      await this.queueItemManager.stopProcessingSearchWithError(item, {
        error: e.toString(),
      });
      this.logger.error(
        `Item ${item._id} could not be processed correctly retrying in ${WAIT_TIME / 1000}s`
      );
    }
    // session.endSession();

    return setTimeout(() => {
      return process.nextTick(this.pollSearches.bind(this));
    }, WAIT_TIME);
  }
}
