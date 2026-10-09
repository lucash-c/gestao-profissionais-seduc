import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 3 registries on PostgreSQL', () => {
  if (!databaseTestUrl) return;

  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const ids = {
    cargo: 'PEB1_FUNDAMENTAL',
    directorCargo: 'DIRETOR',
    period: 'MANHA',
    quadroA: randomUUID(),
    quadroB: randomUUID(),
    type: 'EMEF',
    unitA: randomUUID(),
    unitB: randomUUID(),
    unitC: randomUUID(),
  };
  const password = 'Senha de integração 2026!';
  const credentials = {
    admin: `admin.${suffix}`,
    director: `director.${suffix}`,
    directorB: `director-b.${suffix}`,
    directorC: `director-c.${suffix}`,
    operator: `operator.${suffix}`,
    secretary: `secretary.${suffix}`,
    secretaryB: `secretary-b.${suffix}`,
  };

  beforeAll(async () => {
    await database.client.unidade.createMany({
      data: [
        { id: ids.unitA, nome: `Unidade A ${suffix}`, tipoUnidadeId: ids.type },
        { id: ids.unitB, nome: `Unidade B ${suffix}`, tipoUnidadeId: ids.type },
        { id: ids.unitC, nome: `Unidade C ${suffix}`, tipoUnidadeId: ids.type },
      ],
    });
    const senhaHash = await hashPassword(password);
    await database.client.$transaction(async (transaction) => {
      await transaction.usuario.createMany({
        data: [
          {
            login: credentials.admin,
            nome: 'Admin Integração',
            perfil: 'ADMINISTRADOR',
            senhaHash,
          },
          {
            login: credentials.operator,
            nome: 'Operador Integração',
            perfil: 'OPERADOR',
            senhaHash,
          },
        ],
      });
      for (const account of [
        {
          login: credentials.director,
          nome: 'Diretor Integração',
          perfil: 'DIRETOR' as const,
          unidadeId: ids.unitA,
        },
        {
          login: credentials.secretary,
          nome: 'Secretário Integração',
          perfil: 'SECRETARIO' as const,
          unidadeId: ids.unitA,
        },
        {
          login: credentials.directorB,
          nome: 'Diretor B Integração',
          perfil: 'DIRETOR' as const,
          unidadeId: ids.unitB,
        },
        {
          login: credentials.secretaryB,
          nome: 'Secretário B Integração',
          perfil: 'SECRETARIO' as const,
          unidadeId: ids.unitB,
        },
        {
          login: credentials.directorC,
          nome: 'Diretor C Integração',
          perfil: 'DIRETOR' as const,
          unidadeId: ids.unitC,
        },
      ]) {
        await transaction.usuario.create({
          data: {
            login: account.login,
            nome: account.nome,
            perfil: account.perfil,
            senhaHash,
            unidades: { create: [{ unidadeId: account.unidadeId }] },
          },
        });
      }
    });
  }, 30_000);

  afterAll(async () => {
    await database.client.auditoria.deleteMany({
      where: { usuario: { login: { contains: suffix } } },
    });
    await database.client.sessaoUsuario.deleteMany({
      where: { usuario: { login: { contains: suffix } } },
    });
    await database.client.usuario.deleteMany({ where: { login: { contains: suffix } } });
    await database.client.exercicioProfissional.deleteMany({
      where: { profissional: { matricula: { contains: suffix } } },
    });
    await database.client.lotacaoSede.deleteMany({
      where: { profissional: { matricula: { contains: suffix } } },
    });
    await database.client.profissionalTelefone.deleteMany({
      where: { profissional: { matricula: { contains: suffix } } },
    });
    await database.client.profissional.deleteMany({ where: { matricula: { contains: suffix } } });
    await database.client.postoTrabalho.deleteMany({
      where: { unidadeId: { in: [ids.unitA, ids.unitB, ids.unitC] } },
    });
    await database.client.quadroNecessidade.deleteMany({
      where: { unidadeId: { in: [ids.unitA, ids.unitB, ids.unitC] } },
    });
    await database.client.unidadeTelefone.deleteMany({
      where: { unidade: { nome: { contains: suffix } } },
    });
    await database.client.unidade.deleteMany({ where: { nome: { contains: suffix } } });
    await database.disconnect();
  });

  async function authenticated(login: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
    return agent;
  }

  it('expõe tipos, cargos e períodos fixos a partir do código compartilhado', async () => {
    const admin = await authenticated(credentials.admin);
    const [unitTypes, positions, periods] = await Promise.all([
      admin.get('/dominios/tipos-unidade').expect(200),
      admin.get('/dominios/cargos').expect(200),
      admin.get('/dominios/periodos').expect(200),
    ]);
    expect(unitTypes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'CMEA', nome: 'CMEA' }),
        expect.objectContaining({ id: 'CENTRO_DE_INCLUSAO', nome: 'CENTRO DE INCLUSÃO' }),
      ]),
    );
    expect(positions.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'PEB1_FUNDAMENTAL', nome: 'PEB1 - Fundamental' }),
        expect.objectContaining({ id: 'DIRETOR', nome: 'Diretor(a)' }),
      ]),
    );
    expect(periods.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'INTEGRAL', nome: 'Integral' }),
        expect.objectContaining({ id: 'MANHA', nome: 'Manhã' }),
        expect.objectContaining({ id: 'TARDE', nome: 'Tarde' }),
        expect.objectContaining({ id: 'NOITE', nome: 'Noite' }),
      ]),
    );
  });

  function createProfessional(
    agent: ReturnType<typeof request.agent>,
    matricula: string,
    cpf: string,
    cargoFuncaoId = ids.cargo,
  ) {
    return agent
      .post('/profissionais')
      .set('Origin', 'http://localhost:9000')
      .send({
        cargoFuncaoId,
        cpf,
        dataEntradaPrefeitura: '2020-02-03',
        dataNascimento: '1980-04-05',
        matricula,
        nomeCompleto: `Profissional ${matricula}`,
        telefones: [
          { numero: '(19) 99999-0001', tipo: 'CELULAR' },
          { numero: '(19) 3400-0002', tipo: 'FIXO' },
        ],
      });
  }

  async function createPost(
    unitId: string,
    quadroId: string,
    year: number,
    cargoFuncaoId = ids.cargo,
  ) {
    await database.client.quadroNecessidade.create({
      data: {
        anoLetivo: year,
        cargoFuncaoId,
        id: quadroId,
        periodoId: ids.period,
        quantidade: 1,
        unidadeId: unitId,
      },
    });
    const post = await database.client.postoTrabalho.create({
      data: {
        anoLetivo: year,
        cargoFuncaoId,
        codigo: `TEST-${randomUUID()}`,
        periodoId: ids.period,
        quadroNecessidadeId: quadroId,
        unidadeId: unitId,
      },
    });
    return post;
  }

  async function placeProfessional(
    professionalId: string,
    unitId: string,
    quadroId: string,
    year: number,
    cargoFuncaoId = ids.cargo,
  ) {
    const post = await createPost(unitId, quadroId, year, cargoFuncaoId);
    await database.client.lotacaoSede.create({
      data: { postoTrabalhoId: post.id, profissionalId: professionalId },
    });
    return post;
  }

  async function exerciseProfessional(
    professionalId: string,
    unitId: string,
    quadroId: string,
    year: number,
    cargoFuncaoId = ids.cargo,
  ) {
    const post = await createPost(unitId, quadroId, year, cargoFuncaoId);
    await database.client.exercicioProfissional.create({
      data: { postoTrabalhoId: post.id, profissionalId: professionalId, tipoExercicio: 'SEDE' },
    });
    return post;
  }

  it('persiste unidades, profissionais normalizados, defaults e constraints reais', async () => {
    const admin = await authenticated(credentials.admin);
    const unitResponse = await admin
      .post('/unidades')
      .set('Origin', 'http://localhost:9000')
      .send({
        nome: `Unidade API ${suffix}`,
        telefones: [{ numero: '(19) 3400-1000', tipo: 'FIXO' }],
        tipoUnidadeId: ids.type,
      })
      .expect(201);
    expect(unitResponse.body).toMatchObject({ codigoInep: null, poloRegiao: null });
    expect(unitResponse.body.telefones[0].numero).toBe('1934001000');
    const originalUnitName = unitResponse.body.nome;
    await admin
      .patch(`/unidades/${unitResponse.body.id}`)
      .send({
        nome: `Não deve persistir ${suffix}`,
        telefones: [{ id: randomUUID(), numero: '1934002000', tipo: 'FIXO' }],
      })
      .expect(404);
    const unitAfterRollback = await database.client.unidade.findUniqueOrThrow({
      include: { telefones: true },
      where: { id: unitResponse.body.id },
    });
    expect(unitAfterRollback.nome).toBe(originalUnitName);
    expect(unitAfterRollback.telefones).toHaveLength(1);
    const synchronizedUnit = await admin
      .patch(`/unidades/${unitResponse.body.id}`)
      .send({
        telefones: [
          {
            id: unitResponse.body.telefones[0].id,
            numero: unitResponse.body.telefones[0].numero,
            tipo: unitResponse.body.telefones[0].tipo,
          },
          { numero: '1934003000', tipo: 'RECADO' },
        ],
      })
      .expect(200);
    expect(synchronizedUnit.body.telefones).toHaveLength(2);
    await admin.patch(`/unidades/${unitResponse.body.id}`).send({ ativo: false }).expect(200);

    const first = await createProfessional(admin, `M-A-${suffix}`, '123.456.789-01').expect(201);
    expect(first.body).toMatchObject({ cpf: '12345678901', permuta: false, remocao: false });
    expect(first.body.telefones).toHaveLength(2);
    const originalProfessionalName = first.body.nomeCompleto;
    await admin
      .patch(`/profissionais/${first.body.id}`)
      .send({
        nomeCompleto: `Não deve persistir ${suffix}`,
        telefones: [{ id: randomUUID(), numero: '1999990000', tipo: 'CELULAR' }],
      })
      .expect(404);
    const professionalAfterRollback = await database.client.profissional.findUniqueOrThrow({
      include: { telefones: true },
      where: { id: first.body.id },
    });
    expect(professionalAfterRollback.nomeCompleto).toBe(originalProfessionalName);
    expect(professionalAfterRollback.telefones).toHaveLength(2);
    const synchronizedProfessional = await admin
      .patch(`/profissionais/${first.body.id}`)
      .send({
        telefones: [
          {
            id: first.body.telefones[0].id,
            numero: '19988887777',
            tipo: 'PESSOAL',
          },
          { numero: '1934004000', tipo: 'RECADO' },
        ],
      })
      .expect(200);
    expect(synchronizedProfessional.body.telefones).toHaveLength(2);
    expect(synchronizedProfessional.body.telefones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ numero: '19988887777', tipo: 'PESSOAL' }),
        expect.objectContaining({ numero: '1934004000', tipo: 'RECADO' }),
      ]),
    );
    expect(
      synchronizedProfessional.body.telefones.some(
        (phone: { id: string }) => phone.id === first.body.telefones[1].id,
      ),
    ).toBe(false);
    await createProfessional(admin, `M-B-${suffix}`, '12345678901').expect(201);
    await createProfessional(admin, `M-A-${suffix}`, '99999999999').expect(409);

    const flags = await admin
      .patch(`/profissionais/${first.body.id}`)
      .send({ permuta: true, remocao: true })
      .expect(200);
    expect(flags.body).toMatchObject({ permuta: true, remocao: true, pontuacao: '0' });
    await admin.patch(`/profissionais/${first.body.id}`).send({ pontuacao: 20 }).expect(400);
    await admin
      .patch(`/profissionais/${first.body.id}/pontuacao`)
      .send({ pontuacao: 20.5 })
      .expect(200);
  }, 30_000);

  it('aplica escopo de unidade para Diretor/Secretário e leitura estrita do Operador', async () => {
    const admin = await authenticated(credentials.admin);
    const local = await createProfessional(admin, `M-LOCAL-${suffix}`, '11111111111').expect(201);
    const other = await createProfessional(admin, `M-OTHER-${suffix}`, '22222222222').expect(201);
    const exerciseOnly = await createProfessional(
      admin,
      `M-EXERCISE-${suffix}`,
      '33333333333',
    ).expect(201);
    const unassigned = await createProfessional(
      admin,
      `M-UNASSIGNED-${suffix}`,
      '44444444444',
    ).expect(201);
    const priority = await createProfessional(
      admin,
      `M-PRIORITY-${suffix}`,
      '55555555555',
      ids.directorCargo,
    ).expect(201);
    await placeProfessional(local.body.id, ids.unitA, ids.quadroA, 2027);
    await placeProfessional(other.body.id, ids.unitB, ids.quadroB, 2027);
    await exerciseProfessional(exerciseOnly.body.id, ids.unitA, randomUUID(), 2028);
    await placeProfessional(priority.body.id, ids.unitA, randomUUID(), 2029, ids.directorCargo);
    const priorityExerciseB = await exerciseProfessional(
      priority.body.id,
      ids.unitB,
      randomUUID(),
      2030,
      ids.directorCargo,
    );
    const priorityExerciseC = await exerciseProfessional(
      priority.body.id,
      ids.unitC,
      randomUUID(),
      2031,
      ids.directorCargo,
    );

    const priorityRecord = await admin.get(`/profissionais/${priority.body.id}`).expect(200);
    expect(priorityRecord.body.exerciciosAtuais).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unidadeId: ids.unitB }),
        expect.objectContaining({ unidadeId: ids.unitC }),
      ]),
    );
    expect(priorityRecord.body.exerciciosAtuais).toHaveLength(2);
    const structuralCargoChange = await admin
      .patch(`/profissionais/${priority.body.id}`)
      .send({ cargoFuncaoId: ids.cargo })
      .expect(409);
    expect(structuralCargoChange.body).toMatchObject({ error: 'BUSINESS_RULE_CONFLICT' });

    const globalList = await admin.get('/profissionais').query({ pageSize: 100 }).expect(200);
    expect(globalList.body.items.map((item: { id: string }) => item.id)).toContain(
      unassigned.body.id,
    );
    await admin.get(`/profissionais/${unassigned.body.id}`).expect(200);
    const globalUnits = await admin.get('/unidades').query({ pageSize: 100 }).expect(200);
    expect(globalUnits.body.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([ids.unitA, ids.unitB, ids.unitC]),
    );

    for (const login of [credentials.director, credentials.secretary]) {
      const scoped = await authenticated(login);
      const list = await scoped.get('/profissionais').query({ pageSize: 100 }).expect(200);
      expect(list.body.items.map((item: { id: string }) => item.id)).toContain(local.body.id);
      expect(list.body.items.map((item: { id: string }) => item.id)).toContain(
        exerciseOnly.body.id,
      );
      expect(list.body.items.map((item: { id: string }) => item.id)).not.toContain(
        priority.body.id,
      );
      expect(list.body.items.map((item: { id: string }) => item.id)).not.toContain(other.body.id);
      expect(list.body.items.map((item: { id: string }) => item.id)).not.toContain(
        unassigned.body.id,
      );
      await scoped.patch(`/profissionais/${local.body.id}`).send({ remocao: true }).expect(200);
      await scoped
        .patch(`/profissionais/${exerciseOnly.body.id}`)
        .send({ permuta: true })
        .expect(200);
      await scoped.patch(`/profissionais/${other.body.id}`).send({ remocao: true }).expect(403);
      await scoped
        .patch(`/profissionais/${unassigned.body.id}`)
        .send({ remocao: true })
        .expect(403);
      await scoped.patch(`/profissionais/${priority.body.id}`).send({ remocao: true }).expect(403);
      await scoped.patch(`/unidades/${ids.unitA}`).send({ poloRegiao: 'Norte' }).expect(200);
      await scoped.patch(`/unidades/${ids.unitB}`).send({ poloRegiao: 'Sul' }).expect(403);
    }

    for (const login of [credentials.directorB, credentials.secretaryB]) {
      const scoped = await authenticated(login);
      const listB = await scoped.get('/profissionais').query({ pageSize: 100 }).expect(200);
      expect(listB.body.items.map((item: { id: string }) => item.id)).toContain(other.body.id);
      expect(listB.body.items.map((item: { id: string }) => item.id)).toContain(priority.body.id);
      expect(listB.body.items.map((item: { id: string }) => item.id)).not.toContain(local.body.id);
      expect(listB.body.items.map((item: { id: string }) => item.id)).not.toContain(
        exerciseOnly.body.id,
      );
      await scoped.patch(`/profissionais/${priority.body.id}`).send({ permuta: true }).expect(200);
    }

    const directorCBeforeClose = await authenticated(credentials.directorC);
    const listCBeforeClose = await directorCBeforeClose
      .get('/profissionais')
      .query({ pageSize: 100 })
      .expect(200);
    expect(listCBeforeClose.body.items.map((item: { id: string }) => item.id)).toContain(
      priority.body.id,
    );

    await admin
      .patch(`/profissionais/${unassigned.body.id}`)
      .send({ observacoes: 'Sem vínculo, administrado globalmente' })
      .expect(200);

    await database.client.exercicioProfissional.updateMany({
      data: { dataFim: new Date() },
      where: { dataFim: null, postoTrabalhoId: priorityExerciseB.id },
    });
    const directorBAfterFirstClose = await authenticated(credentials.directorB);
    const listBAfterFirstClose = await directorBAfterFirstClose
      .get('/profissionais')
      .query({ pageSize: 100 })
      .expect(200);
    expect(listBAfterFirstClose.body.items.map((item: { id: string }) => item.id)).not.toContain(
      priority.body.id,
    );
    const listCAfterFirstClose = await directorCBeforeClose
      .get('/profissionais')
      .query({ pageSize: 100 })
      .expect(200);
    expect(listCAfterFirstClose.body.items.map((item: { id: string }) => item.id)).toContain(
      priority.body.id,
    );
    const directorAWhileCActive = await authenticated(credentials.director);
    const listAWhileCActive = await directorAWhileCActive
      .get('/profissionais')
      .query({ pageSize: 100 })
      .expect(200);
    expect(listAWhileCActive.body.items.map((item: { id: string }) => item.id)).not.toContain(
      priority.body.id,
    );

    await database.client.exercicioProfissional.updateMany({
      data: { dataFim: new Date() },
      where: { dataFim: null, postoTrabalhoId: priorityExerciseC.id },
    });
    for (const login of [credentials.director, credentials.secretary]) {
      const scoped = await authenticated(login);
      const fallbackList = await scoped.get('/profissionais').query({ pageSize: 100 }).expect(200);
      expect(fallbackList.body.items.map((item: { id: string }) => item.id)).toContain(
        priority.body.id,
      );
      await scoped.patch(`/profissionais/${priority.body.id}`).send({ remocao: false }).expect(200);
    }
    const directorBAfterClose = await authenticated(credentials.directorB);
    const listBAfterClose = await directorBAfterClose
      .get('/profissionais')
      .query({ pageSize: 100 })
      .expect(200);
    expect(listBAfterClose.body.items.map((item: { id: string }) => item.id)).not.toContain(
      priority.body.id,
    );

    await exerciseProfessional(priority.body.id, ids.unitC, randomUUID(), 2032, ids.directorCargo);
    const directorC = await authenticated(credentials.directorC);
    const listC = await directorC.get('/profissionais').query({ pageSize: 100 }).expect(200);
    expect(listC.body.items.map((item: { id: string }) => item.id)).toContain(priority.body.id);
    await directorC
      .patch(`/profissionais/${priority.body.id}`)
      .send({ permuta: false })
      .expect(200);
    const directorAAfterC = await authenticated(credentials.director);
    const listAAfterC = await directorAAfterC
      .get('/profissionais')
      .query({ pageSize: 100 })
      .expect(200);
    expect(listAAfterC.body.items.map((item: { id: string }) => item.id)).not.toContain(
      priority.body.id,
    );
    await directorAAfterC
      .patch(`/profissionais/${priority.body.id}`)
      .send({ remocao: true })
      .expect(403);

    const operator = await authenticated(credentials.operator);
    const operatorProfessionals = await operator
      .get('/profissionais')
      .query({ pageSize: 100 })
      .expect(200);
    expect(operatorProfessionals.body.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([local.body.id, other.body.id, unassigned.body.id]),
    );
    const operatorUnits = await operator.get('/unidades').query({ pageSize: 100 }).expect(200);
    expect(operatorUnits.body.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([ids.unitA, ids.unitB, ids.unitC]),
    );
    await operator.patch(`/profissionais/${local.body.id}`).send({ permuta: true }).expect(403);
    await operator
      .patch(`/profissionais/${exerciseOnly.body.id}`)
      .send({ permuta: false })
      .expect(403);
  }, 30_000);

  it('gerencia usuários em namespace único e revoga sessões ao redefinir senha', async () => {
    const admin = await authenticated(credentials.admin);
    const profiles = ['ADMINISTRADOR', 'OPERADOR', 'DIRETOR', 'SECRETARIO'] as const;
    const created: Record<string, { id: string; login: string }> = {};
    for (const perfil of profiles) {
      const login = `managed.${perfil}.${suffix}`;
      const response = await admin
        .post('/usuarios')
        .send({
          email: `${perfil.toLowerCase()}.${suffix}@example.test`,
          login,
          nome: `Conta ${perfil}`,
          perfil,
          senha: password,
          unidadeIds: perfil === 'DIRETOR' || perfil === 'SECRETARIO' ? [ids.unitA] : [],
        })
        .expect(201);
      expect(response.text).not.toContain('senhaHash');
      created[perfil] = { id: response.body.id, login };
    }

    const managedDirector = created.DIRETOR!;
    const linkedDirector = await admin
      .patch(`/usuarios/${managedDirector.id}`)
      .send({ unidadeIds: [ids.unitA, ids.unitB] })
      .expect(200);
    expect(linkedDirector.body.unidadeIds).toEqual(expect.arrayContaining([ids.unitA, ids.unitB]));
    expect(linkedDirector.body.unidades).toHaveLength(2);

    const directorSession = await authenticated(managedDirector.login);
    const initialMe = await directorSession.get('/auth/me').expect(200);
    expect(initialMe.body.user.unidades.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([ids.unitA, ids.unitB]),
    );
    await directorSession.patch(`/unidades/${ids.unitA}`).send({ poloRegiao: 'A' }).expect(200);
    await directorSession.patch(`/unidades/${ids.unitB}`).send({ poloRegiao: 'B' }).expect(200);
    await directorSession.patch(`/unidades/${ids.unitC}`).send({ poloRegiao: 'C' }).expect(403);

    await admin
      .patch(`/usuarios/${managedDirector.id}`)
      .send({ unidadeIds: [ids.unitB, ids.unitC] })
      .expect(200);
    const refreshedMe = await directorSession.get('/auth/me').expect(200);
    expect(refreshedMe.body.user.unidades.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([ids.unitB, ids.unitC]),
    );
    expect(refreshedMe.body.user.unidades.map((item: { id: string }) => item.id)).not.toContain(
      ids.unitA,
    );
    await directorSession.patch(`/unidades/${ids.unitA}`).send({ poloRegiao: 'A2' }).expect(403);
    await directorSession.patch(`/unidades/${ids.unitB}`).send({ poloRegiao: 'B2' }).expect(200);
    await directorSession.patch(`/unidades/${ids.unitC}`).send({ poloRegiao: 'C2' }).expect(200);

    const managedSecretary = created.SECRETARIO!;
    await admin.patch(`/usuarios/${managedSecretary.id}`).send({ unidadeIds: [] }).expect(400);
    await admin
      .patch(`/usuarios/${managedSecretary.id}`)
      .send({ unidadeIds: [ids.unitA, ids.unitB] })
      .expect(400);
    await admin
      .patch(`/usuarios/${managedSecretary.id}`)
      .send({ unidadeIds: [ids.unitB] })
      .expect(200);

    await admin
      .post('/usuarios')
      .send({
        login: `sem-unidade.${suffix}`,
        nome: 'Diretor sem unidade',
        perfil: 'DIRETOR',
        senha: password,
      })
      .expect(400);
    await admin
      .post('/usuarios')
      .send({
        login: `secretario-duplo.${suffix}`,
        nome: 'Secretário com duas unidades',
        perfil: 'SECRETARIO',
        senha: password,
        unidadeIds: [ids.unitA, ids.unitB],
      })
      .expect(400);
    await admin
      .post('/usuarios')
      .send({
        login: `sem-unidade-2.${suffix}`,
        nome: 'Secretário sem unidade',
        perfil: 'SECRETARIO',
        senha: password,
      })
      .expect(400);
    await admin
      .post('/usuarios')
      .send({
        login: `${profiles[0].toLowerCase()}.${suffix}@example.test`,
        nome: 'Conflito cruzado',
        perfil: 'OPERADOR',
        senha: password,
      })
      .expect(409);

    const managedOperator = created.OPERADOR!;
    const operatorSession = await authenticated(managedOperator.login);
    await operatorSession.get('/auth/me').expect(200);
    await admin
      .patch(`/usuarios/${managedOperator.id}/senha`)
      .send({ senha: 'Outra senha administrativa 2026!' })
      .expect(204);
    await operatorSession.get('/auth/me').expect(401);
    await admin.patch(`/usuarios/${managedOperator.id}`).send({ ativo: false }).expect(200);
  }, 45_000);
});
