import { createDatabaseConnection } from '@seduc/database';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('PostgreSQL authentication integration', () => {
  if (!databaseTestUrl) {
    return;
  }

  const login = 'integration.auth';
  const password = 'Senha de integração 2026!';
  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });

  beforeAll(async () => {
    await database.client.sessaoUsuario.deleteMany({
      where: { usuario: { login } },
    });
    await database.client.usuario.deleteMany({ where: { login } });
    await database.client.usuario.create({
      data: {
        login,
        nome: 'Administrador de Integração',
        perfil: 'ADMINISTRADOR',
        senhaHash: await hashPassword(password),
      },
    });
  });

  afterAll(async () => {
    await database.client.sessaoUsuario.deleteMany({
      where: { usuario: { login } },
    });
    await database.client.usuario.deleteMany({ where: { login } });
    await database.disconnect();
  });

  it('persiste, consulta e invalida uma sessão usando a migration da Etapa 2', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);

    const persistedSessions = await database.client.sessaoUsuario.count({
      where: { usuario: { login } },
    });
    expect(persistedSessions).toBe(1);

    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').expect(204);

    const remainingSessions = await database.client.sessaoUsuario.count({
      where: { usuario: { login } },
    });
    expect(remainingSessions).toBe(0);
  });
});
