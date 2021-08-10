import * as UserManager from 'managers/UserManager';
import * as logging from 'common/logging';

import { GetBotScoreOptions, getBotScore } from 'botscore';
import express, { Express } from 'express';

import HashtagManager from 'managers/HashtagManager';

interface ServerProps {
  processorId: string;
  logger: logging.Logger;
}

const SERVER_PORT = process.env.SERVER_PORT || 4000;
export default class Server {
  private processorId: ServerProps['processorId'];
  private logger?: ServerProps['logger'];
  private app?: Express;

  constructor({ processorId, logger }: ServerProps) {
    this.logger = logger || logging.getLogger();
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

    this.app.get('/graph/twitter/hashtag/:hashtag', async (req, res) => {
      try {
        // const { hashtag } = req.params;
        // const hashtagManager = new HashtagManager({
        //   processorId: this.processorId,
        //   logger: this.logger,
        // });

        // const graphUrl = await hashtagManager.getByName(hashtag);
        // TODO
        res.json({
          graphUrl: 'http://localhost:3000/tflmi/EcritureInclusiveFinal.json',
          graphUpdatedAt: new Date(),
          graphMetadata: {},
          graphProvider: 'social-networks-graph-generator',
        });
      } catch (error) {
        res.json({ status: 'ko', message: 'Hashtag not found', error: error.toString() });
      }
    });

    this.app.listen(SERVER_PORT, () => {
      this.logger.info(`The application is listening on port ${SERVER_PORT}!`);
    });
  };
}
