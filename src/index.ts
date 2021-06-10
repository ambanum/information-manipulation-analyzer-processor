import './common/bootstrap';

import * as ProcessorManager from 'managers/ProcessorManager';
import * as logging from 'common/logging';

import HashtagPoller from 'hashtags';
import Scraper from 'common/node-snscrape';
import dbConnect from 'common/db';
// @ts-ignore
import packageJson from '../package.json';

const { version } = packageJson;

const PROCESSOR_NAME = process.env?.PROCESSOR_NAME || 'noname';
const PROCESSOR_ID = process.env?.PROCESSOR_ID || '1';
const PROCESSOR = `${PROCESSOR_NAME}_${PROCESSOR_ID}`;

const processorMetadata = {
  version,
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

  const hashtagPoller = new HashtagPoller({ processorId: PROCESSOR });
  await hashtagPoller.init();

  await hashtagPoller.pollHashtags();
})();
