import * as logging from 'common/logging';

import express, { Express } from 'express';

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
    this.app.get('/', (req, res) => {
      this.logger.info(`${this.processorId} deozidez`);
      res.send('Well done!');
    });

    this.app.listen(process.env.SERVER_PORT, () => {
      this.logger.info(`The application is listening on port ${process.env.SERVER_PORT}!`);
    });
  };
}
