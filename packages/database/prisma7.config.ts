import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const validationOnlyUrl = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? validationOnlyUrl,
  },
});
