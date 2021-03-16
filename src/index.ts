import * as HashtagVolumetryManager from 'managers/HashtagVolumetryManager';
import * as QueueItemManager from 'managers/QueueItemManager';
import * as logging from 'common/logging';

import Twint from 'common/node-twint';
import dbConnect from 'common/db';
// @ts-ignore
import packageJson from '../package.json';

const { version } = packageJson;

const WAIT_TIME = 10000; // 10s
const PROCESSOR_ID = process.env?.PROCESSOR_ID || '1';

(async () => {
  logging.info(`Launching procesor in version ${version}`);
  logging.info(`Twint: ${Twint.getVersion()}`);

  await dbConnect();

  await QueueItemManager.resetOutdated(PROCESSOR_ID);

  const poll = async () => {
    const { item, count } = await QueueItemManager.getPendingItems();

    if (!item) {
      logging.debug(`No more items to go, waiting ${WAIT_TIME / 1000}s`);
      return setTimeout(() => process.nextTick(poll.bind(this)), WAIT_TIME);
    }

    logging.info(`${count} item(s) to go`);

    await QueueItemManager.startProcessing(item, PROCESSOR_ID);

    const scraper = new Twint(item.hashtag.name);
    const volumetry = scraper.getVolumetry();

    await HashtagVolumetryManager.batchUpsert(item.hashtag._id, volumetry, Twint.platformId);

    // const firstOccurence = await scraper.getFirstOccurence();

    await QueueItemManager.stopProcessing(item, PROCESSOR_ID);

    logging.info(`Item ${item._id} processing is done`);
    return setTimeout(() => process.nextTick(poll.bind(this)), WAIT_TIME);
  };

  await poll();
})();
