import * as ProcessorManager from 'managers/ProcessorManager';
import * as UserManager from 'managers/UserManager';
import * as logging from 'common/logging';

import { getBotScore } from 'botscore';

const logPrefix = '[user]';

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

  async pollUsers() {
    const items = await UserManager.getOutdatedScoreBotUsers({ limit: 100 });

    if (items.length === 0) {
      await ProcessorManager.update(this.processorId, { lastPollAt: new Date() });
      this.logger.debug(`No more items to go, relaunching`);
      return process.nextTick(this.pollUsers.bind(this));
    }

    this.logger.info(`------- ${items.length} item(s) to go -------`);

    await ProcessorManager.update(this.processorId, { lastProcessedAt: new Date() });

    for (const user of items) {
      try {
        const botScore = await getBotScore(user.username, { rawJson: JSON.stringify(user) });
        user.botScore = botScore.botScore;
        user.botScoreUpdatedAt = botScore.botScoreUpdatedAt;
        user.botScoreProvider = botScore.botScoreProvider;
        user.botScoreMetadata = botScore.botScoreMetadata;
        await user.save({ validateBeforeSave: false });
      } catch (e) {
        this.logger.error(`Could not get for ${user.username}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    return process.nextTick(this.pollUsers.bind(this));
  }
}
