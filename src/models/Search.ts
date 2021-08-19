import { Document, Model, Schema, model, models } from 'mongoose';

import { UrlScraperResponse } from 'url-scraper';

export enum SearchStatuses {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE_FIRST_FETCH = 'DONE_FIRST_FETCH',
  PROCESSING_PREVIOUS = 'PROCESSING_PREVIOUS',
  PROCESSING_NEW = 'PROCESSING_NEW',
  DONE = 'DONE',
  DONE_ERROR = 'DONE_ERROR',
}

export enum SearchTypes {
  KEYWORD = 'KEYWORD',
  HASHTAG = 'HASHTAG',
  MENTION = 'MENTION',
  URL = 'URL',
  CASHTAG = 'CASHTAG',
}

export interface Search extends Document {
  name: string;
  status: SearchStatuses;
  metadata?: {
    lastEvaluatedUntilTweetId?: string;
    url?: UrlScraperResponse;
  };
  type: SearchTypes;
  firstOccurenceDate?: string | Date;
  oldestProcessedDate?: string | Date;
  newestProcessedDate?: string | Date;
  error?: string;
}

const schema = new Schema<Search>(
  {
    name: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true, enum: Object.values(SearchStatuses) },
    metadata: {
      lastEvaluatedUntilTweetId: { type: String, index: true },
      url: { type: Schema.Types.Mixed },
    },
    firstOccurenceDate: { type: Date, index: true },
    oldestProcessedDate: { type: Date, index: true },
    newestProcessedDate: { type: Date, index: true },
    error: { type: String, index: true },
    scrapeVersion: { type: Number, index: true },
  },
  {
    strict: 'throw',
    timestamps: true,
  }
);

const SearchModel: Model<Search> = models.Search || model('Search', schema);

export default SearchModel;
