import 'dotenv/config';
import prisma from './prisma';
import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  requestTimeout: 5000, maxRetries: 1,
});

export const ensureIndexExists = async () => {
  const indexExists = await esClient.indices.exists({
    index: 'emails',
  });

  if (!indexExists) {
    try { await esClient.indices.create({
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
    } catch(err:any) { if(err?.meta?.body?.error?.type!=='resource_already_exists_exception')throw err; }
    await prisma.$executeRaw`UPDATE "Email" SET "indexedAt"=NULL`;
    console.log('Elasticsearch index ready; rebuilding email documents');
  }
};

export default esClient;