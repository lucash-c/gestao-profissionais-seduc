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
    });

    expect(environment.API_PORT).toBe(3100);
    expect(environment.corsOrigins).toEqual([
      'http://localhost:9000',
      'https://seduc.example.test',
    ]);
  });

  it('rejeita uma URL de banco que não seja PostgreSQL', () => {
    expect(() =>
      loadEnvironment({
        DATABASE_URL: 'mysql://user:password@localhost:3306/seduc',
      }),
    ).toThrow('DATABASE_URL');
  });
});
