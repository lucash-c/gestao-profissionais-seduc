import { describe, expect, it } from 'vitest';

import { loadEnvironment } from '../../src/config/env.js';

describe('loadEnvironment', () => {
  it('valida e normaliza a configuração da API', () => {
    const environment = loadEnvironment({
      API_PORT: '3100',
      CORS_ORIGIN: 'http://localhost:9000, https://seduc.example.test',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/seduc',
      LOG_LEVEL: 'warn',
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
      SESSION_TTL_HOURS: '12',
      TRUST_PROXY_HOPS: '1',
    });

    expect(environment.API_PORT).toBe(3100);
    expect(environment.SESSION_TTL_HOURS).toBe(12);
    expect(environment.TRUST_PROXY_HOPS).toBe(1);
    expect(environment.corsOrigins).toEqual([
      'http://localhost:9000',
      'https://seduc.example.test',
    ]);
  });

  it('usa zero proxies confiáveis por padrão e rejeita valores inseguros', () => {
    const environment = loadEnvironment({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/seduc',
      SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
    });

    expect(environment.TRUST_PROXY_HOPS).toBe(0);
    expect(() =>
      loadEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/seduc',
        SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
        TRUST_PROXY_HOPS: '-1',
      }),
    ).toThrow('TRUST_PROXY_HOPS');
  });

  it('rejeita uma URL de banco que não seja PostgreSQL', () => {
    expect(() =>
      loadEnvironment({
        DATABASE_URL: 'mysql://user:password@localhost:3306/seduc',
        SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
      }),
    ).toThrow('DATABASE_URL');
  });

  it('rejeita segredo de sessão curto ou mantido como placeholder', () => {
    expect(() =>
      loadEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/seduc',
        SESSION_SECRET: 'curto',
      }),
    ).toThrow('SESSION_SECRET');

    expect(() =>
      loadEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/seduc',
        SESSION_SECRET: 'change-me-generate-at-least-32-random-characters',
      }),
    ).toThrow('SESSION_SECRET');
  });
});
