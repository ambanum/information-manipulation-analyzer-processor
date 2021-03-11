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

export const batchUpsert = async (hashtag: string, volumetry: Volumetry, platformId: string) => {
  const dates = Object.keys(volumetry);

  await HashtagVolumetryModel.bulkWrite(
    dates.map((date) => {
      const {
        tweets,
        retweets,
        likes,
        quotes,
        languages,
        usernames,
        associatedHashtags,
      } = volumetry[date];
      return {
        updateOne: {
          filter: { date, platformId, hashtag },
          update: {
            $set: {
              nbTweets: tweets,
              nbRetweets: retweets,
              nbLikes: likes,
              nbQuotes: quotes,
              languages,
              usernames,
              associatedHashtags,
            },
          },
          upsert: true,
        },
      };
    })
  );
};
