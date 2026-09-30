import type { DatabaseConnection } from '@seduc/database';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { createTestEnvironment } from '../helpers/environment.js';

const fixedDate = new Date('2026-09-30T15:00:00.000Z');

function createDatabase(overrides: Partial<DatabaseConnection> = {}): DatabaseConnection {
  return {
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('health endpoints', () => {
  it('responde ao liveness sem consultar o banco', async () => {
    const database = createDatabase();
    const app = createApp({
      clock: () => fixedDate,
      database,
      environment: createTestEnvironment(),
    });

    const response = await request(app).get('/health/live').expect(200);

    expect(response.body).toEqual({
      service: 'seduc-api',
      status: 'ok',
      timestamp: fixedDate.toISOString(),
    });
    expect(database.ping).not.toHaveBeenCalled();
  });

  it('responde ready quando o PostgreSQL está acessível', async () => {
    const app = createApp({
      clock: () => fixedDate,
      database: createDatabase(),
      environment: createTestEnvironment(),
    });

    const response = await request(app).get('/health/ready').expect(200);

    expect(response.body).toEqual({
      checks: { database: 'up' },
      service: 'seduc-api',
      status: 'ready',
      timestamp: fixedDate.toISOString(),
    });
  });

  it('responde 503 sem expor detalhes quando o PostgreSQL está indisponível', async () => {
    const app = createApp({
      clock: () => fixedDate,
      database: createDatabase({
        ping: vi.fn().mockRejectedValue(new Error('senha secreta inválida')),
      }),
      environment: createTestEnvironment(),
    });

    const response = await request(app).get('/health/ready').expect(503);

    expect(response.body).toEqual({
      checks: { database: 'down' },
      service: 'seduc-api',
      status: 'unavailable',
      timestamp: fixedDate.toISOString(),
    });
    expect(response.text).not.toContain('senha secreta');
  });
});
