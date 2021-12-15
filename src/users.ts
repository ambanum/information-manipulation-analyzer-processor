import * as ProcessorManager from 'managers/ProcessorManager';
import * as UserManager from 'managers/UserManager';
import * as logging from 'common/logging';

import { getBotScores } from 'botscore';

const DEFAULT_LIMIT = 2000;
const WAIT_TIME_ON_DB_ERROR = 30 * 1000; // 30s
export default class UserPoller {
  private processorId: string;
  private logger: logging.Logger;

  constructor({ processorId }) {
    this.processorId = processorId;
    this.logger = logging.getLogger('[user]');
  }

  async pollUsers(limit = DEFAULT_LIMIT) {
    let items: any;
    try {
      items = await UserManager.getOutdatedScoreBotUsers({ limit });
    } catch (e) {
      logging.error(e);
      return setTimeout(
        () => process.nextTick(this.pollUsers.bind(this, limit)),
        WAIT_TIME_ON_DB_ERROR
      );
    }

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
          this.logger.error(`Could not get for ${user?.username}`);
          this.logger.error(e);
        }
      }
    } catch (e) {
      const nbItemsTried = Math.min(items.length, limit);
      const newLimit = Math.round(nbItemsTried / 2);
      this.logger.error(
        `Could not retrieve ${nbItemsTried} bot scores, trying with ${newLimit} items`
      );
      this.logger.error(e.toString());
      return process.nextTick(this.pollUsers.bind(this, newLimit));
    }

    this.logger.info(`------- ${items.length} processed -------`);

    return process.nextTick(this.pollUsers.bind(this, DEFAULT_LIMIT));
  }
}
