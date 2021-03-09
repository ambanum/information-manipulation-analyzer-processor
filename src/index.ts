// @ts-ignore
import packageJson from '../package.json';
import * as logging from 'common/logging';
import dbConnect from 'common/db';
import * as twint from 'common/node-twint';
import * as QueueItemManager from 'managers/QueueItemManager';

const { version } = packageJson;

const WAIT_TIME = 10000; // 10s
const PROCESSOR_ID = process.env?.PROCESSOR_ID || '1';

(async () => {
  logging.info(`Launching procesor in version ${version}`);
  logging.info(`Twint: ${twint.getVersion()}`);

  await dbConnect();

  await QueueItemManager.resetOutdated(PROCESSOR_ID);

  const poll = async () => {
    const { item, count } = await QueueItemManager.getPendingItems();

    if (!item) {
      logging.debug(`No more items to go, waiting ${WAIT_TIME / 1000}s`);
      return setTimeout(() => process.nextTick(poll.bind(this)), WAIT_TIME);
    }

    logging.info(`${count} item(s) to go`);

    await QueueItemManager.startProcessing(item._id, PROCESSOR_ID);

    // TODO process data here

    logging.info(`Item ${item._id} processing is done`);
    return setTimeout(() => process.nextTick(poll.bind(this)), WAIT_TIME);
  };

  await poll();
})();
