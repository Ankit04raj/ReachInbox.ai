import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

export const ensureIndexExists = async () => {
  const indexExists = await esClient.indices.exists({
    index: 'emails',
  });

  if (!indexExists) {
    await esClient.indices.create({
      index: 'emails',
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            recipient: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      },
    });
    console.log('Elasticsearch index "emails" created');
  }
};

export default esClient;