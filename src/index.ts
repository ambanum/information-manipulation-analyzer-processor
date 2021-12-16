import './common/bootstrap';

import * as ProcessorManager from 'managers/ProcessorManager';
import * as logging from 'common/logging';

import { getProvider, getVersion } from 'botscore';

import RetweetsPoller from './retweets';
import Scraper from 'common/node-snscrape';
import SearchPoller from './searches';
import Server from './server';
import UserPoller from './users';
import dbConnect from 'common/db';
// @ts-ignore
import packageJson from '../package.json';
const { version } = packageJson;

const service: 'search' | 'server' | 'user' | 'retweets' | string = process.argv[2];

if (!['search', 'server', 'user', 'retweets'].includes(service)) {
  console.error("You need to specify a service 'search' | 'server' | 'user' | 'retweets'");
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
      if (process.env.USER_BOT_SCORES !== 'false') {
        const userPoller = new UserPoller({ processorId: PROCESSOR });
        await userPoller.pollUsers();
      } else {
        logging.info('No USER_BOT_SCORES started');
      }
    } else if (service === 'retweets') {
      const retweetsPoller = new RetweetsPoller({ processorId: PROCESSOR });
      await retweetsPoller.init();
      await retweetsPoller.pollRetweets();
    } else {
      const searchPoller = new SearchPoller({ processorId: PROCESSOR });
      await searchPoller.init();

      await searchPoller.pollSearches();
    }
  }
})();
