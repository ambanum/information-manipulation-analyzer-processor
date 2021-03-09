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

export interface Hashtag {
  _id: string;
  name: string;
  status: 'PENDING' | 'DONE';
  firstOccurence?: string;
  lastProcessedStartDate?: string;
  lastProcessedEndDate?: string;
}

export interface GetHashtagsResponse extends CommonResponse {
  hashtags: Hashtag[];
}

export interface CreateHashtagInput extends CommonResponse {
  name: string;
}

/**
 * QueueItem
 */

export enum QueueItemActionTypes {
  HASHTAG = 'HASHTAG',
}

export enum QueueItemStatuses {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  DONE_ERROR = 'DONE_ERROR',
}

export interface QueueItem {
  _id: string;
  name: string;
  action: QueueItemActionTypes;
  status: QueueItemStatuses;
  hashtag: Hashtag;
}
