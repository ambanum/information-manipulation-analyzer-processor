import { Document, Model, Schema, model } from 'mongoose';

export interface User extends Document {
  id: string;
  platformId: 'twitter';
  username: string;
  displayname: string;
  description: string;
  verified: boolean;
  created: Date;
  followersCount: number;
  friendsCount: number;
  statusesCount: number;
  favouritesCount: number;
  listedCount: number;
  mediaCount: number;
  location: string;
  linkUrl: string;
  profileImageUrl: string;
}

const UserSchema = new Schema(
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
  },
  {
    strict: 'throw',
    timestamps: true,
  }
);

const UserModel: Model<User> = model('User', UserSchema);

export default UserModel;
