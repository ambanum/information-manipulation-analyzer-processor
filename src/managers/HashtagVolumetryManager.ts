import * as logging from 'common/logging';
import HashtagVolumetryModel from 'models/HashtagVolumetry';

export interface Volumetry {
  [key: string]: {
    tweets: number;
    retweets: number;
  };
}

export const batchUpsert = async (hashtag: string, volumetry: Volumetry, platformId: string) => {
  const dates = Object.keys(volumetry);

  HashtagVolumetryModel.bulkWrite(
    dates.map((date) => {
      const { tweets, retweets } = volumetry[date];
      console.log(date, tweets, retweets);
      return {
        updateOne: {
          filter: { date, platformId, hashtag },
          update: { $set: { nbTweets: tweets, nbRetweets: retweets } },
          upsert: true,
        },
      };
    })
  );
};
