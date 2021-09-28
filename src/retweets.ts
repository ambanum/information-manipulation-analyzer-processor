import * as ProcessorManager from 'managers/ProcessorManager';
import * as TweetManager from 'managers/TweetManager';
import * as logging from 'common/logging';

import { QueueItemActionTypes, QueueItemStatuses } from 'interfaces';

import QueueItemManager from 'managers/QueueItemManager';
import Scraper from 'common/node-snscrape';

const WAIT_TIME = 1 * 1000; // 1s
const NB_TWEETS_TO_SCRAPE = process.env?.NB_TWEETS_TO_SCRAPE;
const MIN_PRIORITY = parseInt(process.env?.MIN_PRIORITY || '0', 10);
const NEXT_PROCESS_IN_FUTURE = 60 * 60 * 1000; // 1 hour
const NB_TWEETS_TO_SCRAPE_ANYWAY = NB_TWEETS_TO_SCRAPE ? +NB_TWEETS_TO_SCRAPE : undefined;

// version to change when data retrieved is changed
// this way we can display in the frontend a note saying that
// in order to have the full features, you need to relaunch the process
const SCRAPE_VERSION = 1;

export default class RetweetsPoller {
  private processorId: string;
  private logger: logging.Logger;
  private queueItemManager: QueueItemManager;
  constructor({ processorId }) {
    this.processorId = processorId;
    this.logger = logging.getLogger('[retweets]');
    this.queueItemManager = new QueueItemManager({
      logger: this.logger,
      processorId,
      scrapeVersion: SCRAPE_VERSION,
    });
  }
  async init() {
    /**
     * This call should be archived after it has been launched on every processor
     * as queue items should be created
     */
    await this.queueItemManager.createMissingQueueItemsIfNotExist();
    await this.queueItemManager.resetOutdated(QueueItemActionTypes.RETWEETS);
  }
  async pollRetweets() {
    const { item, count } = await this.queueItemManager.getPendingSearches(
      QueueItemActionTypes.RETWEETS,
      MIN_PRIORITY
    );
    if (!item) {
      await ProcessorManager.update(this.processorId, { lastPollAt: new Date() });
      this.logger.debug(`No more items to go, waiting ${WAIT_TIME / 1000}s`);
      return setTimeout(() => process.nextTick(this.pollRetweets.bind(this)), WAIT_TIME);
    }

    this.logger.info(`------- ${count} item(s) to go -------`);
    const { lastEvaluatedSinceTweetId } = item?.metadata || {};

    const session = undefined;
    const initScraper = (retries = 3): Scraper => {
      try {
        const scraper = new Scraper(item.search.name, {
          dirSuffix: 'retweets',
          resumeSinceTweetId: lastEvaluatedSinceTweetId,
          nbTweetsToScrape: NB_TWEETS_TO_SCRAPE_ANYWAY,
          nbTweetsToScrapeFirstTime: NB_TWEETS_TO_SCRAPE_ANYWAY,
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
      await this.queueItemManager.startProcessingRetweets(item);
      await ProcessorManager.update(this.processorId, { lastProcessedAt: new Date() });

      let scraper = initScraper();
      scraper.downloadRetweets();
      const tweetsToUpdate = scraper.getRetweetUpdatedValues();

      await TweetManager.batchUpsert(session)(tweetsToUpdate, item.search._id);

      const { id: lastProcessedUntilTweetId, date: lastProcessedTweetCreatedAt } =
        scraper.getLastProcessedRetweet() || {};
      const { id: firstProcessedUntilTweetId } = scraper.getFirstProcessedRetweet() || {};
      const hasNewData = !!firstProcessedUntilTweetId;

      if (!hasNewData) {
        // reuse same queueitem to prevent having too many of them
        // and just change the date
        await this.queueItemManager.stopProcessingRetweets(item, {
          status: QueueItemStatuses.PENDING,
          processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          metadata: {
            ...(item.metadata || {}),
            numberTimesCrawled: (item.metadata.numberTimesCrawled || 0) + 1,
          },
        });
      } else {
        await this.queueItemManager.create(item.search._id, {
          lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
          priority: QueueItemManager.PRIORITIES.HIGH,
          action: QueueItemActionTypes.RETWEETS,
        });
        await this.queueItemManager.stopProcessingRetweets(item, {});
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
      return process.nextTick(this.pollRetweets.bind(this));
    }, WAIT_TIME);
  }
}
