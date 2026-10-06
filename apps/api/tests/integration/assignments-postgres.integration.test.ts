import { createDatabaseConnection, Prisma } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createPrismaAssignmentServices } from '../../src/modules/assignments/assignment.service.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createPrismaStaffingServices } from '../../src/modules/staffing/staffing.service.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 5 vínculos e disponibilidade no PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const assignments = createPrismaAssignmentServices(database);
  const staffing = createPrismaStaffingServices(database);
  const app = createApp({
    assignmentServices: assignments,
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const ids = {
    cargoComum: randomUUID(),
    cargoIncompativel: randomUUID(),
    cargoMultiplo: randomUUID(),
    periodo: randomUUID(),
    tipoUnidade: randomUUID(),
    unidadeA: randomUUID(),
    unidadeB: randomUUID(),
    unidadeC: randomUUID(),
  };
  const password = 'Senha Etapa 5 2026!';
  const credentials = {
    admin: `admin.vinculos.${suffix}`,
    director: `diretor.vinculos.${suffix}`,
    operator: `operador.vinculos.${suffix}`,
    secretary: `secretario.vinculos.${suffix}`,
  };
  let professionalSequence = 0;
  let positionSequence = 0;

  beforeAll(async () => {
    await database.client.tipoUnidade.create({
      data: { id: ids.tipoUnidade, nome: `Tipo vínculos ${suffix}` },
    });
    await database.client.unidade.createMany({
      data: [
        { id: ids.unidadeA, nome: `Unidade vínculos A ${suffix}`, tipoUnidadeId: ids.tipoUnidade },
        { id: ids.unidadeB, nome: `Unidade vínculos B ${suffix}`, tipoUnidadeId: ids.tipoUnidade },
        { id: ids.unidadeC, nome: `Unidade vínculos C ${suffix}`, tipoUnidadeId: ids.tipoUnidade },
      ],
    });
    await database.client.cargoFuncao.createMany({
      data: [
        { id: ids.cargoComum, nome: `Cargo comum ${suffix}` },
        { id: ids.cargoIncompativel, nome: `Cargo incompatível ${suffix}` },
        {
          id: ids.cargoMultiplo,
          nome: `Cargo múltiplo ${suffix}`,
          permiteMultiplosExercicios: true,
        },
      ],
    });
    await database.client.cargoTipoUnidade.createMany({
      data: [ids.cargoComum, ids.cargoIncompativel, ids.cargoMultiplo].map((cargoFuncaoId) => ({
        cargoFuncaoId,
        tipoUnidadeId: ids.tipoUnidade,
      })),
    });
    await database.client.periodo.create({
      data: { id: ids.periodo, nome: `Integral vínculos ${suffix}` },
    });
    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        { login: credentials.admin, nome: 'Admin Vínculos', perfil: 'ADMINISTRADOR', senhaHash },
        { login: credentials.operator, nome: 'Operador Vínculos', perfil: 'OPERADOR', senhaHash },
      ],
    });
    await database.client.usuario.create({
      data: {
        login: credentials.director,
        nome: 'Diretor Multiunidade',
        perfil: 'DIRETOR',
        senhaHash,
        unidades: { create: [{ unidadeId: ids.unidadeA }, { unidadeId: ids.unidadeB }] },
      },
    });
    await database.client.usuario.create({
      data: {
        login: credentials.secretary,
        nome: 'Secretário Unidade A',
        perfil: 'SECRETARIO',
        senhaHash,
        unidades: { create: [{ unidadeId: ids.unidadeA }] },
      },
    });
  }, 30_000);

  afterAll(async () => {
    await database.client.sessaoUsuario.deleteMany({
      where: { usuario: { login: { contains: suffix } } },
    });
    await database.client.usuario.deleteMany({ where: { login: { contains: suffix } } });
    await database.client.afastamentoProfissional.deleteMany({
      where: { profissional: { matricula: { startsWith: `V-${suffix}` } } },
    });
    await database.client.exercicioProfissional.deleteMany({
      where: { profissional: { matricula: { startsWith: `V-${suffix}` } } },
    });
    await database.client.lotacaoSede.deleteMany({
      where: { profissional: { matricula: { startsWith: `V-${suffix}` } } },
    });
    await database.client.profissional.deleteMany({
      where: { matricula: { startsWith: `V-${suffix}` } },
    });
    await database.client.postoTrabalho.deleteMany({
      where: { unidadeId: { in: [ids.unidadeA, ids.unidadeB, ids.unidadeC] } },
    });
    await database.client.quadroNecessidade.deleteMany({
      where: { unidadeId: { in: [ids.unidadeA, ids.unidadeB, ids.unidadeC] } },
    });
    await database.client.periodo.deleteMany({ where: { id: ids.periodo } });
    await database.client.cargoTipoUnidade.deleteMany({
      where: {
        cargoFuncaoId: { in: [ids.cargoComum, ids.cargoIncompativel, ids.cargoMultiplo] },
      },
    });
    await database.client.cargoFuncao.deleteMany({
      where: { id: { in: [ids.cargoComum, ids.cargoIncompativel, ids.cargoMultiplo] } },
    });
    await database.client.unidade.deleteMany({
      where: { id: { in: [ids.unidadeA, ids.unidadeB, ids.unidadeC] } },
    });
    await database.client.tipoUnidade.deleteMany({ where: { id: ids.tipoUnidade } });
    await database.disconnect();
  }, 30_000);

  async function authenticated(login: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
    return agent;
  }

  async function createProfessional(cargoFuncaoId = ids.cargoComum, name?: string) {
    professionalSequence += 1;
    return database.client.profissional.create({
      data: {
        cargoFuncaoId,
        cpf: '12345678901',
        dataEntradaPrefeitura: new Date('2020-01-01T00:00:00.000Z'),
        dataNascimento: new Date('1980-01-01T00:00:00.000Z'),
        matricula: `V-${suffix}-${professionalSequence}`,
        nomeCompleto: name ?? `Profissional Vínculos ${professionalSequence}`,
      },
    });
  }

  async function createPosition(
    unidadeId = ids.unidadeA,
    cargoFuncaoId = ids.cargoComum,
    ativo = true,
  ) {
    positionSequence += 1;
    const plan = await database.client.quadroNecessidade.create({
      data: {
        anoLetivo: 2200 + positionSequence,
        cargoFuncaoId,
        periodoId: ids.periodo,
        quantidade: ativo ? 1 : 0,
        segmentoEnsinoId: null,
        unidadeId,
      },
    });
    return database.client.postoTrabalho.create({
      data: {
        anoLetivo: plan.anoLetivo,
        ativo,
        cargoFuncaoId,
        periodoId: ids.periodo,
        quadroNecessidadeId: plan.id,
        unidadeId,
      },
    });
  }

  async function makeTemporaryPosition(cargoFuncaoId = ids.cargoComum) {
    const position = await createPosition(ids.unidadeB, cargoFuncaoId);
    const holder = await createProfessional(cargoFuncaoId);
    await assignments.placements.assign({
      postoTrabalhoId: position.id,
      profissionalId: holder.id,
    });
    await assignments.absences.create(holder.id, {
      dataInicio: new Date(Date.now() - 60_000),
      observacoes: null,
      tipo: 'Afastamento de teste',
    });
    return { holder, position };
  }

  it('calcula os quatro estados públicos a partir dos históricos ativos', async () => {
    const free = await createPosition();
    const inactive = await createPosition(ids.unidadeA, ids.cargoComum, false);
    const occupied = await createPosition();
    const holder = await createProfessional();
    await assignments.placements.assign({
      postoTrabalhoId: occupied.id,
      profissionalId: holder.id,
    });

    await expect(staffing.workPositions.get(free.id)).resolves.toMatchObject({
      disponibilidade: 'DISPONIVEL_COM_SEDE',
    });
    await expect(staffing.workPositions.get(inactive.id)).resolves.toMatchObject({
      disponibilidade: 'INATIVO',
    });
    await expect(staffing.workPositions.get(occupied.id)).resolves.toMatchObject({
      disponibilidade: 'INDISPONIVEL',
    });

    await assignments.absences.create(holder.id, {
      dataInicio: new Date(Date.now() - 60_000),
      observacoes: null,
      tipo: 'Licença',
    });
    await expect(staffing.workPositions.get(occupied.id)).resolves.toMatchObject({
      disponibilidade: 'DISPONIVEL_SEM_SEDE',
      motivosLiberacao: ['AFASTAMENTO'],
    });

    const substitute = await createProfessional();
    await assignments.exercises.startTemporary({
      postoTrabalhoId: occupied.id,
      profissionalId: substitute.id,
    });
    await expect(staffing.workPositions.get(occupied.id)).resolves.toMatchObject({
      disponibilidade: 'INDISPONIVEL',
      ocupanteAtual: { id: substitute.id },
      titularAtual: { id: holder.id },
    });
  });

  it('executa a cadeia Maria -> João -> Carlos, calcula tipos e preserva titularidades', async () => {
    const postoA = await createPosition(ids.unidadeA);
    const postoB = await createPosition(ids.unidadeB);
    const maria = await createProfessional(ids.cargoComum, 'Maria');
    const joao = await createProfessional(ids.cargoComum, 'João');
    const carlos = await createProfessional(ids.cargoComum, 'Carlos');
    await assignments.placements.assign({ postoTrabalhoId: postoB.id, profissionalId: maria.id });
    await assignments.placements.assign({ postoTrabalhoId: postoA.id, profissionalId: joao.id });
    await assignments.absences.create(maria.id, {
      dataInicio: new Date(Date.now() - 60_000),
      observacoes: null,
      tipo: 'Licença',
    });

    const joaoExercise = await assignments.exercises.startTemporary({
      postoTrabalhoId: postoB.id,
      profissionalId: joao.id,
    });
    expect(joaoExercise).toMatchObject({
      substituiProfissional: { id: maria.id },
      tipo: 'SUBSTITUICAO',
    });
    await expect(staffing.workPositions.get(postoA.id)).resolves.toMatchObject({
      disponibilidade: 'DISPONIVEL_SEM_SEDE',
      motivosLiberacao: ['EXERCICIO_OUTRO_POSTO'],
    });

    const carlosExercise = await assignments.exercises.startTemporary({
      postoTrabalhoId: postoA.id,
      profissionalId: carlos.id,
    });
    expect(carlosExercise).toMatchObject({
      substituiProfissional: { id: joao.id },
      tipo: 'SEM_SEDE',
    });
    await expect(staffing.workPositions.get(postoB.id)).resolves.toMatchObject({
      disponibilidade: 'INDISPONIVEL',
      ocupanteAtual: { id: joao.id },
      titularAtual: { id: maria.id },
    });
    await expect(staffing.workPositions.get(postoA.id)).resolves.toMatchObject({
      disponibilidade: 'INDISPONIVEL',
      ocupanteAtual: { id: carlos.id },
      titularAtual: { id: joao.id },
    });

    await expect(assignments.exercises.end(joaoExercise.id)).rejects.toMatchObject({ status: 409 });
    await assignments.exercises.end(carlosExercise.id);
    await expect(staffing.workPositions.get(postoA.id)).resolves.toMatchObject({
      disponibilidade: 'DISPONIVEL_SEM_SEDE',
    });
    await assignments.exercises.end(joaoExercise.id);
    await expect(staffing.workPositions.get(postoA.id)).resolves.toMatchObject({
      disponibilidade: 'INDISPONIVEL',
    });

    expect(await database.client.lotacaoSede.count({ where: { profissionalId: joao.id } })).toBe(1);
    expect(
      await database.client.exercicioProfissional.count({ where: { profissionalId: joao.id } }),
    ).toBe(1);
    expect(
      await database.client.exercicioProfissional.count({ where: { profissionalId: carlos.id } }),
    ).toBe(1);
  });

  it('encerra um motivo somente se outro ainda liberar a sede ocupada', async () => {
    const position = await createPosition();
    const holder = await createProfessional();
    const substitute = await createProfessional();
    await assignments.placements.assign({
      postoTrabalhoId: position.id,
      profissionalId: holder.id,
    });
    const first = await assignments.absences.create(holder.id, {
      dataInicio: new Date(Date.now() - 120_000),
      observacoes: null,
      tipo: 'Primeiro motivo',
    });
    const second = await assignments.absences.create(holder.id, {
      dataInicio: new Date(Date.now() - 60_000),
      observacoes: null,
      tipo: 'Segundo motivo',
    });
    const exercise = await assignments.exercises.startTemporary({
      postoTrabalhoId: position.id,
      profissionalId: substitute.id,
    });

    await expect(assignments.absences.end(holder.id, first.id)).resolves.toMatchObject({
      ativo: false,
    });
    await expect(assignments.absences.end(holder.id, second.id)).rejects.toMatchObject({
      status: 409,
    });
    await assignments.exercises.end(exercise.id);
    await expect(assignments.absences.end(holder.id, second.id)).resolves.toMatchObject({
      ativo: false,
    });
    await expect(staffing.workPositions.get(position.id)).resolves.toMatchObject({
      disponibilidade: 'INDISPONIVEL',
    });
    expect(
      await database.client.afastamentoProfissional.count({ where: { profissionalId: holder.id } }),
    ).toBe(2);
  });

  it('serializa duas atribuições da mesma sede COM SEDE e preserva histórico sem DELETE', async () => {
    const target = await createPosition();
    const first = await createProfessional();
    const second = await createProfessional();
    const results = await Promise.allSettled([
      assignments.placements.assign({ postoTrabalhoId: target.id, profissionalId: first.id }),
      assignments.placements.assign({ postoTrabalhoId: target.id, profissionalId: second.id }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(
      await database.client.lotacaoSede.count({
        where: { dataFim: null, postoTrabalhoId: target.id },
      }),
    ).toBe(1);

    const winnerId = (
      await database.client.lotacaoSede.findFirstOrThrow({
        where: { dataFim: null, postoTrabalhoId: target.id },
      })
    ).profissionalId;
    const next = await createPosition();
    await assignments.placements.assign({ postoTrabalhoId: next.id, profissionalId: winnerId });
    expect(await database.client.lotacaoSede.count({ where: { profissionalId: winnerId } })).toBe(
      2,
    );
    expect(
      await database.client.lotacaoSede.count({
        where: { dataFim: null, profissionalId: winnerId },
      }),
    ).toBe(1);
  });

  it('serializa duas entradas na mesma disponibilidade SEM SEDE', async () => {
    const { position } = await makeTemporaryPosition();
    const first = await createProfessional();
    const second = await createProfessional();
    const results = await Promise.allSettled([
      assignments.exercises.startTemporary({
        postoTrabalhoId: position.id,
        profissionalId: first.id,
      }),
      assignments.exercises.startTemporary({
        postoTrabalhoId: position.id,
        profissionalId: second.id,
      }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(
      await database.client.exercicioProfissional.count({
        where: { dataFim: null, postoTrabalhoId: position.id },
      }),
    ).toBe(1);
  });

  it('mantém consistência ao encerrar afastamento concorrentemente com nova substituição', async () => {
    const position = await createPosition();
    const holder = await createProfessional();
    const substitute = await createProfessional();
    await assignments.placements.assign({
      postoTrabalhoId: position.id,
      profissionalId: holder.id,
    });
    const absence = await assignments.absences.create(holder.id, {
      dataInicio: new Date(Date.now() - 60_000),
      observacoes: null,
      tipo: 'Concorrência',
    });
    const results = await Promise.allSettled([
      assignments.absences.end(holder.id, absence.id),
      assignments.exercises.startTemporary({
        postoTrabalhoId: position.id,
        profissionalId: substitute.id,
      }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const [activeAbsences, activeExercises] = await Promise.all([
      database.client.afastamentoProfissional.count({ where: { dataFim: null, id: absence.id } }),
      database.client.exercicioProfissional.count({
        where: { dataFim: null, postoTrabalhoId: position.id },
      }),
    ]);
    expect([activeAbsences, activeExercises]).toEqual(activeExercises ? [1, 1] : [0, 0]);
  });

  it('mantém consistência ao encerrar exercício do titular concorrentemente com substituição', async () => {
    const ownSeat = await createPosition(ids.unidadeA);
    const temporary = await makeTemporaryPosition();
    const holder = await createProfessional();
    const substitute = await createProfessional();
    await assignments.placements.assign({ postoTrabalhoId: ownSeat.id, profissionalId: holder.id });
    const externalExercise = await assignments.exercises.startTemporary({
      postoTrabalhoId: temporary.position.id,
      profissionalId: holder.id,
    });

    const results = await Promise.allSettled([
      assignments.exercises.end(externalExercise.id),
      assignments.exercises.startTemporary({
        postoTrabalhoId: ownSeat.id,
        profissionalId: substitute.id,
      }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const activeExternal = await database.client.exercicioProfissional.count({
      where: { dataFim: null, id: externalExercise.id },
    });
    const activeOwnSeat = await database.client.exercicioProfissional.count({
      where: { dataFim: null, postoTrabalhoId: ownSeat.id },
    });
    expect([activeExternal, activeOwnSeat]).toEqual(activeOwnSeat ? [1, 1] : [0, 0]);
  });

  it('altera uma cadeia simultaneamente sem ocupante duplo nem titularidade perdida', async () => {
    const ownSeat = await createPosition(ids.unidadeA);
    const temporary = await makeTemporaryPosition();
    const holder = await createProfessional();
    const firstSubstitute = await createProfessional();
    const nextSubstitute = await createProfessional();
    await assignments.placements.assign({ postoTrabalhoId: ownSeat.id, profissionalId: holder.id });
    await assignments.exercises.startTemporary({
      postoTrabalhoId: temporary.position.id,
      profissionalId: holder.id,
    });
    const firstExercise = await assignments.exercises.startTemporary({
      postoTrabalhoId: ownSeat.id,
      profissionalId: firstSubstitute.id,
    });

    await Promise.allSettled([
      assignments.exercises.end(firstExercise.id),
      assignments.exercises.startTemporary({
        postoTrabalhoId: ownSeat.id,
        profissionalId: nextSubstitute.id,
      }),
    ]);
    expect(
      await database.client.exercicioProfissional.count({
        where: { dataFim: null, postoTrabalhoId: ownSeat.id },
      }),
    ).toBeLessThanOrEqual(1);
    expect(
      await database.client.lotacaoSede.count({
        where: { dataFim: null, postoTrabalhoId: ownSeat.id, profissionalId: holder.id },
      }),
    ).toBe(1);
  });

  it('valida cargo e preserva limites comum/múltiplo e proteções de troca', async () => {
    const freeIncompatible = await createPosition(ids.unidadeA, ids.cargoComum);
    const incompatible = await createProfessional(ids.cargoIncompativel);
    await expect(
      assignments.placements.assign({
        postoTrabalhoId: freeIncompatible.id,
        profissionalId: incompatible.id,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const temporaryIncompatible = await makeTemporaryPosition(ids.cargoComum);
    await expect(
      assignments.exercises.startTemporary({
        postoTrabalhoId: temporaryIncompatible.position.id,
        profissionalId: incompatible.id,
      }),
    ).rejects.toMatchObject({ status: 409 });

    const commonTargets = await Promise.all([makeTemporaryPosition(), makeTemporaryPosition()]);
    const common = await createProfessional(ids.cargoComum);
    await assignments.exercises.startTemporary({
      postoTrabalhoId: commonTargets[0].position.id,
      profissionalId: common.id,
    });
    await expect(
      assignments.exercises.startTemporary({
        postoTrabalhoId: commonTargets[1].position.id,
        profissionalId: common.id,
      }),
    ).rejects.toMatchObject({ status: 409 });

    const multipleTargets = await Promise.all([
      makeTemporaryPosition(ids.cargoMultiplo),
      makeTemporaryPosition(ids.cargoMultiplo),
    ]);
    const multiple = await createProfessional(ids.cargoMultiplo);
    await assignments.exercises.startTemporary({
      postoTrabalhoId: multipleTargets[0].position.id,
      profissionalId: multiple.id,
    });
    await assignments.exercises.startTemporary({
      postoTrabalhoId: multipleTargets[1].position.id,
      profissionalId: multiple.id,
    });
    expect(
      await database.client.exercicioProfissional.count({
        where: { dataFim: null, profissionalId: multiple.id },
      }),
    ).toBe(2);
    await expect(
      database.client.profissional.update({
        data: { cargoFuncaoId: ids.cargoComum },
        where: { id: multiple.id },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(
      database.client.cargoFuncao.update({
        data: { permiteMultiplosExercicios: false },
        where: { id: ids.cargoMultiplo },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('expõe vínculos e aplica RBAC de afastamentos com prioridade do exercício', async () => {
    const seatA = await createPosition(ids.unidadeA);
    const temporaryB = await makeTemporaryPosition();
    const professional = await createProfessional();
    await assignments.placements.assign({
      postoTrabalhoId: seatA.id,
      profissionalId: professional.id,
    });
    await assignments.exercises.startTemporary({
      postoTrabalhoId: temporaryB.position.id,
      profissionalId: professional.id,
    });

    const admin = await authenticated(credentials.admin);
    const director = await authenticated(credentials.director);
    const secretary = await authenticated(credentials.secretary);
    const operator = await authenticated(credentials.operator);

    await admin.get(`/profissionais/${professional.id}/vinculos`).expect(200);
    await operator.get(`/profissionais/${professional.id}/afastamentos`).expect(200);
    await operator
      .post(`/profissionais/${professional.id}/afastamentos`)
      .send({ tipo: 'Sem permissão' })
      .expect(403);
    await secretary.get(`/profissionais/${professional.id}/vinculos`).expect(403);

    const created = await director
      .post(`/profissionais/${professional.id}/afastamentos`)
      .send({
        dataInicio: new Date(Date.now() - 60_000).toISOString(),
        tipo: 'Licença multiunidade',
      })
      .expect(201);
    await director
      .patch(`/profissionais/${professional.id}/afastamentos/${created.body.id}/encerrar`)
      .send({})
      .expect(200);
    const history = await director
      .get(`/profissionais/${professional.id}/afastamentos`)
      .expect(200);
    expect(history.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ ativo: false, id: created.body.id })]),
    );
  });
});
