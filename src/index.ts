import './common/bootstrap';

import * as HashtagVolumetryManager from 'managers/HashtagVolumetryManager';
import * as ProcessorManager from 'managers/ProcessorManager';
import * as QueueItemManager from 'managers/QueueItemManager';
import * as logging from 'common/logging';

import { HashtagStatuses } from 'interfaces';
import Twint from 'common/node-twint';
import dbConnect from 'common/db';
// @ts-ignore
import packageJson from '../package.json';

const { version } = packageJson;

const WAIT_TIME = 1 * 1000; // 1s
const PROCESSOR_NAME = process.env?.PROCESSOR_NAME || 'noname';
const PROCESSOR_ID = process.env?.PROCESSOR_ID || '1';
const NB_TWEETS_TO_SCRAPE = process.env?.NB_TWEETS_TO_SCRAPE;
const PROCESSOR = `${PROCESSOR_NAME}_${PROCESSOR_ID}`;
const NEXT_PROCESS_IN_FUTURE = 60 * 60 * 1000;

const processorMetadata = {
  version,
  twint: Twint.getVersion(),
  TWINT_PATH: process.env.TWINT_PATH,
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
    const { item, count } = await QueueItemManager.getPendingItems(PROCESSOR);

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

    await QueueItemManager.startProcessing(item, PROCESSOR, {
      previous: isRequestForPreviousData,
      next: isRequestForNewData,
    });

    await ProcessorManager.update(PROCESSOR, { lastProcessedAt: new Date() });

    const scraper = new Twint(item.hashtag.name, {
      resumeUntilTweetId: lastEvaluatedUntilTweetId,
      resumeSinceTweetId: lastEvaluatedSinceTweetId,
      nbTweetsToScrape: NB_TWEETS_TO_SCRAPE ? +NB_TWEETS_TO_SCRAPE : undefined,
    });

    const volumetry = scraper.getVolumetry();

    const session = undefined;
    // const session = await mongoose.startSession();

    try {
      // session.startTransaction();

      // FIXME @martin should it still be used ?
      // if (lastEvaluatedUntilTweetId) {
      //   // This to prevent overwriting the lastEvaluatedUntilTweetId in case there is a problem
      //   newHashtagData.metadata = { lastEvaluatedUntilTweetId };
      // }

      await HashtagVolumetryManager.batchUpsert(session)(
        item.hashtag._id,
        volumetry,
        Twint.platformId
      );

      const newHashtagData: Partial<
        Parameters<ReturnType<typeof QueueItemManager.stopProcessing>>
      >[2] = {};

      const { id: lastProcessedUntilTweetId, created_at: lastProcessedTweetCreatedAt } =
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
          const { id: firstProcessedUntilTweetId } = scraper.getFirstProcessedTweet() || {};
          newHashtagData.newestProcessedDate = new Date();
          await QueueItemManager.create(session)(item.hashtag._id, {
            lastEvaluatedSinceTweetId: firstProcessedUntilTweetId,
            priority: QueueItemManager.PRIORITIES.HIGH,
            processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
          });
        }
        await QueueItemManager.stopProcessing(session)(item, PROCESSOR, newHashtagData);
      } else if (isRequestForNewData) {
        // TODO What if more data than expected?
        await QueueItemManager.create(session)(item.hashtag._id, {
          lastEvaluatedSinceTweetId:
            firstProcessedUntilTweetId || item?.metadata?.lastEvaluatedSinceTweetId,
          priority: QueueItemManager.PRIORITIES.HIGH,
          processingDate: new Date(Date.now() + NEXT_PROCESS_IN_FUTURE),
        });

        await QueueItemManager.stopProcessing(session)(item, PROCESSOR, {
          newestProcessedDate: new Date(),
        });
      }

      // await session.commitTransaction();
      scraper.purge();
      logging.info(`Item ${item._id} processing is done, waiting ${WAIT_TIME / 1000}s`);
    } catch (e) {
      // await session.abortTransaction();
      logging.error(e);
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
