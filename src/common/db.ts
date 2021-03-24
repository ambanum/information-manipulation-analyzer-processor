// import config from 'config';
import * as logging from 'common/logging';

import mongoose from 'mongoose';

let cachedDb: typeof mongoose;

const dbConnect = async () => {
  if (!process.env?.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  // check if we have a connection to the database or if it's currently
  // connecting or disconnecting (readyState 1, 2 and 3)
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  if (cachedDb) {
    logging.debug('=> using cached database instance');
    return Promise.resolve(cachedDb);
  }

  const connection = await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  });

  cachedDb = connection;
  logging.info(`Connected to database ${process.env.MONGODB_URI.replace(/:.*@/, ':XXXXX@')}`);

  return connection;
};

export default dbConnect;
