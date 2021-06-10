import * as logging from 'common/logging';

import { ClientSession, FilterQuery } from 'mongoose';
import {
  Hashtag,
  HashtagStatuses,
  QueueItem,
  QueueItemActionTypes,
  QueueItemStatuses,
} from '../interfaces';

import HashtagModel from '../models/Hashtag';
import QueueItemModel from '../models/QueueItem';

interface QueueItemManagerProps {
  processorId: string;
  logger: typeof logging;
  session?: ClientSession;
  scrapeVersion: number;
}

export default class QueueItemManager {
  private processorId: QueueItemManagerProps['processorId'];
  private logger?: QueueItemManagerProps['logger'];
  private session?: QueueItemManagerProps['session'];
  private scrapeVersion?: QueueItemManagerProps['scrapeVersion'];
  public static PRIORITIES = {
    NOW: 0,
    URGENT: 1,
    HIGH: 2,
    MEDIUM: 3,
  };
  constructor({ processorId, logger, session, scrapeVersion }: QueueItemManagerProps) {
    this.logger = logger || logging;
    this.processorId = processorId;
    this.session = session;
    this.scrapeVersion = scrapeVersion;
  }

  resetOutdated = async (action: QueueItemActionTypes) => {
    this.logger.info(`reset outdated items for processorId ${this.processorId}`);
    try {
      return QueueItemModel.updateMany(
        {
          $or: [
            { status: QueueItemStatuses.PROCESSING, processorId: this.processorId },
            {
              status: QueueItemStatuses.DONE_ERROR,
              processorId: this.processorId,
              error: /Command failed/gim,
            },
          ],
          action,
        },
        { $set: { status: QueueItemStatuses.PENDING, processorId: null } }
      );
    } catch (e) {
      this.logger.error(e);
      throw new Error('Could not reset outdated queueItems');
    }
  };

  createHashtag = async (
    hashtag: string,
    {
      lastEvaluatedUntilTweetId,
      lastEvaluatedSinceTweetId,
      priority = QueueItemManager.PRIORITIES.NOW,
      processingDate,
    }: {
      lastEvaluatedUntilTweetId?: string;
      lastEvaluatedSinceTweetId?: string;
      priority?: number;
      processingDate?: Date;
    } = {}
  ) => {
    try {
      const queueItems = await QueueItemModel.create(
        [
          {
            priority,
            action: QueueItemActionTypes.HASHTAG,
            status: QueueItemStatuses.PENDING,
            processingDate,
            hashtag,
            ...(lastEvaluatedUntilTweetId
              ? {
                  metadata: {
                    lastEvaluatedUntilTweetId,
                  },
                }
              : {}),
            ...(lastEvaluatedSinceTweetId
              ? {
                  metadata: {
                    lastEvaluatedSinceTweetId,
                  },
                }
              : {}),
          },
        ],
        this.session ? { session: this.session } : {}
      );

      return queueItems[0];
    } catch (e) {
      this.logger.error(e);
      throw new Error('Could not create queueItem');
    }
  };

  getPendingHashtags = async (minPriority: number = QueueItemManager.PRIORITIES.NOW) => {
    this.logger.debug(`get PENDING items`);
    try {
      const query: FilterQuery<QueueItem> = {
        status: QueueItemStatuses.PENDING,
        action: QueueItemActionTypes.HASHTAG,
        processingDate: { $lte: new Date() },
        priority: { $gte: minPriority },
      };

      const count = await QueueItemModel.find(query).countDocuments();

      const item: QueueItem = await QueueItemModel.findOneAndUpdate(
        query,
        {
          $set: { status: QueueItemStatuses.PROCESSING, processorId: this.processorId },
        },
        {
          setDefaultsOnInsert: true,
          sort: { priority: 1, _id: -1 },
        }
      ).populate('hashtag');

      return {
        item,
        count,
      };
    } catch (e) {
      console.error(e);
      throw new Error('Could not create queueItem');
    }
  };

  startProcessingHashtag = async (
    item: QueueItem,
    { previous, next }: { previous?: boolean; next?: boolean }
  ) => {
    this.logger.debug(
      `Start processing for queueItem ${item._id} (pr:${item.priority}) and processor ${this.processorId}`
    );
    try {
      await QueueItemModel.updateOne(
        { _id: item._id },
        { $set: { status: QueueItemStatuses.PROCESSING, processorId: this.processorId } }
      );
      await HashtagModel.updateOne(
        { _id: item.hashtag },
        {
          $set: {
            scrapeVersion: this.scrapeVersion,
            status:
              HashtagStatuses[
                previous
                  ? HashtagStatuses.PROCESSING_PREVIOUS
                  : next
                  ? HashtagStatuses.PROCESSING_NEW
                  : HashtagStatuses.PROCESSING
              ],
          },
        }
      );
    } catch (e) {
      this.logger.error(e);
      throw new Error(
        `Could not start processing for queueItem ${item._id} and processor ${this.processorId}`
      );
    }
  };

  stopProcessingHashtag = async (
    item: QueueItem,
    itemData: Partial<QueueItem>,
    hashtagData: Partial<Hashtag>
  ) => {
    this.logger.debug(
      `Stop processing for queueItem ${item._id} and processor ${this.processorId}`
    );
    try {
      await QueueItemModel.updateOne(
        { _id: item._id },
        {
          $set: {
            status: QueueItemStatuses.DONE,
            processorId: this.processorId,
            ...itemData,
          },
        },
        this.session ? { session: this.session } : {}
      );

      await HashtagModel.updateOne(
        { _id: item.hashtag },
        { $set: { status: HashtagStatuses.DONE, error: null, ...hashtagData } },
        this.session ? { session: this.session } : {}
      );
    } catch (e) {
      this.logger.error(e);
      throw new Error(
        `Could not stop processing for queueItem ${item._id} and processor ${this.processorId}`
      );
    }
  };
  stopProcessingHashtagWithError = async (item: QueueItem, hashtagData: Partial<Hashtag>) => {
    this.logger.debug(
      `Stop processing with error for queueItem ${item._id} and processor ${this.processorId}`
    );
    try {
      await QueueItemModel.updateOne(
        { _id: item._id },
        {
          $set: {
            status: QueueItemStatuses.DONE_ERROR,
            processorId: this.processorId,
            error: hashtagData.error,
          },
        },
        this.session ? { session: this.session } : {}
      );

      await HashtagModel.updateOne(
        { _id: item.hashtag },
        { $set: { status: HashtagStatuses.DONE_ERROR, ...hashtagData } },
        this.session ? { session: this.session } : {}
      );

      // TODO
      // Send email
    } catch (e) {
      console.error(e);
      throw new Error(
        `Could not stop processing with error for queueItem ${item._id} and processor ${this.processorId}`
      );
    }
  };
}
