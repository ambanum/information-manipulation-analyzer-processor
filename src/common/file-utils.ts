import * as fs from 'fs';
import * as logging from 'common/logging';

import rimraf from 'rimraf';

export const removeFile = (filePath: string) => {
  if (!filePath) {
    throw new Error('filepath undefined');
  }

  try {
    fs.unlink(filePath, () => {
      logging.debug(`File ${filePath} removed`);
    });
  } catch (e) {
    logging.error(`Error removing file ${filePath}: ${e.toString()}`);
  }
};

export const removeDirectory = (dir: string) => {
  logging.debug(`remove directory ${dir}`);
  try {
    rimraf.sync(dir);
  } catch (e) {
    logging.error(`Error removing directory ${dir}: ${e.toString()}`);
  }
};
