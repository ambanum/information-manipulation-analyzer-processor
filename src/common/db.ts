import './bootstrap';
// import config from 'config';
import * as logging from 'common/logging';
// import { MongoClient, Db } from 'mongodb';

// const DATABASE_URL: string = config.get('database.url');
// const DATABASE_OPTIONS: any = config.get('database.options');
// const DATABASE_URL_OBFUSCATED: string = DATABASE_URL.replace(/:.*@/, ':XXXXX@');

export const initDb = async (): Promise<any> =>
  new Promise(
    (resolve: any) => {
      logging.info('init db');
    }
    // MongoClient.connect(DATABASE_URL, DATABASE_OPTIONS, async (connectErr, client) => {
    //   if (connectErr) {
    //     logging.error(`Could not connect to ${DATABASE_URL_OBFUSCATED}`);
    //     // @ts-ignore
    //     logging.error(connectErr);
    //     process.exit();
    //   }
    //   logging.info(`Connected to database ${DATABASE_URL_OBFUSCATED}`);
    //   resolve(client.db());
    // })
  );
