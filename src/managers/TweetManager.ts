import * as logging from 'common/logging';

import TweetModel, { Tweet, TweetMedia } from 'models/Tweet';

import { ClientSession } from 'mongoose';
import { Tweet as SnscrapeTweet } from 'common/node-snscrape';
import mongoose from 'mongoose';
import omit from 'lodash/fp/omit';
import uniq from 'lodash/fp/uniq';

export const formatTweet = (scrapedTweet: SnscrapeTweet): Tweet => {
  const tweet: Tweet = omit([
    '_type', // induce error on save
    'url', // can be recreated with a dynamic field `https://twitter.com/${username}/status/${id}`
    'tcooutlinks', // same as outlinks
    'renderedContent', // not used as we use real `content` instead
    'source', // not used as can be recalculated easily with `sourceUrl` instead
    'sourceLabel', // not used as can be recalculated easily with `sourceUrl` instead
    'user', // replaced by username
    'inReplyToUser', // replaced by inReplyToUserName
    'quotedTweet', // replaced by quotedTweetId
    'retweetedTweet', // replaced by retweetedTweetId
    'mentionedUsers', // replaced by mentionedUsernames
  ])(scrapedTweet);
  tweet.username = scrapedTweet.user.username;
  tweet.inReplyToUsername = scrapedTweet.inReplyToUser ? scrapedTweet.inReplyToUser.username : null;
  tweet.inReplyToTweetId = scrapedTweet.inReplyToTweetId
    ? `${scrapedTweet.inReplyToTweetId}`
    : null;
  tweet.conversationId = scrapedTweet.conversationId ? `${scrapedTweet.conversationId}` : null;
  tweet.quotedTweetId = scrapedTweet.quotedTweet ? `${scrapedTweet.quotedTweet.id}` : null;
  tweet.retweetedTweetId = scrapedTweet.retweetedTweet ? `${scrapedTweet.retweetedTweet.id}` : null;
  tweet.mentionedUsernames = scrapedTweet.mentionedUsers
    ? scrapedTweet.mentionedUsers.map((u) => u.username)
    : null;
  tweet.coordinates = scrapedTweet.coordinates
    ? {
        type: 'Point',
        coordinates: Object.values(omit(['_type'])(scrapedTweet.coordinates) as number[]),
      }
    : null;
  tweet.place = scrapedTweet.place ? omit(['_type'])(scrapedTweet.place) : null;
  tweet.cashtags = scrapedTweet.cashtags
    ? uniq(scrapedTweet.cashtags.map((cashtag) => cashtag.toLowerCase()))
    : null;
  tweet.media = tweet.media
    ? scrapedTweet.media.map((media) => {
        const filteredMedia: TweetMedia = omit([
          'variants', // induce error on save
          '_type', // induce error on save
        ])(media);
        filteredMedia.type = media._type.replace('snscrape.modules.twitter.', '').toLowerCase();
        if (media.variants) {
          const variants: any[] = media.variants.sort((a: any, b: any) => b.bitrate - a.bitrate);
          const variant = variants[0];
          filteredMedia.fullUrl = variant.url;
          filteredMedia.bitrate = variant.bitrate;
          filteredMedia.contentType = variant.contentType;
        }
        return filteredMedia;
      })
    : null;

  // additional fields
  tweet.hour = `${scrapedTweet.date.replace(/\d\d:\d\d\+(.*)/, '00:00+$1')}`;
  return tweet;
};

export const batchUpsert = (session: ClientSession = undefined) => async (
  tweets: SnscrapeTweet[],
  searchId: string
) => {
  const bulkQueries = tweets.map((tweet) => {
    return {
      updateOne: {
        filter: { id: tweet.id },
        update: {
          $set: {
            ...formatTweet(tweet),
          },
          $addToSet: {
            searches: searchId,
          },
        },
        upsert: true,
        session,
      },
    };
  });

  try {
    await TweetModel.bulkWrite(bulkQueries);
  } catch (e) {
    logging.error(e);
    // logging.error(JSON.stringify(tweets, null, 2));
    process.exit();
    throw e;
  }
};
