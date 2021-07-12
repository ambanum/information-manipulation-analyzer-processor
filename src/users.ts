import * as ProcessorManager from 'managers/ProcessorManager';
import * as UserManager from 'managers/UserManager';
import * as logging from 'common/logging';

import { getBotScores } from 'botscore';

const logPrefix = '[user]';
const DEFAULT_LIMIT = 200;
export default class UserPoller {
  private processorId: string;
  private logger: typeof logging;

  constructor({ processorId }) {
    this.processorId = processorId;
    this.logger = {
      debug: (...args: any[]) => logging.debug(logPrefix, ...args),
      info: (...args: any[]) => logging.info(logPrefix, ...args),
      warn: (...args: any[]) => logging.warn(logPrefix, ...args),
      error: (...args: any[]) => logging.error(logPrefix, ...args),
    };
  }

  async pollUsers(limit = DEFAULT_LIMIT) {
    const items = await UserManager.getOutdatedScoreBotUsers({ limit });

    if (items.length === 0) {
      await ProcessorManager.update(this.processorId, { lastPollAt: new Date() });
      this.logger.debug(`No more items to go, relaunching`);
      return process.nextTick(this.pollUsers.bind(this, limit));
    }

    await ProcessorManager.update(this.processorId, { lastProcessedAt: new Date() });
    try {
      const botScores = await getBotScores({ rawJson: JSON.stringify(items) });

      let i = 0;
      for (const user of items) {
        try {
          const botScore = botScores[i++];
          user.botScore = botScore.botScore;
          user.botScoreUpdatedAt = botScore.botScoreUpdatedAt;
          user.botScoreProvider = botScore.botScoreProvider;
          user.botScoreMetadata = botScore.botScoreMetadata;
          await user.save({ validateBeforeSave: false });
        } catch (e) {
          this.logger.error(`Could not get for ${user.username}`);
          this.logger.error(e);
        }
      }
    } catch (e) {
      const newLimit = Math.round(Math.min(items.length, limit) / 2);
      this.logger.error(`Could not retrieve all bot scores, trying with ${newLimit} items`);
      this.logger.error(e.toString());
      return process.nextTick(this.pollUsers.bind(this, newLimit));
    }

    this.logger.info(`------- ${items.length} processed -------`);

    return process.nextTick(this.pollUsers.bind(this, DEFAULT_LIMIT));
  }
}
