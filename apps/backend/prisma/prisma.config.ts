import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  dbColumnIntegrity: 'strict',
  experimental: {
    // Enable for Prisma 7
  }
});