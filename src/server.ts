import * as UserManager from 'managers/UserManager';
import * as logging from 'common/logging';

import { GetBotScoreOptions, getBotScore } from 'botscore';
import express, { Express } from 'express';

interface ServerProps {
  processorId: string;
  logger: typeof logging;
}

const SERVER_PORT = process.env.SERVER_PORT || 4000;
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
    this.app.get('/scrape/twitter/user/:username', async (req, res) => {
      try {
        const { username } = req.params;
        const user = await UserManager.getScrapedUser({ username });

        res.json(user);
      } catch (error) {
        res.json({ status: 'ko', message: 'User not found', error: error.toString() });
      }
    });

    this.app.get('/scrape/twitter/user/:username/botscore', async (req, res) => {
      try {
        const { username } = req.params;
        const { user } = await UserManager.getScrapedUser({ username });
        const options: GetBotScoreOptions = {};

        if (!user) {
          return res.json({});
        }

        if (user?.botScore) {
          return res.json({
            botScore: user.botScore,
            botScoreUpdatedAt: user.botScoreUpdatedAt,
            botScoreProvider: user.botScoreProvider,
            botScoreMetadata: user.botScoreMetadata,
          });
        }

        options.rawJson = JSON.stringify(user);
        const botScore = await getBotScore(req.params.username, options);
        user.botScore = botScore.botScore;
        user.botScoreUpdatedAt = botScore.botScoreUpdatedAt;
        user.botScoreProvider = botScore.botScoreProvider;
        user.botScoreMetadata = botScore.botScoreMetadata;
        await user.save({ validateBeforeSave: false });
        return res.json(botScore);
      } catch (error) {
        res.json({ status: 'ko', message: 'Score not found', error: error.toString() });
      }
    });

    this.app.listen(SERVER_PORT, () => {
      this.logger.info(`The application is listening on port ${SERVER_PORT}!`);
    });
  };
}
