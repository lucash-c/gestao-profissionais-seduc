import { createDatabaseConnection, Prisma } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 6 eventos no PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const fixedStart = new Date('2026-10-06T15:30:00.000Z');
  const app = createApp({
    clock: () => fixedStart,
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const ids = {
    cargoOther: randomUUID(),
    cargoScore: randomUUID(),
    cargoWithoutScore: randomUUID(),
    period: randomUUID(),
    type: randomUUID(),
    unit: randomUUID(),
  };
  const password = 'Senha Etapa 6 2026!';
  const logins = {
    admin: `admin.event.${suffix}`,
    director: `director.event.${suffix}`,
    operator: `operator.event.${suffix}`,
    secretary: `secretary.event.${suffix}`,
  };
  const professionals = new Map<string, string>();
  let sequence = 0;

  async function createProfessional(
    key: string,
    input: {
      ativo?: boolean;
      cargoFuncaoId?: string;
      dataEntrada?: string;
      dataNascimento?: string;
      filhos?: number;
      nome?: string;
      permuta?: boolean;
      pontuacao?: string;
      remocao?: boolean;
    } = {},
  ) {
    sequence += 1;
    const professional = await database.client.profissional.create({
      data: {
        ativo: input.ativo ?? true,
        cargoFuncaoId: input.cargoFuncaoId ?? ids.cargoScore,
        cpf: String(10_000_000_000 + sequence),
        dataEntradaPrefeitura: new Date(`${input.dataEntrada ?? '2010-01-01'}T00:00:00.000Z`),
        dataNascimento: new Date(`${input.dataNascimento ?? '1980-01-01'}T00:00:00.000Z`),
        matricula: `E6-${suffix}-${sequence}`,
        nomeCompleto: input.nome ?? `Profissional ${key}`,
        numeroFilhos: input.filhos ?? 0,
        permuta: input.permuta ?? false,
        pontuacao: input.pontuacao ?? '0',
        remocao: input.remocao ?? false,
      },
    });
    professionals.set(key, professional.id);
    return professional;
  }

  async function authenticated(login: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
    return agent;
  }

  async function createEvent(
    agent: ReturnType<typeof request.agent>,
    type: 'REMOCAO' | 'PERMUTA' | 'LISTAO' | 'ATRIBUICAO',
    cargoFuncaoId = ids.cargoScore,
    name = `Evento ${type} ${randomUUID()}`,
  ) {
    const response = await agent
      .post('/eventos')
      .send({ ano: 2026, cargoFuncaoId, nome: name, tipo: type })
      .expect(201);
    return response.body.id as string;
  }

  beforeAll(async () => {
    await database.client.tipoUnidade.create({
      data: { id: ids.type, nome: `Tipo eventos ${suffix}` },
    });
    await database.client.unidade.create({
      data: { id: ids.unit, nome: `Unidade eventos ${suffix}`, tipoUnidadeId: ids.type },
    });
    await database.client.periodo.create({
      data: { id: ids.period, nome: `Período eventos ${suffix}` },
    });
    await database.client.cargoFuncao.createMany({
      data: [
        {
          ehProfessor: true,
          id: ids.cargoScore,
          nome: `Professor eventos ${suffix}`,
          usaPontuacao: true,
        },
        { id: ids.cargoWithoutScore, nome: `Agente eventos ${suffix}` },
        { id: ids.cargoOther, nome: `Outro cargo eventos ${suffix}` },
      ],
    });
    await database.client.cargoTipoUnidade.createMany({
      data: [ids.cargoScore, ids.cargoWithoutScore].map((cargoFuncaoId) => ({
        cargoFuncaoId,
        tipoUnidadeId: ids.type,
      })),
    });

    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        { login: logins.admin, nome: 'Admin Eventos', perfil: 'ADMINISTRADOR', senhaHash },
        { login: logins.operator, nome: 'Operador Eventos', perfil: 'OPERADOR', senhaHash },
      ],
    });
    for (const account of [
      { login: logins.director, nome: 'Diretor Eventos', perfil: 'DIRETOR' as const },
      { login: logins.secretary, nome: 'Secretário Eventos', perfil: 'SECRETARIO' as const },
    ]) {
      await database.client.usuario.create({
        data: {
          login: account.login,
          nome: account.nome,
          perfil: account.perfil,
          senhaHash,
          unidades: { create: [{ unidadeId: ids.unit }] },
        },
      });
    }

    const withSeat = await createProfessional('with-seat', {
      filhos: 3,
      nome: 'Ana com sede',
      permuta: true,
      pontuacao: '100',
      remocao: true,
    });
    await createProfessional('without-seat', {
      dataEntrada: '2015-01-01',
      filhos: 1,
      nome: 'Bruna sem sede',
      pontuacao: '90',
      remocao: true,
    });
    await createProfessional('ineligible', { nome: 'Carla inelegível' });
    await createProfessional('permuta-only', { nome: 'Dora permuta', permuta: true });
    await createProfessional('inactive', { ativo: false, nome: 'Erika inativa', remocao: true });
    await createProfessional('other-cargo', {
      cargoFuncaoId: ids.cargoOther,
      nome: 'Fátima outro cargo',
      remocao: true,
    });
    await createProfessional('no-score-a', {
      cargoFuncaoId: ids.cargoWithoutScore,
      dataEntrada: '2000-01-01',
      nome: 'Agente A',
      pontuacao: '1',
    });
    await createProfessional('no-score-b', {
      cargoFuncaoId: ids.cargoWithoutScore,
      dataEntrada: '2010-01-01',
      nome: 'Agente B',
      pontuacao: '999',
    });
    await createProfessional('tie-a', {
      dataEntrada: '2020-02-02',
      dataNascimento: '1990-03-03',
      filhos: 2,
      nome: 'Zilda empate',
      pontuacao: '77',
      remocao: true,
    });
    await createProfessional('tie-b', {
      dataEntrada: '2020-02-02',
      dataNascimento: '1990-03-03',
      filhos: 2,
      nome: 'Amanda empate',
      pontuacao: '77',
      remocao: true,
    });

    const plan = await database.client.quadroNecessidade.create({
      data: {
        anoLetivo: 2026,
        cargoFuncaoId: ids.cargoScore,
        periodoId: ids.period,
        quantidade: 1,
        segmentoEnsinoId: null,
        unidadeId: ids.unit,
      },
    });
    const position = await database.client.postoTrabalho.create({
      data: {
        anoLetivo: 2026,
        cargoFuncaoId: ids.cargoScore,
        codigo: `TEST-${randomUUID()}`,
        periodoId: ids.period,
        quadroNecessidadeId: plan.id,
        unidadeId: ids.unit,
      },
    });
    await database.client.lotacaoSede.create({
      data: { postoTrabalhoId: position.id, profissionalId: withSeat.id },
    });
  }, 30_000);

  afterAll(async () => {
    await database.disconnect();
  });

  it('cria RASCUNHO com controles do servidor e restringe todos os endpoints ao OPERADOR', async () => {
    const operator = await authenticated(logins.operator);
    const response = await operator
      .post('/eventos')
      .send({
        ano: 2026,
        cargoFuncaoId: ids.cargoScore,
        dataInicio: new Date().toISOString(),
        iniciadoPorUsuarioId: randomUUID(),
        nome: 'Campos controlados',
        status: 'ATIVO',
        tipo: 'LISTAO',
      })
      .expect(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');

    const eventId = await createEvent(operator, 'LISTAO');
    expect(await database.client.evento.findUnique({ where: { id: eventId } })).toMatchObject({
      cargoFuncaoId: ids.cargoScore,
      dataInicio: null,
      iniciadoPorUsuarioId: null,
      status: 'RASCUNHO',
    });

    const admin = await authenticated(logins.admin);
    await admin.get('/eventos').expect(200);
    await admin.post('/eventos').send({}).expect(403);
    await admin.get(`/eventos/${eventId}/preparacao`).expect(403);
    await admin.post(`/eventos/${eventId}/iniciar`).expect(403);

    for (const login of [logins.director, logins.secretary]) {
      const unauthorized = await authenticated(login);
      await unauthorized.get('/eventos').expect(403);
      await unauthorized.post('/eventos').send({}).expect(403);
      await unauthorized.get(`/eventos/${eventId}/preparacao`).expect(403);
      await unauthorized.post(`/eventos/${eventId}/iniciar`).expect(403);
    }
  });

  it('retorna a lista completa ativa do cargo com elegibilidade e sede corretas', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'REMOCAO');
    const response = await operator.get(`/eventos/${eventId}/preparacao`).expect(200);
    const rows = response.body.profissionais as Array<Record<string, unknown>>;

    expect(rows.map(({ profissionalId }) => profissionalId)).toEqual(
      expect.arrayContaining([
        professionals.get('with-seat'),
        professionals.get('without-seat'),
        professionals.get('ineligible'),
        professionals.get('permuta-only'),
        professionals.get('tie-a'),
        professionals.get('tie-b'),
      ]),
    );
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profissionalId: professionals.get('inactive') }),
        expect.objectContaining({ profissionalId: professionals.get('other-cargo') }),
      ]),
    );
    expect(
      rows.find(({ profissionalId }) => profissionalId === professionals.get('with-seat')),
    ).toMatchObject({
      elegivel: true,
      possuiSedeAtual: true,
    });
    expect(
      rows.find(({ profissionalId }) => profissionalId === professionals.get('without-seat')),
    ).toMatchObject({
      elegivel: true,
      possuiSedeAtual: false,
    });
    expect(
      rows.find(({ profissionalId }) => profissionalId === professionals.get('ineligible')),
    ).toMatchObject({
      elegivel: false,
      selecionado: false,
    });
    expect(response.body).not.toHaveProperty('cpf');
  });

  it('aplica REMOCAO, PERMUTA e LISTAO sem esconder inelegíveis', async () => {
    const operator = await authenticated(logins.operator);
    const removalId = await createEvent(operator, 'REMOCAO');
    await operator
      .put(`/eventos/${removalId}/preparacao`)
      .send({ profissionalIds: [professionals.get('ineligible')] })
      .expect(409);

    const exchangeId = await createEvent(operator, 'PERMUTA');
    const exchange = await operator.get(`/eventos/${exchangeId}/preparacao`).expect(200);
    expect(
      exchange.body.profissionais.find(
        ({ profissionalId }: { profissionalId: string }) =>
          profissionalId === professionals.get('permuta-only'),
      ),
    ).toMatchObject({ elegivel: true });
    expect(
      exchange.body.profissionais.find(
        ({ profissionalId }: { profissionalId: string }) =>
          profissionalId === professionals.get('without-seat'),
      ),
    ).toMatchObject({ elegivel: false });

    const listId = await createEvent(operator, 'LISTAO');
    const list = await operator.get(`/eventos/${listId}/preparacao`).expect(200);
    expect(list.body.profissionais.every(({ elegivel }: { elegivel: boolean }) => elegivel)).toBe(
      true,
    );
  });

  it('restringe Atribuição formal a profissionais sem sede oficial ativa', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'ATRIBUICAO');
    const preparation = await operator.get(`/eventos/${eventId}/preparacao`).expect(200);
    const withSeat = preparation.body.profissionais.find(
      ({ profissionalId }: { profissionalId: string }) =>
        profissionalId === professionals.get('with-seat'),
    );
    const withoutSeat = preparation.body.profissionais.find(
      ({ profissionalId }: { profissionalId: string }) =>
        profissionalId === professionals.get('without-seat'),
    );

    expect(withSeat).toMatchObject({
      elegivel: false,
      motivoInelegibilidade: 'Profissional já possui sede oficial ativa.',
      possuiSedeAtual: true,
    });
    expect(withoutSeat).toMatchObject({ elegivel: true, possuiSedeAtual: false });

    const rejected = await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: [professionals.get('with-seat')] })
      .expect(409);
    expect(rejected.body.error).toBe('INELIGIBLE_EVENT_PARTICIPANT');

    await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: [professionals.get('without-seat')] })
      .expect(200);
    await operator.post(`/eventos/${eventId}/iniciar`).expect(200);
    expect(await database.client.evento.findUnique({ where: { id: eventId } })).toMatchObject({
      status: 'ATIVO',
      tipo: 'ATRIBUICAO',
    });
  });

  it('salva subconjunto e rejeita repetido, inativo, outro cargo e ID inexistente', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'LISTAO');
    const selected = [professionals.get('with-seat')!, professionals.get('without-seat')!];
    const saved = await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: selected })
      .expect(200);
    expect(saved.body.selecionados).toEqual(expect.arrayContaining(selected));
    await operator.patch(`/eventos/${eventId}`).send({ tipo: 'PERMUTA' }).expect(409);
    await operator
      .patch(`/eventos/${eventId}`)
      .send({ cargoFuncaoId: ids.cargoWithoutScore })
      .expect(409);
    await operator
      .patch(`/eventos/${eventId}`)
      .send({ ano: 2027, nome: 'Listão revisado' })
      .expect(200);
    for (const invalid of [
      [selected[0], selected[0]],
      [professionals.get('inactive')],
      [professionals.get('other-cargo')],
      [randomUUID()],
    ]) {
      await operator
        .put(`/eventos/${eventId}/preparacao`)
        .send({ profissionalIds: invalid })
        .expect(409);
    }
  });

  it('bloqueia empate absoluto sem efeito parcial ou desempate por nome, matrícula ou UUID', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'REMOCAO');
    await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: [professionals.get('tie-a'), professionals.get('tie-b')] })
      .expect(200);
    const preview = await operator.get(`/eventos/${eventId}/preparacao`).expect(200);
    expect(preview.body.gruposEmpate).toHaveLength(1);
    expect(
      preview.body.preview.every(({ posicao }: { posicao: number | null }) => posicao === null),
    ).toBe(true);

    const start = await operator.post(`/eventos/${eventId}/iniciar`).expect(409);
    expect(start.body.error).toBe('EVENT_HAS_PENDING_TIES');
    expect(await database.client.evento.findUnique({ where: { id: eventId } })).toMatchObject({
      dataInicio: null,
      status: 'RASCUNHO',
    });
    expect(
      await database.client.eventoParticipante.findMany({ where: { eventoId: eventId } }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          numeroFilhosSnapshot: null,
          posicao: null,
          status: 'SELECIONADO',
        }),
      ]),
    );
  });

  it('inicia com snapshots, posições 1..N, usuário da sessão e horário do servidor', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'REMOCAO');
    const selected = [professionals.get('with-seat')!, professionals.get('without-seat')!];
    await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: selected })
      .expect(200);
    const started = await operator
      .post(`/eventos/${eventId}/iniciar`)
      .send({ iniciadoPorUsuarioId: randomUUID(), dataInicio: new Date(0).toISOString() })
      .expect(200);

    const operatorUser = await database.client.usuario.findUniqueOrThrow({
      where: { login: logins.operator },
    });
    expect(started.body.evento).toMatchObject({
      dataInicio: fixedStart.toISOString(),
      iniciadoPorUsuarioId: operatorUser.id,
      status: 'ATIVO',
    });
    const participants = await database.client.eventoParticipante.findMany({
      orderBy: { posicao: 'asc' },
      where: { eventoId: eventId },
    });
    expect(participants.map(({ posicao }) => posicao)).toEqual([1, 2]);
    expect(participants.every(({ status }) => status === 'AGUARDANDO')).toBe(true);
    expect(participants[0]).toMatchObject({
      dataEntradaSnapshot: new Date('2010-01-01T00:00:00.000Z'),
      dataNascimentoSnapshot: new Date('1980-01-01T00:00:00.000Z'),
      numeroFilhosSnapshot: 3,
      pontuacaoSnapshot: new Prisma.Decimal('100'),
    });

    const firstBefore = { ...started.body.preview[0] };
    await database.client.profissional.update({
      data: {
        dataEntradaPrefeitura: new Date('2025-01-01T00:00:00.000Z'),
        dataNascimento: new Date('2000-01-01T00:00:00.000Z'),
        nomeCompleto: 'Nome alterado depois do início',
        numeroFilhos: 99,
        pontuacao: '0',
      },
      where: { id: professionals.get('with-seat')! },
    });
    const frozen = await operator.get(`/eventos/${eventId}/preparacao`).expect(200);
    expect(frozen.body.preview[0]).toMatchObject({
      dataEntrada: firstBefore.dataEntrada,
      dataNascimento: firstBefore.dataNascimento,
      numeroFilhos: firstBefore.numeroFilhos,
      pontuacao: firstBefore.pontuacao,
      posicao: firstBefore.posicao,
    });
  });

  it('ignora pontuação no ranking sem pontuação e persiste pontuacaoSnapshot NULL', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'LISTAO', ids.cargoWithoutScore);
    await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({
        profissionalIds: [professionals.get('no-score-a'), professionals.get('no-score-b')],
      })
      .expect(200);
    await operator.post(`/eventos/${eventId}/iniciar`).expect(200);
    const participants = await database.client.eventoParticipante.findMany({
      orderBy: { posicao: 'asc' },
      where: { eventoId: eventId },
    });
    expect(participants.map(({ profissionalId }) => profissionalId)).toEqual([
      professionals.get('no-score-a'),
      professionals.get('no-score-b'),
    ]);
    expect(participants.every(({ pontuacaoSnapshot }) => pontuacaoSnapshot === null)).toBe(true);
  });

  it('congela estrutura e participantes no banco, permitindo somente evolução de status', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'REMOCAO');
    await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: [professionals.get('without-seat')] })
      .expect(200);
    await operator.post(`/eventos/${eventId}/iniciar`).expect(200);
    await operator.patch(`/eventos/${eventId}`).send({ ano: 2030 }).expect(409);
    await operator.put(`/eventos/${eventId}/preparacao`).send({ profissionalIds: [] }).expect(409);

    const participant = await database.client.eventoParticipante.findFirstOrThrow({
      where: { eventoId: eventId },
    });
    await expect(
      database.client.eventoParticipante.update({
        data: { posicao: 99 },
        where: { id: participant.id },
      }),
    ).rejects.toThrow();
    await expect(
      database.client.eventoParticipante.delete({ where: { id: participant.id } }),
    ).rejects.toThrow();
    await expect(
      database.client.eventoParticipante.create({
        data: { eventoId: eventId, profissionalId: professionals.get('with-seat')! },
      }),
    ).rejects.toThrow();
    expect(
      await database.client.eventoParticipante.update({
        data: { status: 'ATENDIDO' },
        where: { id: participant.id },
      }),
    ).toMatchObject({ status: 'ATENDIDO' });
  });

  it('serializa duas inicializações do mesmo evento sem efeitos parciais', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'REMOCAO');
    await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: [professionals.get('without-seat')] })
      .expect(200);
    const [first, second] = await Promise.all([
      operator.post(`/eventos/${eventId}/iniciar`),
      operator.post(`/eventos/${eventId}/iniciar`),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await database.client.eventoParticipante.count({ where: { eventoId: eventId } })).toBe(
      1,
    );
    expect(
      await database.client.eventoParticipante.findFirst({ where: { eventoId: eventId } }),
    ).toMatchObject({
      posicao: 1,
      status: 'AGUARDANDO',
    });
  });

  it('serializa preparação concorrente com início e duas preparações sem misturar seleções', async () => {
    const operator = await authenticated(logins.operator);
    const eventId = await createEvent(operator, 'REMOCAO');
    const firstSelection = [professionals.get('with-seat')!];
    const secondSelection = [professionals.get('without-seat')!];
    await operator
      .put(`/eventos/${eventId}/preparacao`)
      .send({ profissionalIds: firstSelection })
      .expect(200);
    const [save, start] = await Promise.all([
      operator.put(`/eventos/${eventId}/preparacao`).send({ profissionalIds: secondSelection }),
      operator.post(`/eventos/${eventId}/iniciar`),
    ]);
    expect([200, 409]).toContain(save.status);
    expect([200, 409]).toContain(start.status);
    const persisted = await database.client.eventoParticipante.findMany({
      where: { eventoId: eventId },
    });
    const persistedIds = persisted.map(({ profissionalId }) => profissionalId);
    expect([firstSelection, secondSelection]).toContainEqual(persistedIds);

    const draftId = await createEvent(operator, 'LISTAO');
    const [saveA, saveB] = await Promise.all([
      operator.put(`/eventos/${draftId}/preparacao`).send({ profissionalIds: firstSelection }),
      operator.put(`/eventos/${draftId}/preparacao`).send({ profissionalIds: secondSelection }),
    ]);
    expect([saveA.status, saveB.status]).toEqual([200, 200]);
    const finalIds = (
      await database.client.eventoParticipante.findMany({ where: { eventoId: draftId } })
    ).map(({ profissionalId }) => profissionalId);
    expect([firstSelection, secondSelection]).toContainEqual(finalIds);
  });
});
