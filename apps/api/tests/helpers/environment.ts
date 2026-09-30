import type { Environment } from '../../src/config/env.js';

export function createTestEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    API_PORT: 3000,
    CORS_ORIGIN: 'http://localhost:9000',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
    corsOrigins: ['http://localhost:9000'],
    ...overrides,
  };
}
