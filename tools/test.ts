import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: 'http://localhost:9200' });

(async () => {
  try {
    const volumetry = await client.search({
      index: 'tweets',
      body: {
        query: {
          bool: {
            filter: [
              // {
              //   terms: {
              //     hashtags: ['#boycottfrance'],
              //   },
              // },
              { match_phrase: { hashtags: '#boycottfrenchproducts' } },
            ],
          },
        },
        aggs: {
          hashtag: {
            date_histogram: {
              field: 'date',
              calendar_interval: '1d',
              // calendar_interval: '1h',
            },
            aggs: {
              retweetCount: {
                sum: {
                  field: 'retweetCount',
                },
              },
              likeCount: {
                sum: {
                  field: 'likeCount',
                },
              },
              replyCount: {
                sum: {
                  field: 'replyCount',
                },
              },
            },
          },
        },
      },
    });

    console.log(''); // eslint-disable-line
    console.log('╔════START══result══════════════════════════════════════════════════'); // eslint-disable-line
    console.log(JSON.stringify(volumetry, null, 2)); // eslint-disable-line
    console.log('╚════END════result══════════════════════════════════════════════════'); // eslint-disable-line
  } catch (e) {
    console.log(''); // eslint-disable-line
    console.log('╔════START══e══════════════════════════════════════════════════'); // eslint-disable-line
    console.log(JSON.stringify(e, null, 2)); // eslint-disable-line

    console.log('╚════END════e══════════════════════════════════════════════════'); // eslint-disable-line
  }
})();
