import './Hashtag';

import * as mongoose from 'mongoose';

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
    languages: { type: mongoose.Schema.Types.Mixed, default: {} },
    usernames: { type: mongoose.Schema.Types.Mixed, default: {} },
    associatedHashtags: { type: mongoose.Schema.Types.Mixed, default: {} },
    platformId: {
      type: String,
      required: true,
      index: true,
      enum: 'twitter',
      default: 'twitter',
    },
    hashtag: { type: Schema.Types.ObjectId, ref: 'Hashtag', index: true },
  },
  {
    strict: 'throw',
    timestamps: true,
  }
);

export default mongoose?.models?.HashtagVolumetry || mongoose.model('HashtagVolumetry', schema);
