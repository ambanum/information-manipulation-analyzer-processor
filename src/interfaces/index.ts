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

export enum HashtagStatuses {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE_FIRST_FETCH = 'DONE_FIRST_FETCH',
  PROCESSING_PREVIOUS = 'PROCESSING_PREVIOUS',
  DONE = 'DONE',
  DONE_ERROR = 'DONE_ERROR',
}

export interface Hashtag {
  _id: string;
  name: string;
  status: HashtagStatuses;
  metadata?: {
    lastEvaluatedTweetId?: string;
  };
  firstOccurenceDate?: string;
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
  priority: number;
  action: QueueItemActionTypes;
  status: QueueItemStatuses;
  hashtag: Hashtag;
  metadata?: {
    lastEvaluatedTweetId?: string;
  };
}
