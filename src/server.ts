import * as logging from 'common/logging';

import express, { Express } from 'express';

import Scraper from 'common/node-snscrape';
import { getBotScore } from 'botscore';

interface ServerProps {
  processorId: string;
  logger: typeof logging;
}

const SERVER_PORT = process.env.SERVER_PORT || 4000;
export default class Server {
  private processorId: ServerProps['processorId'];
  private logger?: ServerProps['logger'];
  private app?: Express;

  constructor({ processorId, logger }: ServerProps) {
    this.logger = logger || logging;
    this.processorId = processorId;
    this.app = express();
  }

  init = () => {
    this.app.get('/scrape/twitter/user/:username', (req, res) => {
      try {
        const scrapeUser = Scraper.getUser(req.params.username);

        res.json(scrapeUser);
      } catch (error) {
        res.json({ status: 'ko', message: 'User not found', error: error.toString() });
      }
    });

    this.app.get('/scrape/twitter/user/:username/botscore', async (req, res) => {
      try {
        res.json(await getBotScore(req.params.username));
      } catch (error) {
        res.json({ status: 'ko', message: 'Score not found', error: error.toString() });
      }
    });

    this.app.listen(SERVER_PORT, () => {
      this.logger.info(`The application is listening on port ${SERVER_PORT}!`);
    });
  };
}
