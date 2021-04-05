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

    const isRequestForPreviousData = !!item.metadata?.lastEvaluatedTweetId;
    await QueueItemManager.startProcessing(item, PROCESSOR, isRequestForPreviousData);

    await ProcessorManager.update(PROCESSOR, { lastProcessedAt: new Date() });

    const lastProcessedTweetId = item.hashtag?.metadata?.lastEvaluatedTweetId;

    const scraper = new Twint(item.hashtag.name, {
      resumeFromTweetId: lastProcessedTweetId,
      nbTweetsToScrape: NB_TWEETS_TO_SCRAPE ? +NB_TWEETS_TO_SCRAPE : undefined,
    });
    const volumetry = scraper.getVolumetry();

    const lastEvaluatedTweet = scraper.getLastEvaluatedTweet();
    const lastEvaluatedTweetId = lastEvaluatedTweet?.id;
    const lastEvaluatedTweetCreatedAt = lastEvaluatedTweet?.created_at;

    const newHashtagData: Partial<
      Parameters<ReturnType<typeof QueueItemManager.stopProcessing>>
    >[2] = {};

    if (lastEvaluatedTweetId) {
      // This to prevent overwriting the lastEvaluatedTweetId in case there is a problem
      newHashtagData.metadata = { lastEvaluatedTweetId };
    }

    if (lastEvaluatedTweetCreatedAt) {
      newHashtagData.oldestProcessedDate = lastEvaluatedTweetCreatedAt;

      if (!lastProcessedTweetId) {
        // this is the first time we make the request
        newHashtagData.newestProcessedDate = new Date();
      }
    }
    const session = undefined;
    // const session = await mongoose.startSession();
    try {
      // session.startTransaction();

      await HashtagVolumetryManager.batchUpsert(session)(
        item.hashtag._id,
        volumetry,
        Twint.platformId
      );

      if (lastEvaluatedTweetId !== lastProcessedTweetId) {
        // There might be some more data to retrieve
        await QueueItemManager.create(session)(item.hashtag._id, {
          lastEvaluatedTweetId,
          priority: item.priority + 1,
        });
        newHashtagData.status = HashtagStatuses.PROCESSING_PREVIOUS;
        await QueueItemManager.stopProcessing(session)(item, PROCESSOR, newHashtagData);
      } else {
        // This is the last occurence of all times
        newHashtagData.firstOccurenceDate = lastEvaluatedTweet.created_at;
        await QueueItemManager.stopProcessing(session)(item, PROCESSOR, newHashtagData);
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
