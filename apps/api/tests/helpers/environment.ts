import type { Environment } from '../../src/config/env.js';

export function createTestEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    API_PORT: 3000,
    CORS_ORIGIN: 'http://localhost:9000',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
    SESSION_TTL_HOURS: 8,
    corsOrigins: ['http://localhost:9000'],
    ...overrides,
  };
}
