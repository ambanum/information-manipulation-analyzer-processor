import * as logging from 'common/logging';

import { ClientSession } from 'mongoose';
import UserModel from 'models/User';
import pick from 'lodash/fp/pick';

export const batchUpsert = (session: ClientSession) => async (users: any[], platformId: string) => {
  const bulkQueries = users.map((user) => {
    return {
      updateOne: {
        filter: { id: user.id, platformId },
        update: {
          ...pick([
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
          ])(user),
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