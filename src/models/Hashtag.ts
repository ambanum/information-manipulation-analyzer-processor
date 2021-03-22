import * as mongoose from 'mongoose';

const { Schema } = mongoose;

enum hashtagStatuses {
  PENDING = 'PENDING',
  DONE = 'DONE',
}

const schema = new Schema(
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
      enum: Object.values(hashtagStatuses),
    },
    metadata: {
      lastEvaluatedTweetId: {
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

export default mongoose?.models?.Hashtag || mongoose.model('Hashtag', schema);
