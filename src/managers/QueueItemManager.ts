import * as logging from 'common/logging';
import QueueItemModel from '../models/QueueItem';
import { QueueItemActionTypes, QueueItemStatuses, QueueItem } from '../interfaces';

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

export const getPendingItems = async () => {
  logging.debug(`get PENDING items`);
  try {
    const query = { status: 'PENDING' };

    return {
      item: (await QueueItemModel.findOne(query)
        .sort({ priority: -1, _id: -1 })
        .populate('hashtag')) as QueueItem,
      count: await QueueItemModel.find(query).count(),
    };
  } catch (e) {
    console.error(e);
    throw new Error('Could not create queueItem');
  }
};

export const startProcessing = async (itemId: string, processorId: string) => {
  logging.debug(`Start processing for queueItem ${itemId} and processor ${processorId}`);
  try {
    await QueueItemModel.updateOne(
      { _id: itemId },
      { $set: { status: QueueItemStatuses.PROCESSING, processorId } }
    );
    // TODO update Hashtag too
  } catch (e) {
    console.error(e);
    throw new Error(
      `Could not start processing for queueItem ${itemId} and processor ${processorId}`
    );
  }
};
