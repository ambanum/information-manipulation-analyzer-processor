import { Hashtag as ModelHashtag } from 'models/Hashtag';
import { Processor as ModelProcessor } from 'models/Processor';
import { QueueItem as ModelQueueItem } from 'models/QueueItem';

export { HashtagStatuses } from 'models/Hashtag';
export { QueueItemActionTypes, QueueItemStatuses } from 'models/QueueItem';

/**
 * Common
 */

export interface CommonResponse {
  status: 'ok' | 'ko';
  message?: string;
}

/**
 * Hashtag
 */

export type Hashtag = ModelHashtag;

export interface GetHashtagsResponse extends CommonResponse {
  hashtags: Hashtag[];
}

export interface CreateHashtagInput extends CommonResponse {
  name: string;
}

/**
 * QueueItem
 */
export type QueueItem = ModelQueueItem;

/**
 * Processor
 */
export type Processor = ModelProcessor;
