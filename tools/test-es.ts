import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: 'http://localhost:9200' });

(async () => {
  const { body: bulkResponse } = await client.bulk({
    refresh: true,
    body: [
      { index: { _index: 'tests', _id: '1', _op_type: 'update' } },
      {
        id: '1',
        username: 'martin',
        keywords: ['test1'],
      },
    ],
  });
  console.log(''); //eslint-disable-line
  console.log('╔════START════════════════════════════════════════════════════'); //eslint-disable-line
  console.log(bulkResponse); //eslint-disable-line
  console.log('╚════END══════════════════════════════════════════════════════'); //eslint-disable-line
})();
