import * as HashtagManager from 'managers/HashtagManager';
import * as ProcessorManager from 'managers/ProcessorManager';
import * as logging from 'common/logging';

// import { getBotScores } from 'botscore';

export default class GraphPoller {
  private processorId: string;
  private logger: logging.Logger;

  constructor({ processorId }) {
    this.processorId = processorId;
    this.logger = logging.getLogger('[graph]');
  }

  async pollHashtags() {
    // const items = await HashtagManager.getWithNoGraph({ limit: 1 });
    const items = [];

    if (items.length === 0) {
      await ProcessorManager.update(this.processorId, { lastPollAt: new Date() });
      this.logger.debug(`No more items to go, relaunching`);
      return process.nextTick(this.pollHashtags.bind(this));
    }

    await ProcessorManager.update(this.processorId, { lastProcessedAt: new Date() });

    const item = items[0];

    try {
      console.log(`Calculating graph for ${item.name}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // const botScores = await getBotScores({ rawJson: JSON.stringify(items) });

      // let i = 0;
      // for (const user of items) {
      //   try {
      //     const botScore = botScores[i++];
      //     user.botScore = botScore.botScore;
      //     user.botScoreUpdatedAt = botScore.botScoreUpdatedAt;
      //     user.botScoreProvider = botScore.botScoreProvider;
      //     user.botScoreMetadata = botScore.botScoreMetadata;
      //     await user.save({ validateBeforeSave: false });
      //   } catch (e) {
      //     this.logger.error(`Could not get for ${user.username}`);
      //     this.logger.error(e);
      //   }
      // }
    } catch (e) {
      this.logger.error(`Could not calculate graph for ${item.name}`);
      this.logger.error(e.toString());
      return process.nextTick(this.pollHashtags.bind(this));
    }

    this.logger.info(`------- ${item.name} processed -------`);

    return process.nextTick(this.pollHashtags.bind(this));
  }
}
