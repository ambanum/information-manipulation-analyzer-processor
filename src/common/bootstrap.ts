import * as logging from 'common/logging';

import dotenv from 'dotenv';

dotenv.config({ path: `./.env.${process.env.NODE_ENV || 'local'}` });
dotenv.config({ path: `./.env` });

process.on('unhandledRejection', (reason: any) => {
  logging.error(`unhandledRejection ${reason}`);
  logging.error(reason);
  process.exit(1);
});

process.on('uncaughtException', (err: any) => {
  logging.error(`uncaughtException ${err}`);
  logging.error(err);
  process.exit(1);
});

// See https://blog.heroku.com/best-practices-nodejs-errors

process.on('SIGTERM', () => {
  logging.error(`Process ${process.pid} received a SIGTERM signal`);
  process.exit(0);
});

process.on('SIGINT', () => {
  logging.error(`Process ${process.pid} has been interrupted`);
  process.exit(0);
});
