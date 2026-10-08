import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 11 auditoria de CRUD e remoção da correção administrativa', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const typeId = randomUUID();
  const unitId = randomUUID();
  const adminId = randomUUID();
  const secondAdminId = randomUUID();
  const directorId = randomUUID();
  const password = 'Senha administrativa 2026!';
  const logins = {
    admin: `audit-admin-${suffix}`,
    director: `audit-director-${suffix}`,
    secondAdmin: `audit-admin-2-${suffix}`,
  };

  beforeAll(async () => {
    await database.client.tipoUnidade.create({ data: { id: typeId, nome: `Audit ${suffix}` } });
    await database.client.unidade.create({
      data: { id: unitId, nome: `Unidade auditada ${suffix}`, tipoUnidadeId: typeId },
    });
    const senhaHash = await hashPassword(password);
    await database.client.$transaction(async (transaction) => {
      await transaction.usuario.createMany({
        data: [
          { id: adminId, login: logins.admin, nome: 'Admin', perfil: 'ADMINISTRADOR', senhaHash },
          {
            id: secondAdminId,
            login: logins.secondAdmin,
            nome: 'Admin 2',
            perfil: 'ADMINISTRADOR',
            senhaHash,
          },
          {
            id: directorId,
            login: logins.director,
            nome: 'Diretor',
            perfil: 'DIRETOR',
            senhaHash,
          },
        ],
      });
      await transaction.usuarioUnidade.create({
        data: { unidadeId: unitId, usuarioId: directorId },
      });
    });
  });

  afterAll(async () => {
    await database.client.auditoria.deleteMany({
      where: { usuarioId: { in: [adminId, secondAdminId, directorId] } },
    });
    await database.client.sessaoUsuario.deleteMany({
      where: { usuarioId: { in: [adminId, secondAdminId, directorId] } },
    });
    await database.client.usuario.deleteMany({
      where: { id: { in: [adminId, secondAdminId, directorId] } },
    });
    await database.client.unidade.deleteMany({ where: { tipoUnidadeId: typeId } });
    await database.client.tipoUnidade.delete({ where: { id: typeId } });
    await database.disconnect();
  });

  async function authenticated(identifier: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier, password }).expect(200);
    return agent;
  }

  it('não audita CRUD direto do Administrador e mantém edição de Diretor auditada', async () => {
    const admin = await authenticated(logins.admin);
    const director = await authenticated(logins.director);
    const created = await admin
      .post('/unidades')
      .set('Origin', 'http://localhost:9000')
      .send({ nome: `CRUD Admin ${suffix}`, tipoUnidadeId: typeId })
      .expect(201);
    await admin
      .patch(`/unidades/${created.body.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ cidade: 'Americana' })
      .expect(200);
    expect(await database.client.auditoria.count({ where: { registroId: created.body.id } })).toBe(
      0,
    );

    await director
      .patch(`/unidades/${unitId}`)
      .set('Origin', 'http://localhost:9000')
      .send({ cidade: 'Americana' })
      .expect(200);
    const directorAudit = await database.client.auditoria.findFirst({
      where: { registroId: unitId, usuarioId: directorId },
    });
    expect(directorAudit).toMatchObject({ acao: 'UPDATE', entidade: 'UNIDADE' });

    await admin
      .delete(`/unidades/${created.body.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(204);
  });

  it('exige a senha atual e protege dependências e a própria conta', async () => {
    const admin = await authenticated(logins.admin);
    const disposable = await admin
      .post('/unidades')
      .set('Origin', 'http://localhost:9000')
      .send({ nome: `Exclusão ${suffix}`, tipoUnidadeId: typeId })
      .expect(201);
    await admin
      .delete(`/unidades/${disposable.body.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: 'senha incorreta' })
      .expect(403);
    expect(
      await database.client.unidade.findUnique({ where: { id: disposable.body.id } }),
    ).not.toBeNull();
    await admin
      .delete(`/unidades/${unitId}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
    const selfDelete = await admin
      .delete(`/usuarios/${adminId}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
    expect(selfDelete.body.error).toBe('CANNOT_DELETE_CURRENT_USER');
    await admin
      .delete(`/unidades/${disposable.body.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(204);
  });

  it('não expõe mais endpoints de Correção Administrativa', async () => {
    const admin = await authenticated(logins.admin);
    await admin
      .post('/correcao-administrativa/previsualizar')
      .set('Origin', 'http://localhost:9000')
      .send({})
      .expect(404);
    await admin
      .post('/correcao-administrativa/aplicar')
      .set('Origin', 'http://localhost:9000')
      .send({})
      .expect(404);
  });
});
