import * as logging from 'common/logging';

import express, { Express } from 'express';

import Scraper from 'common/node-snscrape';

interface ServerProps {
  processorId: string;
  logger: typeof logging;
}

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
        res.json(Scraper.getUser(req.params.username));
      } catch (error) {
        res.json({ status: 'ko', message: 'User not found', error: error.toString() });
      }
    });

    this.app.listen(process.env.SERVER_PORT, () => {
      this.logger.info(`The application is listening on port ${process.env.SERVER_PORT}!`);
    });
  };
}
