// @ts-ignore
import packageJson from '../package.json';
import * as logging from 'common/logging';

const { version } = packageJson;

const WAIT_TIME = 10000; // 10s

(async () => {
  logging.info(`Launching procesor in version ${version}`);

  const poll = async () => {
    logging.debug('poll');
    // Do stuff here
    return setTimeout(() => process.nextTick(poll.bind(this)), WAIT_TIME);
  };

  await poll();
})();
