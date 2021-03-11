import * as logging from 'common/logging';
import HashtagModel from 'models/Hashtag';

export const up = async (hashtag: string, volumetry: Volumetry, platformId: string) => {
  const dates = Object.keys(volumetry);

  await HashtagModel.bulkWrite(
    dates.map((date) => {
      const { tweets, retweets, likes, quotes } = volumetry[date];
      return {
        updateOne: {
          filter: { date, platformId, hashtag },
          update: {
            $set: { nbTweets: tweets, nbRetweets: retweets, nbLikes: likes, nbQuotes: quotes },
          },
          upsert: true,
        },
      };
    })
  );
};
