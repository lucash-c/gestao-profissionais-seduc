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
    cargo: randomUUID(),
    period: randomUUID(),
    quadroA: randomUUID(),
    quadroB: randomUUID(),
    type: randomUUID(),
    unitA: randomUUID(),
    unitB: randomUUID(),
  };
  const password = 'Senha de integração 2026!';
  const credentials = {
    admin: `admin.${suffix}`,
    director: `director.${suffix}`,
    operator: `operator.${suffix}`,
    secretary: `secretary.${suffix}`,
  };

  beforeAll(async () => {
    await database.client.tipoUnidade.create({ data: { id: ids.type, nome: `Tipo ${suffix}` } });
    await database.client.unidade.createMany({
      data: [
        { id: ids.unitA, nome: `Unidade A ${suffix}`, tipoUnidadeId: ids.type },
        { id: ids.unitB, nome: `Unidade B ${suffix}`, tipoUnidadeId: ids.type },
      ],
    });
    await database.client.cargoFuncao.create({
      data: { ehProfessor: true, id: ids.cargo, nome: `Professor ${suffix}`, usaPontuacao: true },
    });
    await database.client.periodo.create({ data: { id: ids.period, nome: `Período ${suffix}` } });
    const senhaHash = await hashPassword(password);
    await database.client.usuario.createMany({
      data: [
        { login: credentials.admin, nome: 'Admin Integração', perfil: 'ADMINISTRADOR', senhaHash },
        { login: credentials.operator, nome: 'Operador Integração', perfil: 'OPERADOR', senhaHash },
        {
          login: credentials.director,
          nome: 'Diretor Integração',
          perfil: 'DIRETOR',
          senhaHash,
          unidadeId: ids.unitA,
        },
        {
          login: credentials.secretary,
          nome: 'Secretário Integração',
          perfil: 'SECRETARIO',
          senhaHash,
          unidadeId: ids.unitA,
        },
      ],
    });
  }, 30_000);

  afterAll(async () => {
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
      where: { quadroNecessidadeId: { in: [ids.quadroA, ids.quadroB] } },
    });
    await database.client.quadroNecessidade.deleteMany({
      where: { id: { in: [ids.quadroA, ids.quadroB] } },
    });
    await database.client.unidadeTelefone.deleteMany({
      where: { unidade: { nome: { contains: suffix } } },
    });
    await database.client.unidade.deleteMany({ where: { nome: { contains: suffix } } });
    await database.client.periodo.deleteMany({ where: { id: ids.period } });
    await database.client.cargoFuncao.deleteMany({ where: { id: ids.cargo } });
    await database.client.tipoUnidade.deleteMany({ where: { id: ids.type } });
    await database.disconnect();
  });

  async function authenticated(login: string) {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
    return agent;
  }

  function createProfessional(
    agent: ReturnType<typeof request.agent>,
    matricula: string,
    cpf: string,
  ) {
    return agent
      .post('/profissionais')
      .set('Origin', 'http://localhost:9000')
      .send({
        cargoFuncaoId: ids.cargo,
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

  async function placeProfessional(professionalId: string, unitId: string, quadroId: string) {
    await database.client.quadroNecessidade.create({
      data: {
        anoLetivo: 2027,
        cargoFuncaoId: ids.cargo,
        id: quadroId,
        periodoId: ids.period,
        quantidade: 1,
        unidadeId: unitId,
      },
    });
    const post = await database.client.postoTrabalho.create({
      data: {
        anoLetivo: 2027,
        cargoFuncaoId: ids.cargo,
        periodoId: ids.period,
        quadroNecessidadeId: quadroId,
        unidadeId: unitId,
      },
    });
    await database.client.lotacaoSede.create({
      data: { postoTrabalhoId: post.id, profissionalId: professionalId },
    });
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
    await admin.patch(`/unidades/${unitResponse.body.id}`).send({ ativo: false }).expect(200);

    const first = await createProfessional(admin, `M-A-${suffix}`, '123.456.789-01').expect(201);
    expect(first.body).toMatchObject({ cpf: '12345678901', permuta: false, remocao: false });
    expect(first.body.telefones).toHaveLength(2);
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
    await placeProfessional(local.body.id, ids.unitA, ids.quadroA);
    await placeProfessional(other.body.id, ids.unitB, ids.quadroB);

    for (const login of [credentials.director, credentials.secretary]) {
      const scoped = await authenticated(login);
      const list = await scoped.get('/profissionais').expect(200);
      expect(list.body.items.map((item: { id: string }) => item.id)).toContain(local.body.id);
      expect(list.body.items.map((item: { id: string }) => item.id)).not.toContain(other.body.id);
      await scoped.patch(`/profissionais/${local.body.id}`).send({ remocao: true }).expect(200);
      await scoped.patch(`/profissionais/${other.body.id}`).send({ remocao: true }).expect(403);
      await scoped.patch(`/unidades/${ids.unitA}`).send({ poloRegiao: 'Norte' }).expect(200);
      await scoped.patch(`/unidades/${ids.unitB}`).send({ poloRegiao: 'Sul' }).expect(403);
    }

    const operator = await authenticated(credentials.operator);
    await operator.get('/profissionais').expect(200);
    await operator.get('/unidades').expect(200);
    await operator.patch(`/profissionais/${local.body.id}`).send({ permuta: true }).expect(403);
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
          unidadeId: perfil === 'DIRETOR' || perfil === 'SECRETARIO' ? ids.unitA : null,
        })
        .expect(201);
      expect(response.text).not.toContain('senhaHash');
      created[perfil] = { id: response.body.id, login };
    }

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
