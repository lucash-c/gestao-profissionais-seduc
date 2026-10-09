import type { AuthenticatedUser, UserProfile } from '@seduc/contracts';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../src/http/error-handler.js';
import { createAssignmentRouter } from '../../src/modules/assignments/assignment.router.js';
import {
  type AssignmentServices,
  mapWorkPosition,
} from '../../src/modules/assignments/assignment.service.js';

const ID = '11111111-1111-4111-8111-111111111111';
const UNIT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_UNIT_ID = '33333333-3333-4333-8333-333333333333';
const POSITION_CODE = 'PEB1_FUNDAMENTAL';
const PERIOD_CODE = 'INTEGRAL';

function position(options: {
  active?: boolean;
  absence?: boolean;
  exerciseElsewhere?: boolean;
  holder?: boolean;
  occupant?: boolean;
  occupantAbsent?: boolean;
  reservedForEvent?: boolean;
}) {
  const professional = {
    ativo: true,
    afastamentos: options.absence ? [{ id: ID }] : [],
    exercicios: options.exerciseElsewhere ? [{ postoTrabalhoId: OTHER_UNIT_ID }] : [],
    id: ID,
    matricula: 'M-1',
    nomeCompleto: 'Titular',
  };
  const occupant = {
    afastamentos: options.occupantAbsent ? [{ id: OTHER_UNIT_ID }] : [],
    ativo: true,
    id: OTHER_UNIT_ID,
    matricula: 'M-2',
    nomeCompleto: 'Substituta',
  };
  return {
    anoLetivo: 2026,
    ativo: options.active ?? true,
    cargoFuncaoId: POSITION_CODE,
    codigo: 'PEB1-0000000001',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    exercicios: options.occupant
      ? [
          {
            criadoEm: new Date(),
            dataFim: null,
            dataInicio: new Date(),
            id: OTHER_UNIT_ID,
            observacoes: null,
            postoTrabalhoId: ID,
            profissional: occupant,
            profissionalId: OTHER_UNIT_ID,
            substituiProfissional: professional,
            substituiProfissionalId: ID,
            tipoExercicio: 'SEM_SEDE' as const,
          },
        ]
      : [],
    id: ID,
    lotacoesSede: options.holder
      ? [
          {
            criadoEm: new Date(),
            dataFim: null,
            dataInicio: new Date(),
            id: ID,
            motivoFim: null,
            postoTrabalhoId: ID,
            profissional: professional,
            profissionalId: ID,
          },
        ]
      : [],
    periodoId: PERIOD_CODE,
    quadroNecessidade: {
      anoLetivo: 2026,
      atualizadoEm: new Date(),
      cargoFuncao: { ativo: true, id: POSITION_CODE, nome: 'PEB1 - Fundamental' },
      cargoFuncaoId: POSITION_CODE,
      criadoEm: new Date(),
      id: ID,
      observacoes: null,
      periodo: { ativo: true, id: PERIOD_CODE, nome: 'Integral' },
      periodoId: PERIOD_CODE,
      quantidade: 1,
      segmentoEnsinoId: null,
      unidade: { ativo: true, id: UNIT_ID, nome: 'Unidade', tipoUnidadeId: ID },
      unidadeId: UNIT_ID,
    },
    quadroNecessidadeId: ID,
    reservadoParaEvento: options.reservedForEvent ?? false,
    unidadeId: UNIT_ID,
  } as never;
}

describe('motor de disponibilidade da Etapa 5', () => {
  it.each([
    [{}, 'DISPONIVEL_COM_SEDE'],
    [{ active: false }, 'INATIVO'],
    [{ holder: true }, 'INDISPONIVEL'],
    [{ absence: true, holder: true }, 'DISPONIVEL_SEM_SEDE'],
    [{ exerciseElsewhere: true, holder: true }, 'DISPONIVEL_SEM_SEDE'],
    [{ absence: true, holder: true, occupant: true }, 'INDISPONIVEL'],
    [{ absence: true, holder: true, occupant: true, occupantAbsent: true }, 'DISPONIVEL_SEM_SEDE'],
  ] as const)('calcula %j como %s', (options, expected) => {
    expect(mapWorkPosition(position(options))).toMatchObject({ disponibilidade: expected });
  });

  it('expõe titular, ocupante, substituído e motivos sem persistir disponibilidade', () => {
    expect(
      mapWorkPosition(position({ absence: true, holder: true, occupant: true })),
    ).toMatchObject({
      exercicioAtual: {
        profissional: { nomeCompleto: 'Substituta' },
        substituiProfissional: { nomeCompleto: 'Titular' },
        tipo: 'SEM_SEDE',
      },
      motivosLiberacao: ['AFASTAMENTO'],
      ocupanteAtual: { nomeCompleto: 'Substituta' },
      titularAtual: { nomeCompleto: 'Titular' },
    });
  });

  it('expõe a reserva de sede para evento sem alterar titular ou ocupante', () => {
    expect(
      mapWorkPosition(
        position({ absence: true, holder: true, occupant: true, reservedForEvent: true }),
      ),
    ).toMatchObject({
      ocupanteAtual: { nomeCompleto: 'Substituta' },
      reservadoParaEvento: true,
      titularAtual: { nomeCompleto: 'Titular' },
    });
  });
});

function services(): AssignmentServices {
  const absence = {
    ativo: true,
    dataFim: null,
    dataInicio: new Date().toISOString(),
    id: ID,
    observacoes: null,
    profissionalId: ID,
    tipo: 'Licença',
  };
  return {
    absences: {
      create: vi.fn().mockResolvedValue(absence),
      end: vi
        .fn()
        .mockResolvedValue({ ...absence, ativo: false, dataFim: new Date().toISOString() }),
      list: vi.fn().mockResolvedValue([absence]),
    },
    exercises: {
      end: vi.fn(),
      startTemporary: vi.fn(),
    },
    placements: { assign: vi.fn() },
    professionals: {
      administrativeUnitIds: vi.fn().mockResolvedValue([UNIT_ID]),
      relationships: vi.fn().mockResolvedValue({
        afastamentos: [absence],
        afastamentosAtivos: [absence],
        exerciciosAtuais: [],
        historicoExercicios: [],
        historicoSedes: [],
        profissionalId: ID,
        sedeAtual: null,
      }),
    },
  };
}

function appFor(profile: UserProfile, service: AssignmentServices, ownUnit = UNIT_ID) {
  const app = express();
  app.use(express.json());
  app.use((request_, _response, next) => {
    request_.authenticatedUser = {
      email: null,
      id: ID,
      login: profile.toLowerCase(),
      nome: profile,
      perfil: profile,
      unidades:
        profile === 'DIRETOR' || profile === 'SECRETARIO' ? [{ id: ownUnit, nome: 'Unidade' }] : [],
    } satisfies AuthenticatedUser;
    next();
  });
  app.use('/profissionais', createAssignmentRouter(service));
  app.use(errorHandler);
  return app;
}

describe('consultas e RBAC de afastamentos da Etapa 5', () => {
  it.each(['ADMINISTRADOR', 'DIRETOR', 'SECRETARIO'] as const)(
    'permite registrar e encerrar afastamento para %s autorizado',
    async (profile) => {
      const service = services();
      const app = appFor(profile, service);
      await request(app)
        .post(`/profissionais/${ID}/afastamentos`)
        .send({ tipo: 'Licença' })
        .expect(201);
      await request(app)
        .patch(`/profissionais/${ID}/afastamentos/${ID}/encerrar`)
        .send({})
        .expect(200);
      expect(service.absences.create).toHaveBeenCalled();
      expect(service.absences.end).toHaveBeenCalled();
    },
  );

  it('mantém Operador somente leitura e restringe perfis escolares à própria unidade', async () => {
    const operator = appFor('OPERADOR', services());
    await request(operator).get(`/profissionais/${ID}/vinculos`).expect(200);
    await request(operator).get(`/profissionais/${ID}/afastamentos?ativo=true`).expect(200);
    await request(operator)
      .post(`/profissionais/${ID}/afastamentos`)
      .send({ tipo: 'Licença' })
      .expect(403);

    for (const profile of ['DIRETOR', 'SECRETARIO'] as const) {
      await request(appFor(profile, services(), OTHER_UNIT_ID))
        .post(`/profissionais/${ID}/afastamentos`)
        .send({ tipo: 'Licença' })
        .expect(403);
    }
  });

  it('rejeita campos arbitrários e não expõe mutações públicas de sede ou exercício', async () => {
    const app = appFor('ADMINISTRADOR', services());
    await request(app)
      .post(`/profissionais/${ID}/afastamentos`)
      .send({ substituiProfissionalId: OTHER_UNIT_ID, tipo: 'Licença' })
      .expect(400);
    await request(app).post(`/profissionais/${ID}/lotacoes`).send({}).expect(404);
    await request(app).post(`/profissionais/${ID}/exercicios`).send({}).expect(404);
  });
});
