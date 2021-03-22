import * as logging from 'common/logging';

import { HashtagStatuses, QueueItem, QueueItemActionTypes, QueueItemStatuses } from '../interfaces';

import HashtagModel from '../models/Hashtag';
import QueueItemModel from '../models/QueueItem';

export const resetOutdated = async (processorId: string) => {
  logging.debug(`reset outdated items for processorId ${processorId}`);
  try {
    return QueueItemModel.updateMany(
      { status: 'PROCESSING', processorId },
      { $set: { status: 'PENDING', processorId: null } }
    );
  } catch (e) {
    logging.error(e);
    throw new Error('Could not reset outdated queueItems');
  }
};

export const PRIORITIES = {
  NOW: 0,
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
};

export const create = async (
  hashtag: string,
  {
    lastEvaluatedTweetId,
    priority = PRIORITIES.NOW,
  }: { lastEvaluatedTweetId?: string; priority?: number } = {}
) => {
  try {
    const queueItem = new QueueItemModel({
      priority,
      action: QueueItemActionTypes.HASHTAG,
      status: QueueItemStatuses.PENDING,
      hashtag,
      ...(lastEvaluatedTweetId
        ? {
            metadata: {
              lastEvaluatedTweetId,
            },
          }
        : {}),
    });
    await queueItem.save();

    return queueItem;
  } catch (e) {
    console.error(e);
    throw new Error('Could not create queueItem');
  }
};

export const getPendingItems = async () => {
  logging.debug(`get PENDING items`);
  try {
    const query = { status: 'PENDING' };

    return {
      item: (await QueueItemModel.findOne(query)
        .sort({ priority: 1, _id: -1 })
        .populate('hashtag')) as QueueItem,
      count: await QueueItemModel.find(query).countDocuments(),
    };
  } catch (e) {
    console.error(e);
    throw new Error('Could not create queueItem');
  }
};

export const startProcessing = async (item: QueueItem, processorId: string, previous?: boolean) => {
  logging.debug(
    `Start processing for queueItem ${item._id} (pr:${item.priority}) and processor ${processorId}`
  );
  try {
    await QueueItemModel.updateOne(
      { _id: item._id },
      { $set: { status: QueueItemStatuses.PROCESSING, processorId } }
    );
    await HashtagModel.updateOne(
      { _id: item.hashtag },
      { $set: { status: HashtagStatuses[previous ? 'PROCESSING_PREVIOUS' : 'PROCESSING'] } }
    );
    // TODO update Hashtag too
  } catch (e) {
    console.error(e);
    throw new Error(
      `Could not start processing for queueItem ${item._id} and processor ${processorId}`
    );
  }
};

export const stopProcessing = async (
  item: QueueItem,
  processorId: string,
  hashtagData: {
    metadata?: { lastEvaluatedTweetId?: string };
    firstOccurenceDate?: string;
    newestProcessedDate?: string | Date;
    oldestProcessedDate?: string | Date;
    status?: HashtagStatuses;
  }
) => {
  logging.debug(`Stop processing for queueItem ${item._id} and processor ${processorId}`);
  try {
    await QueueItemModel.updateOne(
      { _id: item._id },
      { $set: { status: QueueItemStatuses.DONE, processorId } }
    );

    await HashtagModel.updateOne(
      { _id: item.hashtag },
      { $set: { status: HashtagStatuses.DONE, ...hashtagData } }
    );
  } catch (e) {
    console.error(e);
    throw new Error(
      `Could not stop processing for queueItem ${item._id} and processor ${processorId}`
    );
  }
};
