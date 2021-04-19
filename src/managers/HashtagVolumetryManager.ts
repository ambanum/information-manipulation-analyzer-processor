import * as logging from 'common/logging';

import { ClientSession } from 'mongoose';
import HashtagVolumetryModel from 'models/HashtagVolumetry';

export interface Volumetry {
  [key: string]: {
    tweets: number;
    retweets: number;
    likes: number;
    quotes: number;
    languages: { [key: string]: number };
    usernames: { [key: string]: number };
    associatedHashtags: { [key: string]: number };
  };
}

export const batchUpsert = (session: ClientSession) => async (
  hashtag: string,
  volumetry: Volumetry,
  platformId: string
) => {
  const dates = Object.keys(volumetry);

  const bulkQueries = dates.map((date) => {
    const { tweets, retweets, likes, quotes, languages, usernames, associatedHashtags } = volumetry[
      date
    ];

    const languagesInc = Object.keys(languages).reduce(
      (acc: any, language) => ({
        ...acc,
        [`languages.${language}`]: languages[language],
      }),
      {}
    );
    const usernamesInc = Object.keys(usernames).reduce(
      (acc: any, username) => ({
        ...acc,
        [`usernames.${username}`]: usernames[username],
      }),
      {}
    );
    const associatedHashtagsInc = Object.keys(associatedHashtags).reduce(
      (acc: any, associatedHashtag) => ({
        ...acc,
        [`associatedHashtags.${associatedHashtag}`]: associatedHashtags[associatedHashtag],
      }),
      {}
    );

    return {
      updateOne: {
        filter: { date, platformId, hashtag },
        update: {
          $inc: {
            nbTweets: tweets,
            nbRetweets: retweets,
            nbLikes: likes,
            nbQuotes: quotes,
            ...languagesInc,
            ...usernamesInc,
            ...associatedHashtagsInc,
          },
        },
        upsert: true,
        session,
      },
    };
  });

  try {
    await HashtagVolumetryModel.bulkWrite(bulkQueries);
  } catch (e) {
    logging.error(e);
    logging.error(JSON.stringify(volumetry, null, 2));
    throw e;
  }
};
