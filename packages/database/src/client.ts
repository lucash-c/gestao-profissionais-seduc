import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

export interface DatabaseConnection {
  readonly client: PrismaClient;
  disconnect(): Promise<void>;
  ping(): Promise<void>;
}

export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
    max: 5,
  });
  const client = new PrismaClient({ adapter });

  return {
    client,
    async disconnect() {
      await client.$disconnect();
    },
    async ping() {
      await client.$queryRaw`SELECT 1`;
    },
  };
}
