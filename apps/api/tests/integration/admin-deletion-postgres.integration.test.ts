import { createDatabaseConnection } from '@seduc/database';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import { createTestEnvironment } from '../helpers/environment.js';

const databaseTestUrl = process.env.DATABASE_TEST_URL;
const describeWithPostgres = databaseTestUrl ? describe : describe.skip;

describeWithPostgres('Etapa 11 exclusões administrativas protegidas', () => {
  if (!databaseTestUrl) return;
  const database = createDatabaseConnection(databaseTestUrl);
  const app = createApp({
    database,
    environment: createTestEnvironment({ DATABASE_URL: databaseTestUrl }),
  });
  const suffix = randomUUID();
  const ids = {
    admin: randomUUID(),
    cargo: randomUUID(),
    period: randomUUID(),
    type: randomUUID(),
    unit: randomUUID(),
  };
  const login = `delete-admin-${suffix}`;
  const password = 'Senha administrativa 2026!';
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    await database.client.tipoUnidade.create({ data: { id: ids.type, nome: `Delete ${suffix}` } });
    await database.client.unidade.create({
      data: { id: ids.unit, nome: `Delete unit ${suffix}`, tipoUnidadeId: ids.type },
    });
    await database.client.cargoFuncao.create({
      data: { id: ids.cargo, nome: `Delete cargo ${suffix}` },
    });
    await database.client.cargoTipoUnidade.create({
      data: { cargoFuncaoId: ids.cargo, tipoUnidadeId: ids.type },
    });
    await database.client.periodo.create({
      data: { id: ids.period, nome: `Delete period ${suffix}` },
    });
    await database.client.usuario.create({
      data: {
        id: ids.admin,
        login,
        nome: 'Admin exclusões',
        perfil: 'ADMINISTRADOR',
        senhaHash: await hashPassword(password),
      },
    });
    agent = request.agent(app);
    await agent.post('/auth/login').send({ identifier: login, password }).expect(200);
  });

  afterAll(async () => {
    await database.client.auditoria.deleteMany({ where: { usuarioId: ids.admin } });
    await database.client.movimentacaoItem.deleteMany({
      where: { movimentacao: { usuarioId: ids.admin } },
    });
    await database.client.movimentacao.deleteMany({ where: { usuarioId: ids.admin } });
    await database.client.eventoParticipante.deleteMany({
      where: { evento: { nome: { contains: suffix } } },
    });
    await database.client.evento.deleteMany({ where: { nome: { contains: suffix } } });
    await database.client.exercicioProfissional.deleteMany({
      where: { profissional: { matricula: { contains: suffix } } },
    });
    await database.client.lotacaoSede.deleteMany({
      where: { profissional: { matricula: { contains: suffix } } },
    });
    await database.client.afastamentoProfissional.deleteMany({
      where: { profissional: { matricula: { contains: suffix } } },
    });
    await database.client.profissionalTelefone.deleteMany({
      where: { profissional: { matricula: { contains: suffix } } },
    });
    await database.client.profissional.deleteMany({ where: { matricula: { contains: suffix } } });
    await database.client.postoTrabalho.deleteMany({ where: { unidadeId: ids.unit } });
    await database.client.quadroNecessidade.deleteMany({ where: { unidadeId: ids.unit } });
    await database.client.sessaoUsuario.deleteMany({ where: { usuarioId: ids.admin } });
    await database.client.usuario.deleteMany({
      where: { OR: [{ id: ids.admin }, { login: { contains: suffix } }] },
    });
    await database.client.periodo.delete({ where: { id: ids.period } });
    await database.client.cargoTipoUnidade.delete({
      where: { cargoFuncaoId_tipoUnidadeId: { cargoFuncaoId: ids.cargo, tipoUnidadeId: ids.type } },
    });
    await database.client.cargoFuncao.delete({ where: { id: ids.cargo } });
    await database.client.unidade.delete({ where: { id: ids.unit } });
    await database.client.tipoUnidade.delete({ where: { id: ids.type } });
    await database.disconnect();
  });

  function professional(sequence: number) {
    return database.client.profissional.create({
      data: {
        cargoFuncaoId: ids.cargo,
        cpf: '12345678901',
        dataEntradaPrefeitura: new Date('2020-01-01T00:00:00Z'),
        dataNascimento: new Date('1980-01-01T00:00:00Z'),
        matricula: `DELETE-${suffix}-${sequence}`,
        nomeCompleto: `Profissional ${sequence}`,
      },
    });
  }

  async function planWithPosition(year: number) {
    const plan = await database.client.quadroNecessidade.create({
      data: {
        anoLetivo: year,
        cargoFuncaoId: ids.cargo,
        periodoId: ids.period,
        quantidade: 1,
        unidadeId: ids.unit,
      },
    });
    const position = await database.client.postoTrabalho.create({
      data: {
        anoLetivo: year,
        cargoFuncaoId: ids.cargo,
        codigo: `TEST-${randomUUID()}`,
        periodoId: ids.period,
        quadroNecessidadeId: plan.id,
        unidadeId: ids.unit,
      },
    });
    return { plan, position };
  }

  it('exclui profissional sem histórico, mas bloqueia profissional e posto com lotação histórica', async () => {
    const disposable = await professional(1);
    const beforeAudit = await database.client.auditoria.count();
    const beforeMovements = await database.client.movimentacao.count();
    await agent
      .delete(`/profissionais/${disposable.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(204);
    expect(
      await database.client.profissional.findUnique({ where: { id: disposable.id } }),
    ).toBeNull();
    expect(await database.client.auditoria.count()).toBe(beforeAudit);
    expect(await database.client.movimentacao.count()).toBe(beforeMovements);

    const protectedProfessional = await professional(2);
    const { position } = await planWithPosition(2401);
    await database.client.lotacaoSede.create({
      data: { profissionalId: protectedProfessional.id, postoTrabalhoId: position.id },
    });
    await agent
      .delete(`/profissionais/${protectedProfessional.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
    await agent
      .delete(`/postos/${position.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
  });

  it('exclui quadro/posto sem histórico e protege quadro que possui posto', async () => {
    const empty = await database.client.quadroNecessidade.create({
      data: {
        anoLetivo: 2402,
        cargoFuncaoId: ids.cargo,
        periodoId: ids.period,
        quantidade: 0,
        unidadeId: ids.unit,
      },
    });
    await agent
      .delete(`/quadros/${empty.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(204);
    const generated = await planWithPosition(2403);
    await agent
      .delete(`/quadros/${generated.plan.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
    await agent
      .delete(`/postos/${generated.position.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(204);
    expect(
      (
        await database.client.quadroNecessidade.findUniqueOrThrow({
          where: { id: generated.plan.id },
        })
      ).quantidade,
    ).toBe(0);
  });

  it('exclui somente evento RASCUNHO sem dependências', async () => {
    const draft = await database.client.evento.create({
      data: { ano: 2026, cargoFuncaoId: ids.cargo, nome: `Draft ${suffix}`, tipo: 'REMOCAO' },
    });
    await agent
      .delete(`/eventos/${draft.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(204);
    const ended = await database.client.evento.create({
      data: {
        ano: 2026,
        cargoFuncaoId: ids.cargo,
        nome: `Ended ${suffix}`,
        status: 'ENCERRADO',
        tipo: 'LISTAO',
      },
    });
    await agent
      .delete(`/eventos/${ended.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
    const participant = await professional(3);
    const prepared = await database.client.evento.create({
      data: { ano: 2026, cargoFuncaoId: ids.cargo, nome: `Prepared ${suffix}`, tipo: 'REMOCAO' },
    });
    await database.client.eventoParticipante.create({
      data: { eventoId: prepared.id, profissionalId: participant.id },
    });
    await agent
      .delete(`/eventos/${prepared.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
  });

  it('exclui usuário descartável, revoga sessões e bloqueia a própria conta', async () => {
    const user = await database.client.usuario.create({
      data: {
        login: `delete-user-${suffix}`,
        nome: 'Descartável',
        perfil: 'OPERADOR',
        senhaHash: await hashPassword(password),
      },
    });
    await agent
      .delete(`/usuarios/${user.id}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(204);
    expect(await database.client.usuario.findUnique({ where: { id: user.id } })).toBeNull();
    await agent
      .delete(`/usuarios/${ids.admin}`)
      .set('Origin', 'http://localhost:9000')
      .send({ senhaAtual: password })
      .expect(409);
  });
});
