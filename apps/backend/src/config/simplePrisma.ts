// Simple mock Prisma client for rapid prototyping
// In production, use full Prisma with proper migrations

interface PrismaClient {
  user: {
    findUnique: (args: { where: { id: string; googleId?: string; email?: string } }) => Promise<any>;
    create: (args: { data: any }) => Promise<any>;
    findFirst: (args: { where: any; take?: number }) => Promise<any>;
    findMany: (args: { where: any; orderBy?: any; take?: number }) => Promise<any>;
    upsert: (args: { where: any; update: any; create: any }) => Promise<any>;
    deleteMany: (args: { where: any }) => Promise<any>;
  };
  email: {
    create: (args: { data: any }) => Promise<any>;
    findUnique: (args: { where: { id: string } }) => Promise<any>;
    findMany: (args: { where: any; orderBy?: any; take?: number }) => Promise<any>;
    findFirst: (args: { where: any }) => Promise<any>;
    update: (args: { where: { id: string }; data: any }) => Promise<any>;
    updateMany: (args: { where: any; data: any }) => Promise<any>;
    deleteMany: (args: { where: any }) => Promise<any>;
  };
  sender: {
    findUnique: (args: { where: any }) => Promise<any>;
    findFirst: (args: { where: any }) => Promise<any>;
    create: (args: { data: any }) => Promise<any>;
    upsert: (args: { where: any; update: any; create: any }) => Promise<any>;
    update: (args: { where: any; data: any }) => Promise<any>;
  };
  slackToken: {
    findUnique: (args: { where: any }) => Promise<any>;
    update: (args: { where: any; data: any }) => Promise<any>;
    upsert: (args: { where: any; update: any; create: any }) => Promise<any>;
  };
}

const prisma = {} as PrismaClient;

export default prisma;