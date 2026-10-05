import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 4 quadro e postos no PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const ids = {
    cargo: randomUUID(),
    cargoIncompativel: randomUUID(),
    periodo: randomUUID(),
    segmento: randomUUID(),
    tipoUnidade: randomUUID(),
    unidadeA: randomUUID(),
    unidadeB: randomUUID(),
  };
  const password = 'Senha Etapa 4 2026!';
  const credentials = {
    admin: `admin.quadro.${suffix}`,
    director: `diretor.quadro.${suffix}`,
    operator: `operador.quadro.${suffix}`,
    secretary: `secretario.quadro.${suffix}`,
  };
  let professionalSequence = 0;

  beforeAll(async () => {
    await database.client.tipoUnidade.create({
      data: { id: ids.tipoUnidade, nome: `Tipo quadro ${suffix}` },
    });
    await database.client.unidade.createMany({
      data: [
        { id: ids.unidadeA, nome: `Unidade quadro A ${suffix}`, tipoUnidadeId: ids.tipoUnidade },
        { id: ids.unidadeB, nome: `Unidade quadro B ${suffix}`, tipoUnidadeId: ids.tipoUnidade },
      ],
    });
    await database.client.cargoFuncao.createMany({
      data: [
        { id: ids.cargo, nome: `Cargo compatível ${suffix}` },
        { id: ids.cargoIncompativel, nome: `Cargo incompatível ${suffix}` },
      ],
    });
    await database.client.cargoTipoUnidade.create({
      data: { cargoFuncaoId: ids.cargo, tipoUnidadeId: ids.tipoUnidade },
    });
    await database.client.periodo.create({
      data: { id: ids.periodo, nome: `Período quadro ${suffix}` },
    });
    await database.client.segmentoEnsino.create({
      data: { id: ids.segmento, nome: `Segmento quadro ${suffix}` },
    });
    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        { login: credentials.admin, nome: 'Admin Quadro', perfil: 'ADMINISTRADOR', senhaHash },
        { login: credentials.operator, nome: 'Operador Quadro', perfil: 'OPERADOR', senhaHash },
      ],
    });
    for (const account of [
      { login: credentials.director, nome: 'Diretor Quadro', perfil: 'DIRETOR' as const },
      { login: credentials.secretary, nome: 'Secretário Quadro', perfil: 'SECRETARIO' as const },
    ]) {
      await database.client.usuario.create({
        data: {
          login: account.login,
          nome: account.nome,
          perfil: account.perfil,
          senhaHash,
          unidades: { create: [{ unidadeId: ids.unidadeA }] },
        },
      });
    }
  }, 30_000);

  afterAll(async () => {
    await database.client.sessaoUsuario.deleteMany({
      where: { usuario: { login: { contains: suffix } } },
    });
    await database.client.usuario.deleteMany({ where: { login: { contains: suffix } } });
    await database.client.exercicioProfissional.deleteMany({
      where: { postoTrabalho: { unidadeId: { in: [ids.unidadeA, ids.unidadeB] } } },
    });
    await database.client.lotacaoSede.deleteMany({
      where: { postoTrabalho: { unidadeId: { in: [ids.unidadeA, ids.unidadeB] } } },
    });
    await database.client.profissional.deleteMany({
      where: { matricula: { startsWith: `Q-${suffix}` } },
    });
    await database.client.postoTrabalho.deleteMany({
      where: { unidadeId: { in: [ids.unidadeA, ids.unidadeB] } },
    });
    await database.client.quadroNecessidade.deleteMany({
      where: { unidadeId: { in: [ids.unidadeA, ids.unidadeB] } },
    });
    await database.client.segmentoEnsino.deleteMany({ where: { id: ids.segmento } });
    await database.client.periodo.deleteMany({ where: { id: ids.periodo } });
    await database.client.cargoTipoUnidade.deleteMany({
      where: { cargoFuncaoId: { in: [ids.cargo, ids.cargoIncompativel] } },
    });
    await database.client.cargoFuncao.deleteMany({
      where: { id: { in: [ids.cargo, ids.cargoIncompativel] } },
    });
    await database.client.unidade.deleteMany({
      where: { id: { in: [ids.unidadeA, ids.unidadeB] } },
    });
    await database.client.tipoUnidade.deleteMany({ where: { id: ids.tipoUnidade } });
    await database.disconnect();
  }, 30_000);

  async function authenticated(login: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
    return agent;
  }

  function payload(anoLetivo: number, quantidade: number, overrides: Record<string, unknown> = {}) {
    return {
      anoLetivo,
      cargoFuncaoId: ids.cargo,
      observacoes: null,
      periodoId: ids.periodo,
      quantidade,
      segmentoEnsinoId: null,
      unidadeId: ids.unidadeA,
      ...overrides,
    };
  }

  async function createProfessional() {
    professionalSequence += 1;
    return database.client.profissional.create({
      data: {
        cargoFuncaoId: ids.cargo,
        cpf: '12345678901',
        dataEntradaPrefeitura: new Date('2020-01-01T00:00:00.000Z'),
        dataNascimento: new Date('1980-01-01T00:00:00.000Z'),
        matricula: `Q-${suffix}-${professionalSequence}`,
        nomeCompleto: `Profissional Quadro ${professionalSequence}`,
      },
    });
  }

  it('cria necessidade e exatamente a quantidade solicitada de postos', async () => {
    const admin = await authenticated(credentials.admin);
    const response = await admin.post('/quadros').send(payload(2030, 5)).expect(201);

    expect(response.body).toMatchObject({ quantidade: 5, quantidadePostosAtivos: 5 });
    expect(
      await database.client.postoTrabalho.count({
        where: { ativo: true, quadroNecessidadeId: response.body.id },
      }),
    ).toBe(5);
    await admin.get(`/quadros/${response.body.id}`).expect(200);
    const positions = await admin
      .get('/postos')
      .query({ anoLetivo: 2030, unidadeId: ids.unidadeA })
      .expect(200);
    expect(positions.body.items).toHaveLength(5);
    expect(positions.body.items[0]).toMatchObject({
      estadoEstrutural: 'DISPONIVEL_COM_SEDE',
      ocupanteAtual: null,
      titularAtual: null,
    });
  });

  it('aumenta, reduz deterministicamente e preserva postos e histórico', async () => {
    const admin = await authenticated(credentials.admin);
    const created = await admin.post('/quadros').send(payload(2031, 5)).expect(201);
    const quadroId = created.body.id as string;
    await admin.patch(`/quadros/${quadroId}`).send({ quantidade: 8 }).expect(200);
    const positions = await database.client.postoTrabalho.findMany({
      orderBy: { id: 'asc' },
      where: { quadroNecessidadeId: quadroId },
    });
    expect(positions).toHaveLength(8);

    const professional = await createProfessional();
    const historicalPosition = positions[0]!;
    const history = await database.client.lotacaoSede.create({
      data: {
        dataFim: new Date('2021-01-01T00:00:00.000Z'),
        dataInicio: new Date('2020-01-01T00:00:00.000Z'),
        postoTrabalhoId: historicalPosition.id,
        profissionalId: professional.id,
      },
    });

    const reduced = await admin.patch(`/quadros/${quadroId}`).send({ quantidade: 6 }).expect(200);
    expect(reduced.body).toMatchObject({ quantidade: 6, quantidadePostosAtivos: 6 });
    expect(
      await database.client.postoTrabalho.count({ where: { quadroNecessidadeId: quadroId } }),
    ).toBe(8);
    expect(
      await database.client.postoTrabalho.count({
        where: { ativo: false, quadroNecessidadeId: quadroId },
      }),
    ).toBe(2);
    expect(
      (await database.client.postoTrabalho.findUnique({ where: { id: historicalPosition.id } }))
        ?.ativo,
    ).toBe(true);
    expect(
      await database.client.lotacaoSede.findUnique({ where: { id: history.id } }),
    ).not.toBeNull();
  });

  it('rejeita redução e inativação quando os postos livres são insuficientes', async () => {
    const admin = await authenticated(credentials.admin);
    const created = await admin.post('/quadros').send(payload(2032, 3)).expect(201);
    const quadroId = created.body.id as string;
    const positions = await database.client.postoTrabalho.findMany({
      where: { quadroNecessidadeId: quadroId },
    });
    const holder = await createProfessional();
    const occupant = await createProfessional();
    await database.client.lotacaoSede.create({
      data: { postoTrabalhoId: positions[0]!.id, profissionalId: holder.id },
    });
    await database.client.exercicioProfissional.create({
      data: {
        postoTrabalhoId: positions[1]!.id,
        profissionalId: occupant.id,
        tipoExercicio: 'SEDE',
      },
    });

    await admin.patch(`/quadros/${quadroId}`).send({ quantidade: 1 }).expect(409);
    await admin.patch(`/postos/${positions[0]!.id}/status`).send({ ativo: false }).expect(409);
    await admin.patch(`/postos/${positions[1]!.id}/status`).send({ ativo: false }).expect(409);
    expect(
      await database.client.quadroNecessidade.findUnique({ where: { id: quadroId } }),
    ).toMatchObject({ quantidade: 3 });
    expect(
      await database.client.postoTrabalho.count({
        where: { ativo: true, quadroNecessidadeId: quadroId },
      }),
    ).toBe(3);
  });

  it('rejeita incompatibilidade, duplicidade com segmento NULL e mudança estrutural', async () => {
    const admin = await authenticated(credentials.admin);
    await admin
      .post('/quadros')
      .send(payload(2033, 1, { cargoFuncaoId: ids.cargoIncompativel }))
      .expect(409);
    expect(
      await database.client.quadroNecessidade.count({
        where: { anoLetivo: 2033, cargoFuncaoId: ids.cargoIncompativel },
      }),
    ).toBe(0);

    const created = await admin.post('/quadros').send(payload(2034, 1)).expect(201);
    await admin.post('/quadros').send(payload(2034, 2)).expect(409);
    await admin.patch(`/quadros/${created.body.id}`).send({ unidadeId: ids.unidadeB }).expect(409);
    expect(
      await database.client.quadroNecessidade.findUnique({ where: { id: created.body.id } }),
    ).toMatchObject({ unidadeId: ids.unidadeA });

    const relation = await database.client.$queryRaw<{ relation: string | null }[]>`
      SELECT to_regclass('public.vaga')::text AS relation
    `;
    expect(relation[0]?.relation).toBeNull();
  });

  it('inativa e reativa posto livre sem exclusão física e mantendo o quadro coerente', async () => {
    const admin = await authenticated(credentials.admin);
    const created = await admin.post('/quadros').send(payload(2035, 2)).expect(201);
    const quadroId = created.body.id as string;
    const target = await database.client.postoTrabalho.findFirstOrThrow({
      where: { quadroNecessidadeId: quadroId },
    });

    const inactive = await admin
      .patch(`/postos/${target.id}/status`)
      .send({ ativo: false })
      .expect(200);
    expect(inactive.body).toMatchObject({ ativo: false, estadoEstrutural: 'INATIVO' });
    expect(
      await database.client.postoTrabalho.findUnique({ where: { id: target.id } }),
    ).not.toBeNull();
    expect(
      await database.client.quadroNecessidade.findUnique({ where: { id: quadroId } }),
    ).toMatchObject({ quantidade: 1 });

    await admin.patch(`/postos/${target.id}/status`).send({ ativo: true }).expect(200);
    expect(
      await database.client.quadroNecessidade.findUnique({ where: { id: quadroId } }),
    ).toMatchObject({ quantidade: 2 });
  });

  it('mantém RBAC: Admin gerencia, Operador consulta e perfis escolares não administram', async () => {
    const operator = await authenticated(credentials.operator);
    await operator.get('/quadros').expect(200);
    await operator.get('/postos').expect(200);
    await operator.post('/quadros').send(payload(2036, 1)).expect(403);

    for (const login of [credentials.director, credentials.secretary]) {
      const schoolUser = await authenticated(login);
      await schoolUser.get('/quadros').expect(403);
      await schoolUser.get('/postos').expect(403);
      await schoolUser.post('/quadros').send(payload(2036, 1)).expect(403);
    }
  });

  it('serializa ajustes concorrentes sem criar postos excedentes', async () => {
    const firstAdmin = await authenticated(credentials.admin);
    const secondAdmin = await authenticated(credentials.admin);
    const created = await firstAdmin.post('/quadros').send(payload(2037, 5)).expect(201);
    const quadroId = created.body.id as string;

    const responses = await Promise.all([
      firstAdmin.patch(`/quadros/${quadroId}`).send({ quantidade: 8 }),
      secondAdmin.patch(`/quadros/${quadroId}`).send({ quantidade: 8 }),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(
      await database.client.quadroNecessidade.findUnique({ where: { id: quadroId } }),
    ).toMatchObject({ quantidade: 8 });
    expect(
      await database.client.postoTrabalho.count({
        where: { ativo: true, quadroNecessidadeId: quadroId },
      }),
    ).toBe(8);
  });
});
