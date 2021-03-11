import * as mongoose from 'mongoose';
import './Hashtag';

const { Schema } = mongoose;

const schema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    nbTweets: {
      type: Number,
      required: true,
      index: true,
    },
    nbRetweets: {
      type: Number,
      required: true,
      index: true,
    },
    nbLikes: {
      type: Number,
      required: true,
      index: true,
    },
    nbQuotes: {
      type: Number,
      required: true,
      index: true,
    },
    platformId: {
      type: String,
      required: true,
      index: true,
      enum: 'twitter',
      default: 'twitter',
    },
    hashtag: { type: Schema.Types.ObjectId, ref: 'Hashtag' },
  },
  {
    strict: 'throw',
    timestamps: true,
  }
);

export default mongoose?.models?.HashtagVolumetry || mongoose.model('HashtagVolumetry', schema);
