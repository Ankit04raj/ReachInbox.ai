import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

prisma.$use(async (params: any, next: (param: any) => Promise<any>) => {
  const start = Date.now();
  const result = await next(params);
  const time = Date.now() - start;
  console.log(`Query took ${time}ms`);
  return result;
});

export default prisma;