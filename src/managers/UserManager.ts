import * as logging from 'common/logging';

import { ClientSession } from 'mongoose';
import Scraper from 'common/node-snscrape';
import UserModel from 'models/User';
import pick from 'lodash/fp/pick';

const scrapedFieldsUsed = [
  'id',
  'username',
  'displayname',
  'description',
  'verified',
  'created',
  'followersCount',
  'friendsCount',
  'statusesCount',
  'favouritesCount',
  'listedCount',
  'mediaCount',
  'location',
  'linkUrl',
  'profileImageUrl',
];

export const batchUpsert = (session: ClientSession = undefined) => async (
  users: any[],
  platformId: string
) => {
  const bulkQueries = users.map((user) => {
    return {
      updateOne: {
        filter: { id: user.id, platformId },
        update: {
          ...pick(scrapedFieldsUsed)(user),
          platformId,
        },
        upsert: true,
        session,
      },
    };
  });

  try {
    await UserModel.bulkWrite(bulkQueries);
  } catch (e) {
    logging.error(e);
    logging.error(JSON.stringify(users, null, 2));
    throw e;
  }
};

export const getOutdatedScoreBotUsers = async (
  { limit = 100 }: { limit: number } = { limit: 100 }
) => {
  const date = new Date();
  date.setDate(date.getDate() - 10);
  return UserModel.find({
    $or: [{ botScoreUpdatedAt: { $lte: date } }, { botScoreUpdatedAt: { $exists: false } }],
  }).limit(limit);
};

export const get = async ({ username }: { username: string }) => {
  return UserModel.findOne({ username });
};

export const getScrapedUser = async ({ username }: { username: string }) => {
  const user = await get({ username });

  if (user) {
    return { status: 'active', user };
  }

  const scrapedUser = Scraper.getUser(username);

  if (scrapedUser.user) {
    const newUser = new UserModel({
      ...pick(scrapedFieldsUsed)(scrapedUser.user),
      platformId: 'twitter',
    });
    await newUser.save({ validateBeforeSave: false });
    scrapedUser.user = newUser;
  }

  return scrapedUser;
};
