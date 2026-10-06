import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 7 Central de Remoção e Listão no PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const suffix = randomUUID();
  const baseTime = new Date('2026-10-07T12:00:00.000Z');
  let clockTick = 0;
  const clock = () => new Date(baseTime.getTime() + clockTick++ * 1_000);
  const app = createApp({
    clock,
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const ids = {
    cargo: randomUUID(),
    cargoOther: randomUUID(),
    periodAfternoon: randomUUID(),
    periodMorning: randomUUID(),
    type: randomUUID(),
    unitA: randomUUID(),
    unitB: randomUUID(),
    unitC: randomUUID(),
  };
  const password = 'Senha Etapa 7 2026!';
  const logins = {
    admin: `admin.central.${suffix}`,
    director: `director.central.${suffix}`,
    operator: `operator.central.${suffix}`,
    secretary: `secretary.central.${suffix}`,
  };
  let professionalSequence = 0;
  let positionSequence = 0;

  beforeAll(async () => {
    await database.client.tipoUnidade.create({
      data: { id: ids.type, nome: `Tipo Central ${suffix}` },
    });
    await database.client.unidade.createMany({
      data: [
        { id: ids.unitA, nome: `Unidade A Central ${suffix}`, tipoUnidadeId: ids.type },
        { id: ids.unitB, nome: `Unidade B Central ${suffix}`, tipoUnidadeId: ids.type },
        { id: ids.unitC, nome: `Unidade C Central ${suffix}`, tipoUnidadeId: ids.type },
      ],
    });
    await database.client.periodo.createMany({
      data: [
        { id: ids.periodMorning, nome: `Manhã Central ${suffix}` },
        { id: ids.periodAfternoon, nome: `Tarde Central ${suffix}` },
      ],
    });
    await database.client.cargoFuncao.createMany({
      data: [
        {
          id: ids.cargo,
          nome: `Cargo Central ${suffix}`,
          permiteMultiplosExercicios: true,
        },
        { id: ids.cargoOther, nome: `Outro Cargo Central ${suffix}` },
      ],
    });
    await database.client.cargoTipoUnidade.createMany({
      data: [ids.cargo, ids.cargoOther].map((cargoFuncaoId) => ({
        cargoFuncaoId,
        tipoUnidadeId: ids.type,
      })),
    });
    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        { login: logins.admin, nome: 'Admin Central', perfil: 'ADMINISTRADOR', senhaHash },
        { login: logins.operator, nome: 'Operador Central', perfil: 'OPERADOR', senhaHash },
      ],
    });
    for (const account of [
      { login: logins.director, nome: 'Diretor Central', perfil: 'DIRETOR' as const },
      { login: logins.secretary, nome: 'Secretário Central', perfil: 'SECRETARIO' as const },
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

  afterAll(async () => {
    await database.disconnect();
  });

  async function authenticated(login = logins.operator) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
    return agent;
  }

  async function createProfessional(name: string, cargoFuncaoId = ids.cargo) {
    professionalSequence += 1;
    return database.client.profissional.create({
      data: {
        cargoFuncaoId,
        cpf: String(20_000_000_000 + professionalSequence),
        dataEntradaPrefeitura: new Date('2010-01-01T00:00:00.000Z'),
        dataNascimento: new Date('1980-01-01T00:00:00.000Z'),
        matricula: `E7-${suffix}-${professionalSequence}`,
        nomeCompleto: `${name} ${professionalSequence}`,
        numeroFilhos: professionalSequence % 4,
        pontuacao: String(100 - professionalSequence),
        remocao: true,
      },
    });
  }

  async function createPosition(
    input: {
      active?: boolean;
      cargoId?: string;
      periodId?: string;
      unitId?: string;
      year?: number;
    } = {},
  ) {
    positionSequence += 1;
    const cargoFuncaoId = input.cargoId ?? ids.cargo;
    const periodoId = input.periodId ?? ids.periodMorning;
    const unidadeId = input.unitId ?? ids.unitA;
    const anoLetivo = input.year ?? 2027;
    const plan =
      (await database.client.quadroNecessidade.findFirst({
        where: {
          anoLetivo,
          cargoFuncaoId,
          periodoId,
          segmentoEnsinoId: null,
          unidadeId,
        },
      })) ??
      (await database.client.quadroNecessidade.create({
        data: {
          anoLetivo,
          cargoFuncaoId,
          periodoId,
          quantidade: 1_000,
          segmentoEnsinoId: null,
          unidadeId,
        },
      }));
    return database.client.postoTrabalho.create({
      data: {
        anoLetivo,
        ativo: input.active ?? true,
        cargoFuncaoId,
        codigo: `E7-${positionSequence}`,
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

  async function absence(professionalId: string) {
    return database.client.afastamentoProfissional.create({
      data: {
        dataInicio: new Date('2026-01-01T12:00:00.000Z'),
        profissionalId: professionalId,
        tipo: 'Afastamento Etapa 7',
      },
    });
  }

  async function exercise(input: {
    holderId: string;
    positionId: string;
    professionalId: string;
    type?: 'SUBSTITUICAO' | 'SEM_SEDE';
  }) {
    return database.client.exercicioProfissional.create({
      data: {
        dataInicio: new Date('2026-02-01T12:00:00.000Z'),
        postoTrabalhoId: input.positionId,
        profissionalId: input.professionalId,
        substituiProfissionalId: input.holderId,
        tipoExercicio: input.type ?? 'SUBSTITUICAO',
      },
    });
  }

  async function availableWithoutSeat(unitId = ids.unitB, periodId = ids.periodMorning) {
    const position = await createPosition({ periodId, unitId });
    const holder = await createProfessional('Titular afastado');
    await seat(holder.id, position.id);
    await absence(holder.id);
    return { holder, position };
  }

  async function createEvent(input: {
    participants: Array<{ professionalId: string; status?: 'AGUARDANDO' | 'ATENDIDO' }>;
    status?: 'RASCUNHO' | 'ATIVO' | 'ENCERRADO' | 'CANCELADO';
    type?: 'REMOCAO' | 'LISTAO' | 'PERMUTA';
  }) {
    const operator = await database.client.usuario.findUniqueOrThrow({
      where: { login: logins.operator },
    });
    const event = await database.client.evento.create({
      data: {
        ano: 2027,
        cargoFuncaoId: ids.cargo,
        nome: `Evento Central ${randomUUID()}`,
        tipo: input.type ?? 'REMOCAO',
      },
    });
    const participantIds: string[] = [];
    for (const [index, item] of input.participants.entries()) {
      const professional = await database.client.profissional.findUniqueOrThrow({
        where: { id: item.professionalId },
      });
      const participant = await database.client.eventoParticipante.create({
        data: {
          dataEntradaSnapshot: professional.dataEntradaPrefeitura,
          dataNascimentoSnapshot: professional.dataNascimento,
          eventoId: event.id,
          numeroFilhosSnapshot: professional.numeroFilhos,
          pontuacaoSnapshot: professional.pontuacao,
          posicao: index + 1,
          profissionalId: professional.id,
          status: item.status ?? 'AGUARDANDO',
        },
      });
      participantIds.push(participant.id);
    }
    const status = input.status ?? 'ATIVO';
    if (status !== 'RASCUNHO') {
      await database.client.evento.update({
        data: {
          dataFim: status === 'ENCERRADO' ? new Date('2026-10-07T11:00:00.000Z') : null,
          dataInicio: new Date('2026-10-07T10:00:00.000Z'),
          iniciadoPorUsuarioId: operator.id,
          status,
        },
        where: { id: event.id },
      });
    }
    return { eventId: event.id, participantIds };
  }

  function expectNoSensitiveKeys(value: unknown): void {
    const forbidden = new Set([
      'cpf',
      'matricula',
      'datanascimento',
      'data_nascimento',
      'endereco',
      'telefone',
      'email',
      'usuarioid',
      'senha',
      'observacoes',
      'postoid',
      'profissionalid',
    ]);
    if (Array.isArray(value)) {
      value.forEach(expectNoSensitiveKeys);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        expect(forbidden.has(key.toLowerCase())).toBe(false);
        expectNoSensitiveKeys(child);
      }
    }
  }

  it('restringe a Central ao OPERADOR e somente a eventos ATIVOS de REMOCAO/LISTAO', async () => {
    const professional = await createProfessional('Participante estados');
    const source = await createPosition();
    await seat(professional.id, source.id);
    const active = await createEvent({ participants: [{ professionalId: professional.id }] });
    const operator = await authenticated();
    await operator.get(`/eventos/${active.eventId}/central`).expect(200);
    for (const login of [logins.admin, logins.director, logins.secretary]) {
      const unauthorized = await authenticated(login);
      await unauthorized.get(`/eventos/${active.eventId}/central`).expect(403);
      await unauthorized
        .post(`/eventos/${active.eventId}/escolha`)
        .send({
          participanteEsperadoId: active.participantIds[0],
          postoTrabalhoId: randomUUID(),
        })
        .expect(403);
    }

    const states = [
      { code: 'EVENT_NOT_ACTIVE', status: 'RASCUNHO' as const },
      { code: 'EVENT_CLOSED', status: 'ENCERRADO' as const },
      { code: 'EVENT_CANCELLED', status: 'CANCELADO' as const },
    ];
    for (const state of states) {
      const current = await createProfessional(`Participante ${state.status}`);
      const event = await createEvent({
        participants: [{ professionalId: current.id }],
        status: state.status,
      });
      const response = await operator.get(`/eventos/${event.eventId}/central`).expect(409);
      expect(response.body.error).toBe(state.code);
    }
    const exchange = await createEvent({
      participants: [{ professionalId: professional.id }],
      type: 'PERMUTA',
    });
    const unsupported = await operator.get(`/eventos/${exchange.eventId}/central`).expect(409);
    expect(unsupported.body.error).toBe('EVENT_TYPE_NOT_SUPPORTED_IN_STAGE_7');
  });

  it('usa a menor posição AGUARDANDO, mantém ATENDIDO fora da vez e ordena os próximos', async () => {
    const people = await Promise.all([
      createProfessional('Primeiro atendido'),
      createProfessional('Segundo atual'),
      createProfessional('Terceiro próximo'),
      createProfessional('Quarto próximo'),
    ]);
    const source = await createPosition();
    await seat(people[1]!.id, source.id);
    const event = await createEvent({
      participants: people.map((professional, index) => ({
        professionalId: professional.id,
        status: index === 0 ? ('ATENDIDO' as const) : ('AGUARDANDO' as const),
      })),
    });
    const operator = await authenticated();
    const response = await operator.get(`/eventos/${event.eventId}/central`).expect(200);
    expect(response.body.participanteAtual).toMatchObject({ posicao: 2 });
    expect(response.body.proximos.map(({ posicao }: { posicao: number }) => posicao)).toEqual([
      3, 4,
    ]);
    expect(response.body.fila[0]).toMatchObject({ posicao: 1, status: 'ATENDIDO' });
  });

  it('lista apenas vagas compatíveis e aplica filtros por unidade, período e tipo', async () => {
    const professional = await createProfessional('Participante vagas');
    const source = await createPosition({ unitId: ids.unitA });
    await seat(professional.id, source.id);
    const freeSeat = await createPosition({ unitId: ids.unitB });
    const temporary = await availableWithoutSeat(ids.unitC);
    await createPosition({ active: false, unitId: ids.unitB });
    const occupied = await createPosition({ unitId: ids.unitB });
    const occupiedHolder = await createProfessional('Titular presente');
    await seat(occupiedHolder.id, occupied.id);
    await createPosition({ cargoId: ids.cargoOther, unitId: ids.unitB });
    await createPosition({ unitId: ids.unitB, year: 2028 });
    await createPosition({ periodId: ids.periodAfternoon, unitId: ids.unitB });
    const event = await createEvent({ participants: [{ professionalId: professional.id }] });
    const operator = await authenticated();

    const central = await operator.get(`/eventos/${event.eventId}/central`).expect(200);
    expect(central.body.vagasDisponiveis.map(({ id }: { id: string }) => id)).toEqual(
      expect.arrayContaining([freeSeat.id, temporary.position.id]),
    );
    expect(central.body.vagasDisponiveis).toHaveLength(2);
    expect(
      central.body.vagasDisponiveis.map(
        ({ disponibilidade }: { disponibilidade: string }) => disponibilidade,
      ),
    ).toEqual(expect.arrayContaining(['DISPONIVEL_COM_SEDE', 'DISPONIVEL_SEM_SEDE']));

    const unit = await operator
      .get(`/eventos/${event.eventId}/vagas?unidadeId=${ids.unitB}`)
      .expect(200);
    expect(unit.body.map(({ id }: { id: string }) => id)).toEqual([freeSeat.id]);
    const type = await operator.get(`/eventos/${event.eventId}/vagas?tipo=SEM_SEDE`).expect(200);
    expect(type.body.map(({ id }: { id: string }) => id)).toEqual([temporary.position.id]);
    await operator
      .get(`/eventos/${event.eventId}/vagas?periodoId=${ids.periodAfternoon}`)
      .expect(200, []);
  });

  it('simula com a mesma regra sem alterar banco e bloqueia período ausente ou ambíguo', async () => {
    const professional = await createProfessional('Participante simulação');
    const source = await createPosition();
    const destination = await createPosition({ unitId: ids.unitB });
    await seat(professional.id, source.id);
    const event = await createEvent({ participants: [{ professionalId: professional.id }] });
    const operator = await authenticated();
    const before = {
      movements: await database.client.movimentacao.count({ where: { eventoId: event.eventId } }),
      placements: await database.client.lotacaoSede.count({
        where: { profissionalId: professional.id },
      }),
    };
    const simulation = await operator
      .get(`/eventos/${event.eventId}/simular-escolha?postoTrabalhoId=${destination.id}`)
      .expect(200);
    expect(simulation.body).toMatchObject({
      antes: { profissional: professional.nomeCompleto },
      destino: { postoId: destination.id, tipo: 'SEDE' },
      depois: { vinculoEncerrado: { postoId: source.id } },
      participanteEsperadoId: event.participantIds[0],
    });
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      before.movements,
    );
    expect(
      await database.client.lotacaoSede.count({ where: { profissionalId: professional.id } }),
    ).toBe(before.placements);

    const withoutLink = await createProfessional('Sem origem de período');
    const noPeriodEvent = await createEvent({ participants: [{ professionalId: withoutLink.id }] });
    const central = await operator.get(`/eventos/${noPeriodEvent.eventId}/central`).expect(200);
    expect(central.body.regraPeriodo.code).toBe('EVENT_PERIOD_RULE_REQUIRED');
    expect(central.body.vagasDisponiveis).toEqual([]);
    const noPeriod = await operator
      .get(`/eventos/${noPeriodEvent.eventId}/simular-escolha?postoTrabalhoId=${destination.id}`)
      .expect(409);
    expect(noPeriod.body.error).toBe('EVENT_PERIOD_RULE_REQUIRED');

    const ambiguous = await createProfessional('Períodos ambíguos');
    const holders = await Promise.all([
      availableWithoutSeat(ids.unitA, ids.periodMorning),
      availableWithoutSeat(ids.unitB, ids.periodAfternoon),
    ]);
    await exercise({
      holderId: holders[0].holder.id,
      positionId: holders[0].position.id,
      professionalId: ambiguous.id,
      type: 'SEM_SEDE',
    });
    await exercise({
      holderId: holders[1].holder.id,
      positionId: holders[1].position.id,
      professionalId: ambiguous.id,
      type: 'SEM_SEDE',
    });
    const ambiguousEvent = await createEvent({ participants: [{ professionalId: ambiguous.id }] });
    const ambiguousCentral = await operator
      .get(`/eventos/${ambiguousEvent.eventId}/central`)
      .expect(200);
    expect(ambiguousCentral.body.regraPeriodo.code).toBe('EVENT_PERIOD_RULE_REQUIRED');
  });

  it('confirma COM SEDE atomicamente, libera a sede anterior e avança a fila', async () => {
    const first = await createProfessional('Escolha sede');
    const next = await createProfessional('Próximo sede');
    const source = await createPosition({ unitId: ids.unitA });
    const destination = await createPosition({ unitId: ids.unitB });
    const nextSource = await createPosition({ unitId: ids.unitC });
    await seat(first.id, source.id);
    await seat(next.id, nextSource.id);
    const event = await createEvent({
      participants: [{ professionalId: first.id }, { professionalId: next.id }],
    });
    const operator = await authenticated();
    const operatorUser = await database.client.usuario.findUniqueOrThrow({
      where: { login: logins.operator },
    });
    const response = await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({
        participanteEsperadoId: event.participantIds[0],
        postoTrabalhoId: destination.id,
        profissionalId: next.id,
        tipoDestino: 'SEM_SEDE',
        usuarioId: randomUUID(),
      })
      .expect(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    const chosen = await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({ participanteEsperadoId: event.participantIds[0], postoTrabalhoId: destination.id })
      .expect(200);
    expect(chosen.body.atendido).toMatchObject({
      participanteId: event.participantIds[0],
      status: 'ATENDIDO',
    });
    expect(chosen.body.movimentacao.origem).toMatchObject({
      postoId: source.id,
      unidadeId: ids.unitA,
    });
    expect(chosen.body.central.participanteAtual).toMatchObject({ profissionalId: next.id });
    expect(chosen.body.central.vagasDisponiveis.map(({ id }: { id: string }) => id)).toContain(
      source.id,
    );

    const placements = await database.client.lotacaoSede.findMany({
      orderBy: { dataInicio: 'asc' },
      where: { profissionalId: first.id },
    });
    expect(placements).toHaveLength(2);
    expect(placements[0]).toMatchObject({
      postoTrabalhoId: source.id,
      motivoFim: expect.stringContaining('Movimentação por evento REMOCAO/'),
    });
    expect(placements[0]!.dataFim).not.toBeNull();
    expect(placements[1]).toMatchObject({ dataFim: null, postoTrabalhoId: destination.id });
    const movement = await database.client.movimentacao.findFirstOrThrow({
      include: { itens: true },
      where: { eventoId: event.eventId },
    });
    expect(movement).toMatchObject({ tipo: 'REMOCAO', usuarioId: operatorUser.id });
    expect(movement.dataHora.getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
    expect(movement.itens).toEqual([
      expect.objectContaining({
        postoDestinoId: destination.id,
        postoOrigemId: source.id,
        profissionalId: first.id,
        substituiProfissionalId: null,
        tipoDestino: 'SEDE',
      }),
    ]);
  });

  it('confirma SEM SEDE preservando titular, derivando substituição e atualizando vagas', async () => {
    const maria = await createProfessional('Maria titular');
    const joao = await createProfessional('João substituto');
    const seatA = await createPosition({ unitId: ids.unitA });
    const seatB = await createPosition({ unitId: ids.unitB });
    await seat(joao.id, seatA.id);
    await seat(maria.id, seatB.id);
    await absence(maria.id);
    const event = await createEvent({ participants: [{ professionalId: joao.id }] });
    const operator = await authenticated();
    const choice = await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({ participanteEsperadoId: event.participantIds[0], postoTrabalhoId: seatB.id })
      .expect(200);
    expect(choice.body.movimentacao).toMatchObject({
      postoOrigemId: null,
      tipoDestino: 'SEM_SEDE',
    });
    expect(
      await database.client.lotacaoSede.findFirst({
        where: { postoTrabalhoId: seatB.id, dataFim: null },
      }),
    ).toMatchObject({ profissionalId: maria.id });
    expect(
      await database.client.exercicioProfissional.findFirst({
        where: { postoTrabalhoId: seatB.id, dataFim: null },
      }),
    ).toMatchObject({
      profissionalId: joao.id,
      substituiProfissionalId: maria.id,
      tipoExercicio: 'SUBSTITUICAO',
    });
    const item = await database.client.movimentacaoItem.findFirstOrThrow({
      where: { movimentacao: { eventoId: event.eventId } },
    });
    expect(item).toMatchObject({
      substituiProfissionalId: maria.id,
      tipoDestino: 'SEM_SEDE',
    });
    expect(choice.body.central.vagasDisponiveis.map(({ id }: { id: string }) => id)).not.toContain(
      seatB.id,
    );
  });

  it('registra LISTAO com tipo correto e bloqueia ano, cargo, período e vaga alterada sem efeitos parciais', async () => {
    const candidate = await createProfessional('Participante rollback');
    const source = await createPosition();
    await seat(candidate.id, source.id);
    const operator = await authenticated();
    const invalidDestinations = [
      { code: 'INCOMPATIBLE_POSITION_YEAR', position: await createPosition({ year: 2028 }) },
      {
        code: 'INCOMPATIBLE_POSITION_CARGO',
        position: await createPosition({ cargoId: ids.cargoOther }),
      },
      {
        code: 'INCOMPATIBLE_POSITION_PERIOD',
        position: await createPosition({ periodId: ids.periodAfternoon }),
      },
    ];
    for (const invalid of invalidDestinations) {
      const event = await createEvent({
        participants: [{ professionalId: candidate.id }],
        type: 'LISTAO',
      });
      const response = await operator
        .post(`/eventos/${event.eventId}/escolha`)
        .send({
          participanteEsperadoId: event.participantIds[0],
          postoTrabalhoId: invalid.position.id,
        })
        .expect(409);
      expect(response.body.error).toBe(invalid.code);
      expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
        0,
      );
      expect(
        await database.client.eventoParticipante.findUnique({
          where: { id: event.participantIds[0]! },
        }),
      ).toMatchObject({ status: 'AGUARDANDO' });
    }

    const staleDestination = await createPosition({ unitId: ids.unitB });
    const staleEvent = await createEvent({
      participants: [{ professionalId: candidate.id }],
      type: 'LISTAO',
    });
    await operator
      .get(`/eventos/${staleEvent.eventId}/simular-escolha?postoTrabalhoId=${staleDestination.id}`)
      .expect(200);
    const other = await createProfessional('Ocupante concorrente');
    await seat(other.id, staleDestination.id);
    const stale = await operator
      .post(`/eventos/${staleEvent.eventId}/escolha`)
      .send({
        participanteEsperadoId: staleEvent.participantIds[0],
        postoTrabalhoId: staleDestination.id,
      })
      .expect(409);
    expect(stale.body.error).toBe('POSITION_NO_LONGER_AVAILABLE');
    expect(
      await database.client.movimentacao.count({ where: { eventoId: staleEvent.eventId } }),
    ).toBe(0);

    const listDestination = await createPosition({ unitId: ids.unitC });
    const listEvent = await createEvent({
      participants: [{ professionalId: candidate.id }],
      type: 'LISTAO',
    });
    await operator
      .post(`/eventos/${listEvent.eventId}/escolha`)
      .send({
        participanteEsperadoId: listEvent.participantIds[0],
        postoTrabalhoId: listDestination.id,
      })
      .expect(200);
    expect(
      await database.client.movimentacao.findFirst({ where: { eventoId: listEvent.eventId } }),
    ).toMatchObject({ tipo: 'LISTAO' });
  });

  it('não encerra sede anterior ocupada por substituto', async () => {
    const candidate = await createProfessional('Titular com substituto');
    const substitute = await createProfessional('Substituto ativo');
    const source = await createPosition();
    const holderForExercise = candidate;
    const destination = await createPosition({ unitId: ids.unitB });
    await seat(candidate.id, source.id);
    await exercise({
      holderId: holderForExercise.id,
      positionId: source.id,
      professionalId: substitute.id,
    });
    const event = await createEvent({ participants: [{ professionalId: candidate.id }] });
    const operator = await authenticated();
    const response = await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({ participanteEsperadoId: event.participantIds[0], postoTrabalhoId: destination.id })
      .expect(409);
    expect(response.body.error).toBe('PREVIOUS_SEAT_STILL_OCCUPIED');
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      0,
    );
    expect(
      await database.client.lotacaoSede.findFirst({
        where: { profissionalId: candidate.id, dataFim: null },
      }),
    ).toMatchObject({ postoTrabalhoId: source.id });
  });

  it('rejeita múltiplos exercícios ambíguos sem encerrar arbitrariamente e preserva múltiplos em escolha de sede', async () => {
    const candidate = await createProfessional('Múltiplos exercícios');
    const ownSeat = await createPosition();
    await seat(candidate.id, ownSeat.id);
    const temporaryA = await availableWithoutSeat(ids.unitB);
    const temporaryB = await availableWithoutSeat(ids.unitC);
    await exercise({
      holderId: temporaryA.holder.id,
      positionId: temporaryA.position.id,
      professionalId: candidate.id,
    });
    await exercise({
      holderId: temporaryB.holder.id,
      positionId: temporaryB.position.id,
      professionalId: candidate.id,
    });
    const semSeatDestination = await availableWithoutSeat(ids.unitA);
    const event = await createEvent({ participants: [{ professionalId: candidate.id }] });
    const operator = await authenticated();
    const ambiguous = await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({
        participanteEsperadoId: event.participantIds[0],
        postoTrabalhoId: semSeatDestination.position.id,
      })
      .expect(409);
    expect(ambiguous.body.error).toBe('AMBIGUOUS_ACTIVE_EXERCISES');
    expect(
      await database.client.exercicioProfissional.count({
        where: { profissionalId: candidate.id, dataFim: null },
      }),
    ).toBe(2);

    const seatDestination = await createPosition({ unitId: ids.unitB });
    await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({
        participanteEsperadoId: event.participantIds[0],
        postoTrabalhoId: seatDestination.id,
      })
      .expect(200);
    expect(
      await database.client.exercicioProfissional.count({
        where: { profissionalId: candidate.id, dataFim: null },
      }),
    ).toBe(2);
  });

  it('serializa dupla submissão sem aplicar a segunda ao próximo participante', async () => {
    const first = await createProfessional('Concorrência primeiro');
    const second = await createProfessional('Concorrência segundo');
    const sourceFirst = await createPosition({ unitId: ids.unitA });
    const sourceSecond = await createPosition({ unitId: ids.unitB });
    const destinationA = await createPosition({ unitId: ids.unitC });
    const destinationB = await createPosition({ unitId: ids.unitC });
    await seat(first.id, sourceFirst.id);
    await seat(second.id, sourceSecond.id);
    const event = await createEvent({
      participants: [{ professionalId: first.id }, { professionalId: second.id }],
    });
    const operator = await authenticated();
    const [choiceA, choiceB] = await Promise.all([
      operator.post(`/eventos/${event.eventId}/escolha`).send({
        participanteEsperadoId: event.participantIds[0],
        postoTrabalhoId: destinationA.id,
      }),
      operator.post(`/eventos/${event.eventId}/escolha`).send({
        participanteEsperadoId: event.participantIds[0],
        postoTrabalhoId: destinationB.id,
      }),
    ]);
    expect(
      [choiceA.status, choiceB.status].sort(),
      JSON.stringify([choiceA.body, choiceB.body]),
    ).toEqual([200, 409]);
    expect([choiceA.body.error, choiceB.body.error]).toContain('EVENT_PARTICIPANT_ALREADY_HANDLED');
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      1,
    );
    expect(
      await database.client.eventoParticipante.findUnique({
        where: { id: event.participantIds[1]! },
      }),
    ).toMatchObject({ status: 'AGUARDANDO' });
    expect(
      await database.client.movimentacaoItem.count({ where: { profissionalId: second.id } }),
    ).toBe(0);
  });

  it('permite somente um vencedor quando dois eventos disputam a mesma vaga', async () => {
    const candidateA = await createProfessional('Evento concorrente A');
    const candidateB = await createProfessional('Evento concorrente B');
    const sourceA = await createPosition({ unitId: ids.unitA });
    const sourceB = await createPosition({ unitId: ids.unitB });
    const destination = await createPosition({ unitId: ids.unitC });
    await seat(candidateA.id, sourceA.id);
    await seat(candidateB.id, sourceB.id);
    const eventA = await createEvent({ participants: [{ professionalId: candidateA.id }] });
    const eventB = await createEvent({ participants: [{ professionalId: candidateB.id }] });
    const operator = await authenticated();
    const [responseA, responseB] = await Promise.all([
      operator.post(`/eventos/${eventA.eventId}/escolha`).send({
        participanteEsperadoId: eventA.participantIds[0],
        postoTrabalhoId: destination.id,
      }),
      operator.post(`/eventos/${eventB.eventId}/escolha`).send({
        participanteEsperadoId: eventB.participantIds[0],
        postoTrabalhoId: destination.id,
      }),
    ]);
    expect([responseA.status, responseB.status].sort()).toEqual([200, 409]);
    expect(
      await database.client.lotacaoSede.count({
        where: { postoTrabalhoId: destination.id, dataFim: null },
      }),
    ).toBe(1);
    expect(
      await database.client.movimentacao.count({
        where: { eventoId: { in: [eventA.eventId, eventB.eventId] } },
      }),
    ).toBe(1);
    const statuses = await database.client.eventoParticipante.findMany({
      select: { status: true },
      where: { eventoId: { in: [eventA.eventId, eventB.eventId] } },
    });
    expect(statuses.map(({ status }) => status).sort()).toEqual(['AGUARDANDO', 'ATENDIDO']);
  });

  it('preserva a cadeia Maria -> João -> Carlos e os históricos de exercício', async () => {
    const maria = await createProfessional('Maria cadeia');
    const joao = await createProfessional('João cadeia');
    const carlos = await createProfessional('Carlos cadeia');
    const holderC = await createProfessional('Titular C cadeia');
    const seatA = await createPosition({ unitId: ids.unitA });
    const seatB = await createPosition({ unitId: ids.unitB });
    const temporaryC = await createPosition({ unitId: ids.unitC });
    await seat(joao.id, seatA.id);
    await seat(maria.id, seatB.id);
    await absence(maria.id);
    await seat(holderC.id, temporaryC.id);
    await absence(holderC.id);
    const oldCarlosExercise = await exercise({
      holderId: holderC.id,
      positionId: temporaryC.id,
      professionalId: carlos.id,
      type: 'SEM_SEDE',
    });
    const event = await createEvent({
      participants: [{ professionalId: joao.id }, { professionalId: carlos.id }],
    });
    const operator = await authenticated();
    const first = await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({ participanteEsperadoId: event.participantIds[0], postoTrabalhoId: seatB.id })
      .expect(200);
    expect(first.body.central.participanteAtual.profissionalId).toBe(carlos.id);
    await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({ participanteEsperadoId: event.participantIds[1], postoTrabalhoId: seatA.id })
      .expect(200);

    expect(
      await database.client.lotacaoSede.findFirst({
        where: { postoTrabalhoId: seatB.id, dataFim: null },
      }),
    ).toMatchObject({ profissionalId: maria.id });
    expect(
      await database.client.exercicioProfissional.findFirst({
        where: { postoTrabalhoId: seatB.id, dataFim: null },
      }),
    ).toMatchObject({ profissionalId: joao.id, substituiProfissionalId: maria.id });
    expect(
      await database.client.lotacaoSede.findFirst({
        where: { postoTrabalhoId: seatA.id, dataFim: null },
      }),
    ).toMatchObject({ profissionalId: joao.id });
    expect(
      await database.client.exercicioProfissional.findFirst({
        where: { postoTrabalhoId: seatA.id, dataFim: null },
      }),
    ).toMatchObject({ profissionalId: carlos.id, substituiProfissionalId: joao.id });
    expect(
      await database.client.exercicioProfissional.findUnique({
        where: { id: oldCarlosExercise.id },
      }),
    ).toMatchObject({ dataFim: expect.any(Date) });
    expect(await database.client.movimentacao.count({ where: { eventoId: event.eventId } })).toBe(
      2,
    );
  });

  it('só encerra sem AGUARDANDO, grava data do servidor e bloqueia novas escolhas', async () => {
    const professional = await createProfessional('Encerramento');
    const source = await createPosition();
    await seat(professional.id, source.id);
    const event = await createEvent({ participants: [{ professionalId: professional.id }] });
    const operator = await authenticated();
    const pending = await operator.post(`/eventos/${event.eventId}/encerrar`).expect(409);
    expect(pending.body.error).toBe('EVENT_HAS_PENDING_PARTICIPANTS');
    await database.client.eventoParticipante.update({
      data: { status: 'ATENDIDO' },
      where: { id: event.participantIds[0]! },
    });
    const closed = await operator.post(`/eventos/${event.eventId}/encerrar`).expect(200);
    expect(closed.body).toMatchObject({ status: 'ENCERRADO' });
    expect(new Date(closed.body.dataFim).getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
    const afterClose = await operator.get(`/eventos/${event.eventId}/central`).expect(409);
    expect(afterClose.body.error).toBe('EVENT_CLOSED');
    const publicView = await request(app).get(`/public/eventos/${event.eventId}/telao`).expect(200);
    expect(publicView.body).toMatchObject({
      evento: { status: 'ENCERRADO' },
      participanteAtual: null,
      proximos: [],
    });
  });

  it('expõe telão e histórico públicos paginados sem campos sensíveis', async () => {
    const first = await createProfessional('Público primeiro');
    const second = await createProfessional('Público segundo');
    const sourceA = await createPosition({ unitId: ids.unitA });
    const sourceB = await createPosition({ unitId: ids.unitB });
    const destinationA = await createPosition({ unitId: ids.unitC });
    const destinationB = await createPosition({ unitId: ids.unitC });
    await seat(first.id, sourceA.id);
    await seat(second.id, sourceB.id);
    const event = await createEvent({
      participants: [{ professionalId: first.id }, { professionalId: second.id }],
    });
    const operator = await authenticated();
    await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({ participanteEsperadoId: event.participantIds[0], postoTrabalhoId: destinationA.id })
      .expect(200);
    await operator
      .post(`/eventos/${event.eventId}/escolha`)
      .send({ participanteEsperadoId: event.participantIds[1], postoTrabalhoId: destinationB.id })
      .expect(200);

    const display = await request(app).get(`/public/eventos/${event.eventId}/telao`).expect(200);
    expect(display.body.evento).toMatchObject({ tipo: 'REMOCAO' });
    expect(display.body.participanteAtual).toBeNull();
    expect(display.body.ultimasEscolhas).toHaveLength(2);
    expect(new Date(display.body.ultimasEscolhas[0].dataHora).getTime()).toBeGreaterThan(
      new Date(display.body.ultimasEscolhas[1].dataHora).getTime(),
    );
    expectNoSensitiveKeys(display.body);

    const history = await request(app)
      .get(`/public/eventos/${event.eventId}/escolhas?page=1&pageSize=1`)
      .expect(200);
    expect(history.body).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    expect(history.body.items).toHaveLength(1);
    expectNoSensitiveKeys(history.body);
  });
});
