import mongoose, { Document, Schema } from 'mongoose';

export interface UserBotScore {
  botScore?: number;
  botScoreProvider?: string;
  botScoreUpdatedAt?: string | Date;
  botScoreMetadata?: any;
}
export interface BasicUser extends Document {
  id: string;
  platformId: 'twitter';
  username: string;
  displayname: string;
  description?: string;
  verified?: boolean;
  created?: string;
  followersCount?: number;
  friendsCount?: number;
  statusesCount?: number;
  favouritesCount?: number;
  listedCount?: number;
  mediaCount?: number;
  location?: string;
  linkUrl?: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;

  // bot score
  botScore?: number;
  botScoreProvider?: string;
  botScoreUpdatedAt?: string | Date;
  botScoreMetadata?: any;

  // links to be able to easily get all users concerned by a search
  searches: string[];
}

export type User = BasicUser & UserBotScore;

const UserSchema = new Schema<User>(
  {
    id: { type: String, required: true, index: true },
    platformId: { type: String, required: true, index: true },
    username: { type: String, required: true, index: true },
    displayname: { type: String, required: true, index: true },
    description: { type: String, required: true, index: true },
    verified: { type: Boolean, required: true, index: true },
    created: { type: Date, required: true, index: true },
    followersCount: { type: Number, required: true, index: true },
    friendsCount: { type: Number, required: true, index: true },
    statusesCount: { type: Number, required: true, index: true },
    favouritesCount: { type: Number, required: true, index: true },
    listedCount: { type: Number, required: true, index: true },
    mediaCount: { type: Number, required: true, index: true },
    location: { type: String, required: true, index: true },
    linkUrl: { type: String, required: true, index: true },
    profileImageUrl: { type: String, required: true, index: true },
    // bot score
    botScore: { type: Number, index: true },
    botScoreProvider: { type: String, index: true },
    botScoreUpdatedAt: { type: Date, index: true },
    botScoreMetadata: { type: Schema.Types.Mixed },
    // links to be able to easily get all users concerned by a search
    searches: [{ type: Schema.Types.ObjectId, index: true }],
  },
  {
    strict: 'throw',
    timestamps: true,
  }
);

export default mongoose?.models?.User || mongoose.model('User', UserSchema);
