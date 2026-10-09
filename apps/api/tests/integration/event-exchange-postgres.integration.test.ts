import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 8 Permuta atômica no PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const suffix = randomUUID();
  const baseTime = new Date('2026-10-08T12:00:00.000Z');
  let clockTick = 0;
  const clock = () => new Date(baseTime.getTime() + clockTick++ * 1_000);
  const app = createApp({
    clock,
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const ids = {
    cargo: 'PEB1_FUNDAMENTAL',
    cargoOther: 'PEB1_INFANTIL',
    periodAfternoon: 'TARDE',
    periodMorning: 'MANHA',
    type: 'EMEF',
    unitA: randomUUID(),
    unitB: randomUUID(),
    unitC: randomUUID(),
  };
  const password = 'Senha Etapa 8 2026!';
  const logins = {
    admin: `admin.exchange.${suffix}`,
    director: `director.exchange.${suffix}`,
    operator: `operator.exchange.${suffix}`,
    secretary: `secretary.exchange.${suffix}`,
  };
  let professionalSequence = 0;
  let positionSequence = 0;

  beforeAll(async () => {
    await database.client.unidade.createMany({
      data: [ids.unitA, ids.unitB, ids.unitC].map((id, index) => ({
        id,
        nome: `Unidade Permuta ${index + 1} ${suffix}`,
        tipoUnidadeId: ids.type,
      })),
    });
    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        { login: logins.admin, nome: 'Admin Permuta', perfil: 'ADMINISTRADOR', senhaHash },
        { login: logins.operator, nome: 'Operador Permuta', perfil: 'OPERADOR', senhaHash },
      ],
    });
    for (const account of [
      { login: logins.director, nome: 'Diretor Permuta', perfil: 'DIRETOR' as const },
      { login: logins.secretary, nome: 'Secretário Permuta', perfil: 'SECRETARIO' as const },
    ]) {
      await database.client.usuario.create({
        data: {
          login: account.login,
          nome: account.nome,
          perfil: account.perfil,
          senhaHash,
          unidades: { create: [{ unidadeId: ids.unitA }] },
        },
      });
    }
  }, 30_000);

  afterAll(async () => database.disconnect());

  async function authenticated(login = logins.operator) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
    return agent;
  }

  async function professional(name: string, cargoFuncaoId = ids.cargo) {
    professionalSequence += 1;
    return database.client.profissional.create({
      data: {
        cargoFuncaoId,
        cpf: String(30_000_000_000 + professionalSequence),
        dataEntradaPrefeitura: new Date('2010-01-01T00:00:00.000Z'),
        dataNascimento: new Date('1980-01-01T00:00:00.000Z'),
        matricula: `E8-${suffix}-${professionalSequence}`,
        nomeCompleto: `${name} ${professionalSequence}`,
        numeroFilhos: 0,
        permuta: true,
        pontuacao: '0',
      },
    });
  }

  async function position(input: {
    active?: boolean;
    cargoId?: string;
    periodId?: string;
    unitId?: string;
    year?: number;
  }) {
    positionSequence += 1;
    const cargoFuncaoId = input.cargoId ?? ids.cargo;
    const periodoId = input.periodId ?? ids.periodMorning;
    const unidadeId = input.unitId ?? ids.unitA;
    const anoLetivo = input.year ?? 2027;
    const plan =
      (await database.client.quadroNecessidade.findFirst({
        where: { anoLetivo, cargoFuncaoId, periodoId, segmentoEnsinoId: null, unidadeId },
      })) ??
      (await database.client.quadroNecessidade.create({
        data: {
          anoLetivo,
          cargoFuncaoId,
          periodoId,
          quantidade: 1_000,
          unidadeId,
        },
      }));
    return database.client.postoTrabalho.create({
      data: {
        anoLetivo,
        ativo: input.active ?? true,
        cargoFuncaoId,
        codigo: `E8-${positionSequence}`,
        periodoId,
        quadroNecessidadeId: plan.id,
        unidadeId,
      },
    });
  }

  async function seat(professionalId: string, positionId: string) {
    return database.client.lotacaoSede.create({
      data: {
        dataInicio: new Date('2020-01-01T12:00:00.000Z'),
        postoTrabalhoId: positionId,
        profissionalId: professionalId,
      },
    });
  }

  async function activeAbsence(professionalId: string) {
    return database.client.afastamentoProfissional.create({
      data: {
        dataInicio: new Date('2026-01-01T12:00:00.000Z'),
        profissionalId: professionalId,
        tipo: 'Afastamento Permuta',
      },
    });
  }

  async function activeExercise(professionalId: string, positionId: string, holderId: string) {
    return database.client.exercicioProfissional.create({
      data: {
        dataInicio: new Date('2026-02-01T12:00:00.000Z'),
        postoTrabalhoId: positionId,
        profissionalId: professionalId,
        substituiProfissionalId: holderId,
        tipoExercicio: 'SUBSTITUICAO',
      },
    });
  }

  async function exchangeEvent(input: {
    participants: Array<{ id: string; status?: 'AGUARDANDO' | 'ATENDIDO' }>;
    status?: 'ATIVO' | 'CANCELADO' | 'ENCERRADO' | 'RASCUNHO';
    type?: 'LISTAO' | 'PERMUTA' | 'REMOCAO';
  }) {
    const operator = await database.client.usuario.findUniqueOrThrow({
      where: { login: logins.operator },
    });
    const event = await database.client.evento.create({
      data: {
        ano: 2027,
        cargoFuncaoId: ids.cargo,
        nome: `Permuta ${randomUUID()}`,
        tipo: input.type ?? 'PERMUTA',
      },
    });
    const participantIds: string[] = [];
    for (const [index, item] of input.participants.entries()) {
      const record = await database.client.profissional.findUniqueOrThrow({
        where: { id: item.id },
      });
      const participant = await database.client.eventoParticipante.create({
        data: {
          dataEntradaSnapshot: record.dataEntradaPrefeitura,
          dataNascimentoSnapshot: record.dataNascimento,
          eventoId: event.id,
          numeroFilhosSnapshot: record.numeroFilhos,
          pontuacaoSnapshot: record.pontuacao,
          posicao: index + 1,
          profissionalId: record.id,
          status: item.status ?? 'AGUARDANDO',
        },
      });
      participantIds.push(participant.id);
    }
    const status = input.status ?? 'ATIVO';
    if (status !== 'RASCUNHO') {
      await database.client.evento.update({
        data: {
          dataFim: status === 'ENCERRADO' ? new Date('2026-10-08T11:00:00.000Z') : null,
          dataInicio: new Date('2026-10-08T10:00:00.000Z'),
          iniciadoPorUsuarioId: operator.id,
          status,
        },
        where: { id: event.id },
      });
    }
    return { eventId: event.id, participantIds };
  }

  async function validPair(prefix: string) {
    const first = await professional(`${prefix} A`);
    const second = await professional(`${prefix} B`);
    const firstPosition = await position({ unitId: ids.unitA });
    const secondPosition = await position({ unitId: ids.unitB });
    await seat(first.id, firstPosition.id);
    await seat(second.id, secondPosition.id);
    return { first, firstPosition, second, secondPosition };
  }

  async function simulationAndPayload(
    operator: Awaited<ReturnType<typeof authenticated>>,
    eventId: string,
    secondParticipantId: string,
  ) {
    const response = await operator
      .get(`/eventos/${eventId}/simular-permuta?segundoParticipanteId=${secondParticipantId}`)
      .expect(200);
    return {
      participanteEsperadoId: response.body.participanteAtualEsperadoId,
      postoOrigemAtualEsperadoId: response.body.postoOrigemAtualEsperadoId,
      postoOrigemSegundoEsperadoId: response.body.postoOrigemSegundoEsperadoId,
      segundoParticipanteId: secondParticipantId,
    };
  }

  it('restringe Permuta a OPERADOR e evento PERMUTA ATIVO', async () => {
    const pair = await validPair('Estados');
    const active = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }],
    });
    const operator = await authenticated();
    await operator.get(`/eventos/${active.eventId}/permuta`).expect(200);
    for (const login of [logins.admin, logins.director, logins.secretary]) {
      await (await authenticated(login)).get(`/eventos/${active.eventId}/permuta`).expect(403);
    }
    for (const status of ['RASCUNHO', 'CANCELADO'] as const) {
      const event = await exchangeEvent({
        participants: [{ id: pair.first.id }, { id: pair.second.id }],
        status,
      });
      await operator.get(`/eventos/${event.eventId}/permuta`).expect(409);
    }
    const closed = await exchangeEvent({
      participants: [
        { id: pair.first.id, status: 'ATENDIDO' },
        { id: pair.second.id, status: 'ATENDIDO' },
      ],
      status: 'ENCERRADO',
    });
    const history = await operator.get(`/eventos/${closed.eventId}/permuta`).expect(200);
    expect(history.body).toMatchObject({
      evento: { status: 'ENCERRADO', tipo: 'PERMUTA' },
      participanteAtual: null,
      totais: { aguardando: 0, atendidos: 2 },
    });
    await operator
      .get(
        `/eventos/${closed.eventId}/simular-permuta?segundoParticipanteId=${closed.participantIds[1]}`,
      )
      .expect(409);
    for (const type of ['REMOCAO', 'LISTAO'] as const) {
      const event = await exchangeEvent({
        participants: [{ id: pair.first.id }, { id: pair.second.id }],
        type,
      });
      const response = await operator.get(`/eventos/${event.eventId}/permuta`).expect(409);
      expect(response.body.error).toBe('EVENT_TYPE_NOT_SUPPORTED_FOR_EXCHANGE');
    }
  });

  it('encerra Permuta atendida com auditoria, sem movimento novo, e preserva regressão de tipos', async () => {
    const pair = await validPair('Encerramento');
    const outsideProfessional = await professional('Fora da Permuta');
    await database.client.profissional.updateMany({
      data: { remocao: true },
      where: { id: { in: [pair.first.id, pair.second.id, outsideProfessional.id] } },
    });
    const pendingEvent = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }],
    });
    const operator = await authenticated();
    const pending = await operator.post(`/eventos/${pendingEvent.eventId}/encerrar`).expect(409);
    expect(pending.body.error).toBe('EVENT_HAS_PENDING_PARTICIPANTS');

    const closable = await exchangeEvent({
      participants: [
        { id: pair.first.id, status: 'ATENDIDO' },
        { id: pair.second.id, status: 'ATENDIDO' },
      ],
    });
    for (const login of [logins.admin, logins.director, logins.secretary]) {
      await (await authenticated(login)).post(`/eventos/${closable.eventId}/encerrar`).expect(403);
    }
    const movementsBefore = await database.client.movimentacao.count({
      where: { eventoId: closable.eventId },
    });
    const closed = await operator.post(`/eventos/${closable.eventId}/encerrar`).expect(200);
    expect(closed.body).toMatchObject({ status: 'ENCERRADO', tipo: 'PERMUTA' });
    expect(new Date(closed.body.dataFim).getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
    expect(
      await database.client.movimentacao.count({ where: { eventoId: closable.eventId } }),
    ).toBe(movementsBefore);
    expect(
      await database.client.profissional.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, permuta: true, remocao: true },
        where: { id: { in: [pair.first.id, pair.second.id, outsideProfessional.id] } },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pair.first.id, permuta: false, remocao: true }),
        expect.objectContaining({ id: pair.second.id, permuta: false, remocao: true }),
        expect.objectContaining({ id: outsideProfessional.id, permuta: true, remocao: true }),
      ]),
    );
    expect(
      await database.client.eventoParticipante.count({ where: { eventoId: closable.eventId } }),
    ).toBe(2);
    const audit = await database.client.auditoria.findFirstOrThrow({
      where: { acao: 'UPDATE', entidade: 'EVENTO', registroId: closable.eventId },
    });
    expect(audit.dadosAnteriores).toMatchObject({ status: 'ATIVO' });
    expect(audit.dadosNovos).toMatchObject({ status: 'ENCERRADO' });
    await operator.post(`/eventos/${closable.eventId}/encerrar`).expect(409);
    await operator.get(`/eventos/${closable.eventId}/permuta`).expect(200);
    await operator
      .post(`/eventos/${closable.eventId}/confirmar-permuta`)
      .send({
        participanteEsperadoId: closable.participantIds[0],
        postoOrigemAtualEsperadoId: pair.firstPosition.id,
        postoOrigemSegundoEsperadoId: pair.secondPosition.id,
        segundoParticipanteId: closable.participantIds[1],
      })
      .expect(409);

    const futureEvent = await exchangeEvent({ participants: [], status: 'RASCUNHO' });
    const afterClose = await operator.get(`/eventos/${futureEvent.eventId}/preparacao`).expect(200);
    expect(
      afterClose.body.profissionais.find(
        ({ profissionalId }: { profissionalId: string }) => profissionalId === pair.first.id,
      ),
    ).toMatchObject({ elegivel: false, permuta: false });
    await database.client.profissional.update({
      data: { permuta: true },
      where: { id: pair.first.id },
    });
    const reenabled = await operator.get(`/eventos/${futureEvent.eventId}/preparacao`).expect(200);
    expect(
      reenabled.body.profissionais.find(
        ({ profissionalId }: { profissionalId: string }) => profissionalId === pair.first.id,
      ),
    ).toMatchObject({ elegivel: true, permuta: true });

    for (const type of ['REMOCAO', 'LISTAO'] as const) {
      const regression = await exchangeEvent({
        participants: [{ id: pair.first.id, status: 'ATENDIDO' }],
        type,
      });
      const response = await operator.post(`/eventos/${regression.eventId}/encerrar`).expect(200);
      expect(response.body).toMatchObject({ status: 'ENCERRADO', tipo: type });
    }
  });

  it('mantém fila congelada e rejeita par repetido, externo ou já atendido', async () => {
    const pair = await validPair('Fila');
    const outside = await professional('Externo');
    const event = await exchangeEvent({
      participants: [
        { id: pair.first.id },
        { id: pair.second.id },
        { id: outside.id, status: 'ATENDIDO' },
      ],
    });
    const operator = await authenticated();
    const central = await operator.get(`/eventos/${event.eventId}/permuta`).expect(200);
    expect(central.body.participanteAtual).toMatchObject({
      posicao: 1,
      profissionalId: pair.first.id,
    });
    expect(
      central.body.candidatos.map(
        ({ profissionalId }: { profissionalId: string }) => profissionalId,
      ),
    ).toEqual([pair.second.id]);
    const same = await operator
      .get(
        `/eventos/${event.eventId}/simular-permuta?segundoParticipanteId=${event.participantIds[0]}`,
      )
      .expect(409);
    expect(same.body.error).toBe('EXCHANGE_SAME_PARTICIPANT');
    const attended = await operator
      .get(
        `/eventos/${event.eventId}/simular-permuta?segundoParticipanteId=${event.participantIds[2]}`,
      )
      .expect(409);
    expect(attended.body.error).toBe('EXCHANGE_PARTICIPANT_INVALID');
    const externalParticipant = randomUUID();
    const external = await operator
      .get(`/eventos/${event.eventId}/simular-permuta?segundoParticipanteId=${externalParticipant}`)
      .expect(409);
    expect(external.body.error).toBe('EXCHANGE_PARTICIPANT_INVALID');
  });

  it('bloqueia sede ausente, cargo, período, posto inativo e situações ambíguas', async () => {
    const operator = await authenticated();

    const missingA = await professional('Sem sede');
    const missingB = await professional('Com sede');
    await seat(missingB.id, (await position({ unitId: ids.unitB })).id);
    const missingEvent = await exchangeEvent({
      participants: [{ id: missingA.id }, { id: missingB.id }],
    });
    expect(
      (
        await operator
          .get(
            `/eventos/${missingEvent.eventId}/simular-permuta?segundoParticipanteId=${missingEvent.participantIds[1]}`,
          )
          .expect(409)
      ).body.error,
    ).toBe('EXCHANGE_SEAT_REQUIRED');

    const cargoA = await professional('Cargo A');
    const cargoB = await professional('Cargo B', ids.cargoOther);
    await seat(cargoA.id, (await position({ unitId: ids.unitA })).id);
    await seat(cargoB.id, (await position({ cargoId: ids.cargoOther, unitId: ids.unitB })).id);
    const cargoEvent = await exchangeEvent({
      participants: [{ id: cargoA.id }, { id: cargoB.id }],
    });
    expect(
      (
        await operator
          .get(
            `/eventos/${cargoEvent.eventId}/simular-permuta?segundoParticipanteId=${cargoEvent.participantIds[1]}`,
          )
          .expect(409)
      ).body.error,
    ).toBe('EXCHANGE_PROFESSIONAL_INCOMPATIBLE');

    const periodA = await professional('Período A');
    const periodB = await professional('Período B');
    await seat(periodA.id, (await position({ periodId: ids.periodMorning, unitId: ids.unitA })).id);
    await seat(
      periodB.id,
      (await position({ periodId: ids.periodAfternoon, unitId: ids.unitB })).id,
    );
    const periodEvent = await exchangeEvent({
      participants: [{ id: periodA.id }, { id: periodB.id }],
    });
    expect(
      (
        await operator
          .get(
            `/eventos/${periodEvent.eventId}/simular-permuta?segundoParticipanteId=${periodEvent.participantIds[1]}`,
          )
          .expect(409)
      ).body.error,
    ).toBe('EXCHANGE_PERIOD_INCOMPATIBLE');

    const inactive = await validPair('Inativo');
    await database.client.postoTrabalho.update({
      data: { ativo: false },
      where: { id: inactive.secondPosition.id },
    });
    const inactiveEvent = await exchangeEvent({
      participants: [{ id: inactive.first.id }, { id: inactive.second.id }],
    });
    expect(
      (
        await operator
          .get(
            `/eventos/${inactiveEvent.eventId}/simular-permuta?segundoParticipanteId=${inactiveEvent.participantIds[1]}`,
          )
          .expect(409)
      ).body.error,
    ).toBe('EXCHANGE_SEAT_INCOMPATIBLE');

    const absent = await validPair('Afastado');
    await activeAbsence(absent.first.id);
    const absentEvent = await exchangeEvent({
      participants: [{ id: absent.first.id }, { id: absent.second.id }],
    });
    expect(
      (
        await operator
          .get(
            `/eventos/${absentEvent.eventId}/simular-permuta?segundoParticipanteId=${absentEvent.participantIds[1]}`,
          )
          .expect(409)
      ).body.error,
    ).toBe('EXCHANGE_OPERATIONAL_SITUATION_AMBIGUOUS');

    const occupied = await validPair('Ocupado');
    const substitute = await professional('Substituto');
    await activeExercise(substitute.id, occupied.firstPosition.id, occupied.first.id);
    const occupiedEvent = await exchangeEvent({
      participants: [{ id: occupied.first.id }, { id: occupied.second.id }],
    });
    expect(
      (
        await operator
          .get(
            `/eventos/${occupiedEvent.eventId}/simular-permuta?segundoParticipanteId=${occupiedEvent.participantIds[1]}`,
          )
          .expect(409)
      ).body.error,
    ).toBe('EXCHANGE_SEAT_HAS_TEMPORARY_OCCUPANT');
  });

  it('simula sem escrita e confirma troca bilateral com um movimento e dois itens', async () => {
    const pair = await validPair('Sucesso');
    const next = await professional('Próximo');
    await seat(next.id, (await position({ unitId: ids.unitC })).id);
    const event = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }, { id: next.id }],
    });
    const operator = await authenticated();
    const simulation = await operator
      .get(
        `/eventos/${event.eventId}/simular-permuta?segundoParticipanteId=${event.participantIds[1]}`,
      )
      .expect(200);
    expect(simulation.body).toMatchObject({
      compatibilidade: 'COMPATIVEL',
      impedimentos: [],
      profissionalA: {
        depois: { postoId: pair.secondPosition.id },
        sedeAtual: { postoId: pair.firstPosition.id },
      },
      profissionalB: {
        depois: { postoId: pair.firstPosition.id },
        sedeAtual: { postoId: pair.secondPosition.id },
      },
    });
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      0,
    );

    const result = await operator
      .post(`/eventos/${event.eventId}/confirmar-permuta`)
      .send({
        participanteEsperadoId: simulation.body.participanteAtualEsperadoId,
        postoOrigemAtualEsperadoId: simulation.body.postoOrigemAtualEsperadoId,
        postoOrigemSegundoEsperadoId: simulation.body.postoOrigemSegundoEsperadoId,
        segundoParticipanteId: event.participantIds[1],
      })
      .expect(200);
    expect(result.body.central.participanteAtual).toMatchObject({
      profissionalId: next.id,
      posicao: 3,
    });
    const placements = await database.client.lotacaoSede.findMany({
      orderBy: { dataInicio: 'asc' },
      where: { profissionalId: { in: [pair.first.id, pair.second.id] } },
    });
    expect(placements.filter(({ dataFim }) => dataFim === null)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profissionalId: pair.first.id,
          postoTrabalhoId: pair.secondPosition.id,
        }),
        expect.objectContaining({
          profissionalId: pair.second.id,
          postoTrabalhoId: pair.firstPosition.id,
        }),
      ]),
    );
    expect(placements.filter(({ dataFim }) => dataFim !== null)).toHaveLength(2);
    const movement = await database.client.movimentacao.findFirstOrThrow({
      include: { itens: true },
      where: { eventoId: event.eventId },
    });
    const operatorUser = await database.client.usuario.findUniqueOrThrow({
      where: { login: logins.operator },
    });
    expect(movement).toMatchObject({ tipo: 'PERMUTA', usuarioId: operatorUser.id });
    expect(movement.dataHora.getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
    expect(movement.itens).toHaveLength(2);
    expect(movement.itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          postoDestinoId: pair.secondPosition.id,
          postoOrigemId: pair.firstPosition.id,
          profissionalId: pair.first.id,
          substituiProfissionalId: null,
          tipoDestino: 'SEDE',
        }),
        expect.objectContaining({
          postoDestinoId: pair.firstPosition.id,
          postoOrigemId: pair.secondPosition.id,
          profissionalId: pair.second.id,
          tipoDestino: 'SEDE',
        }),
      ]),
    );
    const statuses = await database.client.eventoParticipante.findMany({
      orderBy: { posicao: 'asc' },
      select: { status: true },
      where: { eventoId: event.eventId },
    });
    expect(statuses.map(({ status }) => status)).toEqual(['ATENDIDO', 'ATENDIDO', 'AGUARDANDO']);
  });

  it('rejeita payload arbitrário e faz rollback quando a sede muda após a simulação', async () => {
    const pair = await validPair('Stale');
    const event = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }],
    });
    const operator = await authenticated();
    const payload = await simulationAndPayload(operator, event.eventId, event.participantIds[1]!);
    await operator
      .post(`/eventos/${event.eventId}/confirmar-permuta`)
      .send({ ...payload, usuarioId: randomUUID() })
      .expect(400);
    await database.client.lotacaoSede.updateMany({
      data: { dataFim: new Date('2026-10-08T11:30:00.000Z') },
      where: { dataFim: null, profissionalId: pair.second.id },
    });
    const replacement = await position({ unitId: ids.unitC });
    await seat(pair.second.id, replacement.id);
    const stale = await operator
      .post(`/eventos/${event.eventId}/confirmar-permuta`)
      .send(payload)
      .expect(409);
    expect(stale.body.error).toBe('EXCHANGE_OWNERSHIP_CHANGED');
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      0,
    );
    expect(
      await database.client.eventoParticipante.count({
        where: { eventoId: event.eventId, status: 'AGUARDANDO' },
      }),
    ).toBe(2);
  });

  it('serializa duplo clique sem aplicar requisição antiga ao próximo participante', async () => {
    const pair = await validPair('Concorrência mesmo evento');
    const third = await professional('Terceiro aguardando');
    await seat(third.id, (await position({ unitId: ids.unitC })).id);
    const event = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }, { id: third.id }],
    });
    const operator = await authenticated();
    const payload = await simulationAndPayload(operator, event.eventId, event.participantIds[1]!);
    const [first, second] = await Promise.all([
      operator.post(`/eventos/${event.eventId}/confirmar-permuta`).send(payload),
      operator.post(`/eventos/${event.eventId}/confirmar-permuta`).send(payload),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect([first.body.error, second.body.error]).toContain('EVENT_PARTICIPANT_ALREADY_HANDLED');
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      1,
    );
    expect(
      await database.client.eventoParticipante.findUnique({
        where: { id: event.participantIds[2]! },
      }),
    ).toMatchObject({ status: 'AGUARDANDO' });
  });

  it('serializa encerramento concorrente com a confirmação da última permuta', async () => {
    const pair = await validPair('Concorrência encerramento');
    const event = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }],
    });
    const operator = await authenticated();
    const payload = await simulationAndPayload(operator, event.eventId, event.participantIds[1]!);
    const [closeResponse, confirmationResponse] = await Promise.all([
      operator.post(`/eventos/${event.eventId}/encerrar`),
      operator.post(`/eventos/${event.eventId}/confirmar-permuta`).send(payload),
    ]);

    expect(confirmationResponse.status).toBe(200);
    expect([200, 409]).toContain(closeResponse.status);
    if (closeResponse.status === 409) {
      expect(closeResponse.body.error).toBe('EVENT_HAS_PENDING_PARTICIPANTS');
      await operator.post(`/eventos/${event.eventId}/encerrar`).expect(200);
    }
    expect(
      await database.client.evento.findUniqueOrThrow({ where: { id: event.eventId } }),
    ).toMatchObject({ status: 'ENCERRADO', dataFim: expect.any(Date) });
    expect(
      await database.client.eventoParticipante.count({
        where: { eventoId: event.eventId, status: 'AGUARDANDO' },
      }),
    ).toBe(0);
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      1,
    );
    expect(
      await database.client.auditoria.count({
        where: { acao: 'UPDATE', entidade: 'EVENTO', registroId: event.eventId },
      }),
    ).toBe(1);
  });

  it('permite um único vencedor quando dois eventos disputam as mesmas sedes', async () => {
    const pair = await validPair('Concorrência eventos');
    const eventA = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }],
    });
    const eventB = await exchangeEvent({
      participants: [{ id: pair.first.id }, { id: pair.second.id }],
    });
    const operator = await authenticated();
    const payloadA = await simulationAndPayload(
      operator,
      eventA.eventId,
      eventA.participantIds[1]!,
    );
    const payloadB = await simulationAndPayload(
      operator,
      eventB.eventId,
      eventB.participantIds[1]!,
    );
    const [responseA, responseB] = await Promise.all([
      operator.post(`/eventos/${eventA.eventId}/confirmar-permuta`).send(payloadA),
      operator.post(`/eventos/${eventB.eventId}/confirmar-permuta`).send(payloadB),
    ]);
    expect([responseA.status, responseB.status].sort()).toEqual([200, 409]);
    expect(
      await database.client.movimentacao.count({
        where: { eventoId: { in: [eventA.eventId, eventB.eventId] } },
      }),
    ).toBe(1);
    expect(
      await database.client.lotacaoSede.count({
        where: { dataFim: null, profissionalId: { in: [pair.first.id, pair.second.id] } },
      }),
    ).toBe(2);
  });
});
