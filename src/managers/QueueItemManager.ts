import * as logging from 'common/logging';

import { ClientSession, FilterQuery } from 'mongoose';
import {
  QueueItem,
  QueueItemActionTypes,
  QueueItemStatuses,
  Search,
  SearchStatuses,
} from '../interfaces';

import QueueItemModel from '../models/QueueItem';
import SearchModel from '../models/Search';

interface QueueItemManagerProps {
  processorId: string;
  logger: logging.Logger;
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
    this.logger = logger || logging.getLogger();
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

  create = async (
    search: string,
    {
      lastEvaluatedUntilTweetId,
      lastEvaluatedSinceTweetId,
      priority = QueueItemManager.PRIORITIES.NOW,
      processingDate,
      action = QueueItemActionTypes.SEARCH,
    }: {
      lastEvaluatedUntilTweetId?: string;
      lastEvaluatedSinceTweetId?: string;
      priority?: number;
      processingDate?: Date;
      action?: QueueItemActionTypes;
    } = {}
  ) => {
    try {
      const queueItems = await QueueItemModel.create(
        [
          {
            priority,
            action,
            status: QueueItemStatuses.PENDING,
            processingDate,
            search,
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

  createMissingQueueItemsIfNotExist = async () => {
    const searches = await SearchModel.aggregate([
      {
        $lookup: {
          from: 'queueitems',
          localField: '_id',
          foreignField: 'search',
          as: 'queueitems',
        },
      },
      {
        $sort: {
          'queueitems.createdAt': 1,
        },
      },
    ]);

    searches.map(async (search) => {
      const hasRetweet = search.queueitems.some(
        ({ action }) => action === QueueItemActionTypes.RETWEETS
      );
      const nbQueueItems = search.queueitems.length;
      if (!hasRetweet && nbQueueItems > 10) {
        await QueueItemModel.create(
          [
            {
              action: QueueItemActionTypes.RETWEETS,
              status: QueueItemStatuses.PENDING,
              priority: QueueItemManager.PRIORITIES.HIGH,
              processingDate: new Date(),
              search: search._id,
              metadata: search.queueitems[2].metadata,
            },
          ],
          this.session ? { session: this.session } : {}
        );
      }
    });
  };

  getPendingSearches = async (
    action = QueueItemActionTypes.SEARCH,
    minPriority: number = QueueItemManager.PRIORITIES.NOW
  ) => {
    this.logger.debug(`get PENDING items`);
    try {
      const query: FilterQuery<QueueItem> = {
        status: QueueItemStatuses.PENDING,
        action,
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
      ).populate('search');

      return {
        item,
        count,
      };
    } catch (e) {
      console.error(e);
      throw new Error('Could not create queueItem');
    }
  };

  startProcessingSearch = async (
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
      await SearchModel.updateOne(
        { _id: item.search },
        {
          $set: {
            scrapeVersion: this.scrapeVersion,
            status:
              SearchStatuses[
                previous
                  ? SearchStatuses.PROCESSING_PREVIOUS
                  : next
                  ? SearchStatuses.PROCESSING_NEW
                  : SearchStatuses.PROCESSING
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

  stopProcessingSearch = async (
    item: QueueItem,
    itemData: Partial<QueueItem>,
    searchData: Partial<Search>
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

      await SearchModel.updateOne(
        { _id: item.search },
        { $set: { status: SearchStatuses.DONE, error: null, ...searchData } },
        this.session ? { session: this.session } : {}
      );
    } catch (e) {
      this.logger.error(e);
      throw new Error(
        `Could not stop processing for queueItem ${item._id} and processor ${this.processorId}`
      );
    }
  };

  stopProcessingSearchWithError = async (item: QueueItem, searchData: Partial<Search>) => {
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
            error: searchData.error,
          },
        },
        this.session ? { session: this.session } : {}
      );

      await SearchModel.updateOne(
        { _id: item.search },
        { $set: { status: SearchStatuses.DONE_ERROR, ...searchData } },
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

  startProcessingRetweets = async (item: QueueItem) => {
    this.logger.debug(
      `Start processing Retweets for queueItem ${item._id} (pr:${item.priority}) and processor ${this.processorId}`
    );
    try {
      await QueueItemModel.updateOne(
        { _id: item._id },
        { $set: { status: QueueItemStatuses.PROCESSING, processorId: this.processorId } }
      );
    } catch (e) {
      this.logger.error(e);
      throw new Error(
        `Could not start processing Retweets for queueItem ${item._id} and processor ${this.processorId}`
      );
    }
  };

  stopProcessingRetweets = async (item: QueueItem, itemData: Partial<QueueItem>) => {
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
    } catch (e) {
      this.logger.error(e);
      throw new Error(
        `Could not stop processing for queueItem ${item._id} and processor ${this.processorId}`
      );
    }
  };
}
