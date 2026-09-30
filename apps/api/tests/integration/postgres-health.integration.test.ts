import { createDatabaseConnection } from '@seduc/database';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('PostgreSQL readiness integration', () => {
  if (!databaseTestUrl) {
    return;
  }

  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });

  afterAll(async () => {
    await database.disconnect();
  });

  it('executa SELECT 1 em uma instância PostgreSQL real', async () => {
    const response = await request(app).get('/health/ready').expect(200);

    expect(response.body.checks.database).toBe('up');
  });
});
