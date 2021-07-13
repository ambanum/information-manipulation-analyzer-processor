import './common/bootstrap';

import * as ProcessorManager from 'managers/ProcessorManager';
import * as logging from 'common/logging';

import { getProvider, getVersion } from 'botscore';

import HashtagPoller from './hashtags';
import Scraper from 'common/node-snscrape';
import Server from './server';
import UserPoller from './users';
import dbConnect from 'common/db';
// @ts-ignore
import packageJson from '../package.json';

const { version } = packageJson;

const service: 'hashtag' | 'server' | 'user' | string = process.argv[2];

if (!['hashtag', 'server', 'user'].includes(service)) {
  console.error("You need to specify a service 'hashtag' | 'server'");
  process.exit();
}

const PROCESSOR_NAME = process.env?.PROCESSOR_NAME || 'noname';
const PROCESSOR_ID = process.env?.PROCESSOR_ID || '1';
const PROCESSOR = `${PROCESSOR_NAME}_${PROCESSOR_ID}_${service}`;

const processorMetadata = {
  version,
  botScore: `${getProvider()}:${getVersion()}`,
  snscrape: Scraper.getVersion(),
  scraperPath: Scraper.getPath(),
  MONGODB_URI: process.env.MONGODB_URI,
  DEBUG: process.env.DEBUG,
};
(async () => {
  logging.info(`Launching processor in version ${version}`);
  logging.info(processorMetadata);

  await dbConnect();

  await ProcessorManager.update(PROCESSOR, { metadata: processorMetadata });

  if (service === 'server') {
    if (process.env.API !== 'false') {
      const apiServer = new Server({ processorId: PROCESSOR, logger: logging });
      apiServer.init();
    } else {
      logging.info('No API started');
    }
  } else {
    if (service === 'user') {
      const userPoller = new UserPoller({ processorId: PROCESSOR });
      await userPoller.pollUsers();
    } else {
      const hashtagPoller = new HashtagPoller({ processorId: PROCESSOR });
      await hashtagPoller.init();

      await hashtagPoller.pollHashtags();
    }
  }
})();
