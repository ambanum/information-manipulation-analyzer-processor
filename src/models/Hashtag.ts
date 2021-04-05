import { Document, Model, Schema, model } from 'mongoose';

export enum HashtagStatuses {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE_FIRST_FETCH = 'DONE_FIRST_FETCH',
  PROCESSING_PREVIOUS = 'PROCESSING_PREVIOUS',
  DONE = 'DONE',
  DONE_ERROR = 'DONE_ERROR',
}

export interface Hashtag extends Document {
  name: string;
  status: HashtagStatuses;
  metadata?: {
    lastEvaluatedUntilTweetId?: string;
  };
  firstOccurenceDate?: string | Date;
  oldestProcessedDate?: string | Date;
  newestProcessedDate?: string | Date;
}

const HashtagSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      index: true,
      enum: Object.values(HashtagStatuses),
    },
    metadata: {
      lastEvaluatedUntilTweetId: {
        type: String,
        index: true,
      },
    },
    firstOccurenceDate: {
      type: Date,
      index: true,
    },
    oldestProcessedDate: {
      type: Date,
      index: true,
    },
    newestProcessedDate: {
      type: Date,
      index: true,
    },
  },
  {
    strict: 'throw',
    timestamps: true,
  }
);

const HashtagModel: Model<Hashtag> = model('Hashtag', HashtagSchema);

export default HashtagModel;
