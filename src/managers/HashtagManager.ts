import * as logging from 'common/logging';

import { ClientSession } from 'mongoose';
import HashtagModel from '../models/Hashtag';

interface HashtagManagerProps {
  processorId: string;
  logger: logging.Logger;
  session?: ClientSession;
}

export default class HashtagManager {
  private processorId: HashtagManagerProps['processorId'];
  private logger?: HashtagManagerProps['logger'];
  private session?: HashtagManagerProps['session'];

  constructor({ processorId, logger, session }: HashtagManagerProps) {
    this.logger = logger || logging.getLogger();
    this.processorId = processorId;
    this.session = session;
  }

  public async getByName(name: string) {
    return HashtagModel.findOne({ name });
  }
}
