import { Processor as ModelProcessor } from 'models/Processor';
import { QueueItem as ModelQueueItem } from 'models/QueueItem';
import { Search as ModelSearch } from 'models/Search';

export { SearchStatuses } from 'models/Search';
export { QueueItemActionTypes, QueueItemStatuses } from 'models/QueueItem';

/**
 * Common
 */

export interface CommonResponse {
  status: 'ok' | 'ko';
  message?: string;
}

/**
 * Search
 */

export type Search = ModelSearch;

export interface GetSearchesResponse extends CommonResponse {
  searches: Search[];
}

export interface CreateSearchInput extends CommonResponse {
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
