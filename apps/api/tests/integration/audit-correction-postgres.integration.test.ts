import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 9 audit and administrative correction on PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const typeId = randomUUID();
  const adminId = randomUUID();
  const operatorId = randomUUID();
  const login = { admin: `audit-admin-${suffix}`, operator: `audit-operator-${suffix}` };
  const password = 'Senha de auditoria 2026!';

  beforeAll(async () => {
    await database.client.tipoUnidade.create({ data: { id: typeId, nome: `Audit ${suffix}` } });
    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        {
          id: adminId,
          login: login.admin,
          nome: 'Admin Auditoria',
          perfil: 'ADMINISTRADOR',
          senhaHash,
        },
        {
          id: operatorId,
          login: login.operator,
          nome: 'Operador Auditoria',
          perfil: 'OPERADOR',
          senhaHash,
        },
      ],
    });
  });

  afterAll(async () => {
    await database.client.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS audit_test_failure ON "auditoria"',
    );
    await database.client.$executeRawUnsafe('DROP FUNCTION IF EXISTS audit_test_failure()');
    await database.client.auditoria.deleteMany({
      where: { usuarioId: { in: [adminId, operatorId] } },
    });
    await database.client.sessaoUsuario.deleteMany({
      where: { usuarioId: { in: [adminId, operatorId] } },
    });
    await database.client.usuario.deleteMany({ where: { id: { in: [adminId, operatorId] } } });
    await database.client.unidade.deleteMany({ where: { tipoUnidadeId: typeId } });
    await database.client.tipoUnidade.delete({ where: { id: typeId } });
    await database.disconnect();
  });

  async function authenticated(identifier: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier, password }).expect(200);
    return agent;
  }

  async function createUnit(agent: ReturnType<typeof request.agent>, name: string) {
    const response = await agent
      .post('/unidades')
      .set('Origin', 'http://localhost:9000')
      .send({ nome: name, tipoUnidadeId: typeId })
      .expect(201);
    return response.body as { id: string; nome: string };
  }

  it('audits CREATE, UPDATE and DELETE with real user, server time and correct before/after', async () => {
    const admin = await authenticated(login.admin);
    const unit = await createUnit(admin, `Unidade auditada ${suffix}`);
    await admin
      .patch(`/unidades/${unit.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ ativo: false })
      .expect(200);
    const phone = await admin
      .post(`/unidades/${unit.id}/telefones`)
      .set('Origin', 'http://localhost:9000')
      .send({ numero: '1934001234', tipo: 'FIXO' })
      .expect(201);
    const phoneId = phone.body.telefones[0].id as string;
    await admin
      .delete(`/unidades/${unit.id}/telefones/${phoneId}`)
      .set('Origin', 'http://localhost:9000')
      .expect(204);

    const entries = await database.client.auditoria.findMany({
      orderBy: { dataHora: 'asc' },
      where: { usuarioId: adminId, OR: [{ registroId: unit.id }, { registroId: phoneId }] },
    });
    expect(entries.map(({ acao }) => acao)).toEqual(['CREATE', 'UPDATE', 'CREATE', 'DELETE']);
    expect(entries[0]!.dadosAnteriores).toBeNull();
    expect(entries[0]!.dadosNovos).toMatchObject({ id: unit.id, nome: unit.nome });
    expect(entries[1]!.dadosAnteriores).toMatchObject({ ativo: true });
    expect(entries[1]!.dadosNovos).toMatchObject({ ativo: false });
    expect(entries[3]!.dadosNovos).toBeNull();
    expect(entries.every(({ dataHora }) => dataHora instanceof Date)).toBe(true);
  });

  it('does not audit a no-op and never stores password, hash or tokens', async () => {
    const admin = await authenticated(login.admin);
    const unit = await createUnit(admin, `Sem alteração ${suffix}`);
    const beforeCount = await database.client.auditoria.count({ where: { registroId: unit.id } });
    await admin
      .patch(`/unidades/${unit.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ nome: unit.nome })
      .expect(200);
    expect(await database.client.auditoria.count({ where: { registroId: unit.id } })).toBe(
      beforeCount,
    );

    const newLogin = `audit-created-${suffix}`;
    await admin
      .post('/usuarios')
      .set('Origin', 'http://localhost:9000')
      .send({
        login: newLogin,
        nome: 'Usuário auditado',
        perfil: 'OPERADOR',
        senha: 'Senha criada 2026!',
      })
      .expect(201);
    const audit = await database.client.auditoria.findFirstOrThrow({
      where: {
        entidade: 'USUARIO',
        usuarioId: adminId,
        dadosNovos: { path: ['login'], equals: newLogin },
      },
    });
    expect(JSON.stringify(audit)).not.toMatch(/senha|token|cookie|hash/i);
    const created = await database.client.usuario.findUniqueOrThrow({ where: { login: newLogin } });
    await database.client.auditoria.deleteMany({ where: { registroId: created.id } });
    await database.client.usuario.delete({ where: { id: created.id } });
  });

  it('rolls back the normal mutation when audit persistence fails', async () => {
    const admin = await authenticated(login.admin);
    const unit = await createUnit(admin, `Rollback ${suffix}`);
    await database.client.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION audit_test_failure() RETURNS trigger AS $$
      BEGIN
        IF NEW.registro_id = '${unit.id}' AND NEW.acao = 'UPDATE' THEN
          RAISE EXCEPTION 'forced audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await database.client.$executeRawUnsafe(
      'CREATE TRIGGER audit_test_failure BEFORE INSERT ON "auditoria" FOR EACH ROW EXECUTE FUNCTION audit_test_failure()',
    );
    try {
      await admin
        .patch(`/unidades/${unit.id}`)
        .set('Origin', 'http://localhost:9000')
        .send({ nome: `Não persistir ${suffix}` })
        .expect(500);
    } finally {
      await database.client.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS audit_test_failure ON "auditoria"',
      );
      await database.client.$executeRawUnsafe('DROP FUNCTION IF EXISTS audit_test_failure()');
    }
    expect(await database.client.unidade.findUnique({ where: { id: unit.id } })).toMatchObject({
      nome: unit.nome,
    });
    expect(
      await database.client.auditoria.count({ where: { registroId: unit.id, acao: 'UPDATE' } }),
    ).toBe(0);
  });

  it('filters and paginates history in stable descending order and denies non-admins', async () => {
    const admin = await authenticated(login.admin);
    const operator = await authenticated(login.operator);
    const unit = await createUnit(admin, `Filtro ${suffix}`);
    await operator.get('/auditoria').set('Origin', 'http://localhost:9000').expect(403);
    const response = await admin
      .get(`/auditoria?entidade=UNIDADE&unidadeId=${unit.id}&acao=CREATE&page=1&pageSize=1`)
      .set('Origin', 'http://localhost:9000')
      .expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      entidade: 'UNIDADE',
      registroId: unit.id,
      usuarioId: adminId,
    });
    expect(response.body.pageSize).toBe(1);
  });

  it('applies isolated ADMIN correction without audit or event movement and rejects unexpected scope', async () => {
    const admin = await authenticated(login.admin);
    const operator = await authenticated(login.operator);
    const unit = await createUnit(admin, `Correção ${suffix}`);
    const beforeAudit = await database.client.auditoria.count();
    const beforeMovements = await database.client.movimentacao.count();
    const payload = {
      entidade: 'UNIDADE',
      registroId: unit.id,
      valores: { nome: `Corrigida ${suffix}` },
    };
    await operator
      .post('/correcao-administrativa/previsualizar')
      .set('Origin', 'http://localhost:9000')
      .send(payload)
      .expect(403);
    await operator
      .post('/correcao-administrativa/aplicar')
      .set('Origin', 'http://localhost:9000')
      .send({ ...payload, versaoEsperada: 'a'.repeat(64) })
      .expect(403);
    const preview = await admin
      .post('/correcao-administrativa/previsualizar')
      .set('Origin', 'http://localhost:9000')
      .send(payload)
      .expect(200);
    expect(preview.body.antes.nome).toBe(unit.nome);
    expect(preview.body.depois.nome).toBe(`Corrigida ${suffix}`);
    const changedPayload = await admin
      .post('/correcao-administrativa/aplicar')
      .set('Origin', 'http://localhost:9000')
      .send({
        ...payload,
        valores: { nome: `Não revisada ${suffix}` },
        versaoEsperada: preview.body.versao,
      })
      .expect(409);
    expect(changedPayload.body.error).toBe('CORRECTION_PREVIEW_STALE');
    await admin
      .post('/correcao-administrativa/aplicar')
      .set('Origin', 'http://localhost:9000')
      .send({ ...payload, versaoEsperada: preview.body.versao })
      .expect(200);
    expect(await database.client.auditoria.count()).toBe(beforeAudit);
    expect(await database.client.movimentacao.count()).toBe(beforeMovements);
    await admin
      .post('/correcao-administrativa/aplicar')
      .set('Origin', 'http://localhost:9000')
      .send({ ...payload, valores: { posicao: 99 }, versaoEsperada: preview.body.versao })
      .expect(400);
    await admin.delete('/auditoria/qualquer').set('Origin', 'http://localhost:9000').expect(404);
  });

  it('invalidates a preview after a concurrent audited update without correction writes', async () => {
    const admin = await authenticated(login.admin);
    const unit = await createUnit(admin, `Prévia obsoleta ${suffix}`);
    const payload = {
      entidade: 'UNIDADE',
      registroId: unit.id,
      valores: { nome: `Correção obsoleta ${suffix}` },
    };
    const preview = await admin
      .post('/correcao-administrativa/previsualizar')
      .set('Origin', 'http://localhost:9000')
      .send(payload)
      .expect(200);
    const beforeAudit = await database.client.auditoria.count();
    const beforeMovements = await database.client.movimentacao.count();
    const concurrentName = `Atualização concorrente ${suffix}`;
    await admin
      .patch(`/unidades/${unit.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ nome: concurrentName })
      .expect(200);

    const stale = await admin
      .post('/correcao-administrativa/aplicar')
      .set('Origin', 'http://localhost:9000')
      .send({ ...payload, versaoEsperada: preview.body.versao })
      .expect(409);
    expect(stale.body.error).toBe('CORRECTION_PREVIEW_STALE');
    expect(
      await database.client.unidade.findUniqueOrThrow({ where: { id: unit.id } }),
    ).toMatchObject({ nome: concurrentName });
    expect(await database.client.auditoria.count()).toBe(beforeAudit + 1);
    expect(await database.client.movimentacao.count()).toBe(beforeMovements);
  });

  it('serializes concurrent corrections and accepts only the preview that remains current', async () => {
    const admin = await authenticated(login.admin);
    const unit = await createUnit(admin, `Concorrência ${suffix}`);
    const firstPayload = {
      entidade: 'UNIDADE',
      registroId: unit.id,
      valores: { nome: `Primeira ${suffix}` },
    };
    const secondPayload = {
      entidade: 'UNIDADE',
      registroId: unit.id,
      valores: { nome: `Segunda ${suffix}` },
    };
    const [firstPreview, secondPreview] = await Promise.all([
      admin
        .post('/correcao-administrativa/previsualizar')
        .set('Origin', 'http://localhost:9000')
        .send(firstPayload),
      admin
        .post('/correcao-administrativa/previsualizar')
        .set('Origin', 'http://localhost:9000')
        .send(secondPayload),
    ]);
    expect(firstPreview.status).toBe(200);
    expect(secondPreview.status).toBe(200);
    const results = await Promise.all([
      admin
        .post('/correcao-administrativa/aplicar')
        .set('Origin', 'http://localhost:9000')
        .send({ ...firstPayload, versaoEsperada: firstPreview.body.versao }),
      admin
        .post('/correcao-administrativa/aplicar')
        .set('Origin', 'http://localhost:9000')
        .send({ ...secondPayload, versaoEsperada: secondPreview.body.versao }),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(results.map(({ body }) => body.error)).toContain('CORRECTION_PREVIEW_STALE');
    const current = await database.client.unidade.findUniqueOrThrow({ where: { id: unit.id } });
    expect([`Primeira ${suffix}`, `Segunda ${suffix}`]).toContain(current.nome);
  });
});
