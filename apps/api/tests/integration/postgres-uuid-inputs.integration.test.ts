import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;
const TYPE_ID = 'EMEF';
const CARGO_ID = 'PEB1_FUNDAMENTAL';

describeWithPostgres('códigos estruturais em cadastros reais', () => {
  if (!databaseTestUrl) return;
  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const password = 'Senha administrativa 2026!';
  const adminLogin = `uuid-admin-${suffix}`;
  const operatorLogin = `uuid-operator-${suffix}`;

  beforeAll(async () => {
    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        { login: adminLogin, nome: 'Admin UUID', perfil: 'ADMINISTRADOR', senhaHash },
        { login: operatorLogin, nome: 'Operador UUID', perfil: 'OPERADOR', senhaHash },
      ],
    });
  });

  afterAll(async () => {
    await database.client.auditoria.deleteMany({
      where: { usuario: { login: { contains: suffix } } },
    });
    await database.client.evento.deleteMany({ where: { nome: { contains: suffix } } });
    await database.client.unidadeTelefone.deleteMany({
      where: { unidade: { nome: { contains: suffix } } },
    });
    await database.client.unidade.deleteMany({ where: { nome: { contains: suffix } } });
    await database.client.sessaoUsuario.deleteMany({
      where: { usuario: { login: { contains: suffix } } },
    });
    await database.client.usuario.deleteMany({ where: { login: { contains: suffix } } });
    await database.disconnect();
  });

  async function authenticated(identifier: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier, password }).expect(200);
    return agent;
  }

  it('cria unidade e normaliza CEP/telefone usando tipo estrutural', async () => {
    const admin = await authenticated(adminLogin);
    const response = await admin
      .post('/unidades')
      .set('Origin', 'http://localhost:9000')
      .send({
        cep: '13.465-000',
        nome: `Unidade UUID ${suffix}`,
        telefones: [{ numero: '(19) 3400-1000', tipo: 'FIXO' }],
        tipoUnidadeId: TYPE_ID,
      })
      .expect(201);
    expect(response.body).toMatchObject({ cep: '13465000', tipoUnidadeId: TYPE_ID });
    expect(response.body.telefones[0].numero).toBe('1934001000');
  });

  it('cria evento usando cargo estrutural', async () => {
    const operator = await authenticated(operatorLogin);
    const response = await operator
      .post('/eventos')
      .set('Origin', 'http://localhost:9000')
      .send({
        ano: 2026,
        cargoFuncaoId: CARGO_ID,
        nome: `Evento UUID ${suffix}`,
        tipo: 'REMOCAO',
      })
      .expect(201);
    expect(response.body.cargoFuncaoId).toBe(CARGO_ID);
  });
});
