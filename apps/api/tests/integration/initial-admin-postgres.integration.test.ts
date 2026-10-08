import { createDatabaseConnection } from '@seduc/database';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword, verifyPassword } from '../../src/modules/auth/auth.crypto.js';
import {
  bootstrapInitialSeducAdministrator,
  INITIAL_SEDUC_ADMINISTRATOR,
} from '../../src/modules/users/bootstrap-admin.service.js';
import { createPrismaInitialAdminRepository } from '../../src/modules/users/initial-admin.repository.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('administrador inicial SEDUC no PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });

  beforeEach(async () => {
    await database.client.$executeRawUnsafe('TRUNCATE TABLE "usuario" CASCADE');
  });

  afterAll(async () => {
    await database.client.$executeRawUnsafe('TRUNCATE TABLE "usuario" CASCADE');
    await database.disconnect();
  });

  it('não consulta nem cria usuário pelo bootstrap conhecido em produção', async () => {
    const repository = createPrismaInitialAdminRepository(database);

    await expect(
      bootstrapInitialSeducAdministrator(repository, hashPassword, 'production'),
    ).resolves.toBe('disabled');
    expect(await database.client.usuario.count()).toBe(0);
  });

  it('cria uma conta administrativa utilizável, sem unidade e com bcrypt', async () => {
    const repository = createPrismaInitialAdminRepository(database);
    await expect(
      bootstrapInitialSeducAdministrator(repository, hashPassword, 'test'),
    ).resolves.toBe('created');

    const user = await database.client.usuario.findUniqueOrThrow({
      include: { unidades: true },
      where: { login: INITIAL_SEDUC_ADMINISTRATOR.login },
    });
    expect(user).toMatchObject({
      ativo: true,
      login: 'seduc',
      nome: 'SEDUC',
      perfil: 'ADMINISTRADOR',
      unidades: [],
    });
    expect(user.senhaHash).not.toBe(INITIAL_SEDUC_ADMINISTRATOR.password);
    await expect(
      verifyPassword(INITIAL_SEDUC_ADMINISTRATOR.password, user.senhaHash),
    ).resolves.toBe(true);

    const login = await request(app)
      .post('/auth/login')
      .send({
        identifier: INITIAL_SEDUC_ADMINISTRATOR.login,
        password: INITIAL_SEDUC_ADMINISTRATOR.password,
      })
      .expect(200);
    expect(login.body.user).toMatchObject({
      login: 'seduc',
      perfil: 'ADMINISTRADOR',
      unidades: [],
    });

    await expect(
      bootstrapInitialSeducAdministrator(repository, hashPassword, 'test'),
    ).resolves.toBe('unchanged');
    expect(await database.client.usuario.count()).toBe(1);
  });

  it('não cria SEDUC quando já existe qualquer outro usuário', async () => {
    await database.client.usuario.create({
      data: {
        login: 'administrador.existente',
        nome: 'Administrador Existente',
        perfil: 'ADMINISTRADOR',
        senhaHash: await hashPassword('Senha definitiva 2026!'),
      },
    });

    await expect(
      bootstrapInitialSeducAdministrator(
        createPrismaInitialAdminRepository(database),
        hashPassword,
        'test',
      ),
    ).resolves.toBe('unchanged');
    expect(await database.client.usuario.count()).toBe(1);
    expect(
      await database.client.usuario.findUnique({
        where: { login: INITIAL_SEDUC_ADMINISTRATOR.login },
      }),
    ).toBeNull();
  });

  it('não recria SEDUC após existir outro administrador e a conta inicial ser removida', async () => {
    const repository = createPrismaInitialAdminRepository(database);
    await bootstrapInitialSeducAdministrator(repository, hashPassword, 'test');
    await database.client.usuario.create({
      data: {
        login: 'administrador.definitivo',
        nome: 'Administrador Definitivo',
        perfil: 'ADMINISTRADOR',
        senhaHash: await hashPassword('Senha definitiva 2026!'),
      },
    });
    await database.client.usuario.delete({
      where: { login: INITIAL_SEDUC_ADMINISTRATOR.login },
    });

    await expect(
      bootstrapInitialSeducAdministrator(repository, hashPassword, 'test'),
    ).resolves.toBe('unchanged');
    expect(await database.client.usuario.count()).toBe(1);
    expect(
      await database.client.usuario.findUnique({
        where: { login: INITIAL_SEDUC_ADMINISTRATOR.login },
      }),
    ).toBeNull();
  });

  it('serializa duas inicializações concorrentes e cria exatamente um usuário', async () => {
    const results = await Promise.all([
      bootstrapInitialSeducAdministrator(
        createPrismaInitialAdminRepository(database),
        hashPassword,
        'test',
      ),
      bootstrapInitialSeducAdministrator(
        createPrismaInitialAdminRepository(database),
        hashPassword,
        'test',
      ),
    ]);

    expect(results.sort()).toEqual(['created', 'unchanged']);
    expect(await database.client.usuario.count()).toBe(1);
    expect(
      await database.client.usuario.count({
        where: { login: INITIAL_SEDUC_ADMINISTRATOR.login },
      }),
    ).toBe(1);
  });
});
