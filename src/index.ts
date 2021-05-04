import './common/bootstrap';

import * as HashtagVolumetryManager from 'managers/HashtagVolumetryManager';
import * as ProcessorManager from 'managers/ProcessorManager';
import * as QueueItemManager from 'managers/QueueItemManager';
import * as logging from 'common/logging';

import { HashtagStatuses, QueueItemStatuses } from 'interfaces';

import Scraper from 'common/node-snscrape';
import dbConnect from 'common/db';
// @ts-ignore
import packageJson from '../package.json';

const { version } = packageJson;

const WAIT_TIME = 1 * 1000; // 1s
const PROCESSOR_NAME = process.env?.PROCESSOR_NAME || 'noname';
const PROCESSOR_ID = process.env?.PROCESSOR_ID || '1';
const NB_TWEETS_TO_SCRAPE = process.env?.NB_TWEETS_TO_SCRAPE;
const MIN_PRIORITY = parseInt(process.env?.MIN_PRIORITY || '0', 10);
const PROCESSOR = `${PROCESSOR_NAME}_${PROCESSOR_ID}`;
const NEXT_PROCESS_IN_FUTURE = 60 * 60 * 1000;

const scraperName = 'snscrape';

const processorMetadata = {
  version,
  [scraperName]: Scraper.getVersion(),
  scraperPath: Scraper.getPath(),
  MONGODB_URI: process.env.MONGODB_URI,
  DEBUG: process.env.DEBUG,
};

(async () => {
  logging.info(`Launching processor in version ${version}`);
  logging.info(processorMetadata);

  await dbConnect();

  await ProcessorManager.update(PROCESSOR, { metadata: processorMetadata });

  await QueueItemManager.resetOutdated(PROCESSOR);

  const poll = async () => {
    const { item, count } = await QueueItemManager.getPendingItems(PROCESSOR, MIN_PRIORITY);

    if (!item) {
      await ProcessorManager.update(PROCESSOR, { lastPollAt: new Date() });
      logging.debug(`No more items to go, waiting ${WAIT_TIME / 1000}s`);
      return setTimeout(() => process.nextTick(poll.bind(this)), WAIT_TIME);
    }

    logging.info(`------- ${count} item(s) to go -------`);

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
        });
        return scraper;
      } catch (e) {
        if (retries - 1 >= 0) {
          logging.warn(
            `Scraper for ${item._id} (#${item.hashtag.name}) could not be processed correctly retrying again ${retries} times`
          );
          return initScraper(retries - 1);
        }

        throw e;
      }
    };

    try {
      await QueueItemManager.startProcessing(item, PROCESSOR, {
        previous: isRequestForPreviousData,
        next: isRequestForNewData,
      });

      await ProcessorManager.update(PROCESSOR, { lastProcessedAt: new Date() });

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

      const newHashtagData: Partial<
        Parameters<ReturnType<typeof QueueItemManager.stopProcessing>>
      >[2] = {};

      const { id: lastProcessedUntilTweetId, date: lastProcessedTweetCreatedAt } =
        scraper.getLastProcessedTweet() || {};
      const { id: firstProcessedUntilTweetId } = scraper.getFirstProcessedTweet() || {};

      if (isFirstRequest || isRequestForPreviousData) {
        if (lastProcessedTweetCreatedAt) {
          newHashtagData.oldestProcessedDate = lastProcessedTweetCreatedAt;
        }

        if (lastEvaluatedUntilTweetId !== lastProcessedUntilTweetId && lastProcessedUntilTweetId) {
          // There might be some more data to retrieve
          await QueueItemManager.create(session)(item.hashtag._id, {
            lastEvaluatedUntilTweetId: lastProcessedUntilTweetId,
            priority: item.priority + 1,
          });

          newHashtagData.status = HashtagStatuses.PROCESSING_PREVIOUS;
        } else {
          // This is the last occurence of all times
          newHashtagData.firstOccurenceDate = lastProcessedTweetCreatedAt;
        }

        if (isFirstRequest) {
          await QueueItemManager.create(session)(item.hashtag._id, {
            lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
            priority: QueueItemManager.PRIORITIES.HIGH,
            processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          });
        }
        await QueueItemManager.stopProcessing(session)(
          item,
          { processorId: PROCESSOR },
          newHashtagData
        );
      } else if (isRequestForNewData) {
        if (!firstProcessedUntilTweetId) {
          // reuse same queueitem to prevent having too many of them
          // and just change the date
          await QueueItemManager.stopProcessing(session)(
            item,
            {
              status: QueueItemStatuses.PENDING,
              processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
              metadata: {
                ...(item.metadata || {}),
                numberTimesCrawled: (item.metadata.numberTimesCrawled || 0) + 1,
              },
              processorId: PROCESSOR,
            },
            {
              newestProcessedDate: new Date(),
            }
          );
        } else {
          await QueueItemManager.create(session)(item.hashtag._id, {
            lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
            priority: QueueItemManager.PRIORITIES.HIGH,
            processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          });
          await QueueItemManager.stopProcessing(session)(
            item,
            { processorId: PROCESSOR },
            {
              newestProcessedDate: new Date(),
            }
          );
        }
      }

      // await session.commitTransaction();
      scraper.purge();
      logging.info(`Item ${item._id} processing is done, waiting ${WAIT_TIME / 1000}s`);
    } catch (e) {
      // await session.abortTransaction();
      logging.error(e);

      // we have found some volumetry
      await QueueItemManager.stopProcessingWithError(session)(item, PROCESSOR, {
        error: e.toString(),
      });
      logging.error(
        `Item ${item._id} could not be processed correctly retrying in ${WAIT_TIME / 1000}s`
      );
    }
    // session.endSession();

    return setTimeout(() => {
      return process.nextTick(poll.bind(this));
    }, WAIT_TIME);
  };

  await poll();
})();
