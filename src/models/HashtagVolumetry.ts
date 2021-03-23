import { Document, Model, Schema, model } from 'mongoose';

import { Hashtag } from './Hashtag';

export interface HashtagVolumetry extends Document {
  date: string;
  nbTweets?: number;
  nbRetweets?: number;
  nbLikes?: number;
  nbQuotes?: number;
  languages?: { [key: string]: number };
  usernames?: { [key: string]: number };
  associatedHashtags?: { [key: string]: number };
  platformId?: 'twitter';
  hashtag?: Hashtag;
}

const HashtagVolumetrySchema = new Schema(
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
    languages: { type: Schema.Types.Mixed, default: {} },
    usernames: { type: Schema.Types.Mixed, default: {} },
    associatedHashtags: { type: Schema.Types.Mixed, default: {} },
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

const HashtagVolumetryModel: Model<HashtagVolumetry> = model(
  'HashtagVolumetry',
  HashtagVolumetrySchema
);

export default HashtagVolumetryModel;
