import type { AuthenticatedUser, UserProfile } from '@seduc/contracts';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../src/http/error-handler.js';
import {
  createStaffingPlanRouter,
  createWorkPositionRouter,
} from '../../src/modules/staffing/staffing.routers.js';
import {
  staffingPlanCreateSchema,
  staffingPlanUpdateSchema,
} from '../../src/modules/staffing/staffing.schemas.js';
import type { StaffingServices } from '../../src/modules/staffing/staffing.service.js';

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const plan = {
  anoLetivo: 2026,
  cargoFuncao: { ativo: true, id: ID, nome: 'Professor' },
  cargoFuncaoId: ID,
  id: ID,
  observacoes: null,
  periodo: { ativo: true, id: ID, nome: 'Integral' },
  periodoId: ID,
  quantidade: 5,
  quantidadePostosAtivos: 5,
  segmentoEnsino: null,
  segmentoEnsinoId: null,
  unidade: { ativo: true, id: ID, nome: 'Unidade' },
  unidadeId: ID,
} as const;
const position = {
  anoLetivo: 2026,
  ativo: true,
  cargoFuncao: plan.cargoFuncao,
  cargoFuncaoId: ID,
  codigo: null,
  disponibilidade: 'DISPONIVEL_COM_SEDE' as const,
  estadoEstrutural: 'DISPONIVEL_COM_SEDE' as const,
  exercicioAtual: null,
  id: ID,
  motivosLiberacao: [],
  ocupanteAtual: null,
  periodo: plan.periodo,
  periodoId: ID,
  quadroNecessidadeId: ID,
  titularAtual: null,
  unidade: plan.unidade,
  unidadeId: ID,
};

function services(): StaffingServices {
  return {
    staffingPlans: {
      create: vi.fn().mockResolvedValue(plan),
      get: vi.fn().mockResolvedValue(plan),
      list: vi
        .fn()
        .mockResolvedValue({ items: [plan], page: 1, pageSize: 20, total: 1, totalPages: 1 }),
      update: vi.fn().mockResolvedValue(plan),
    },
    workPositions: {
      get: vi.fn().mockResolvedValue(position),
      list: vi
        .fn()
        .mockResolvedValue({ items: [position], page: 1, pageSize: 20, total: 1, totalPages: 1 }),
      updateStatus: vi.fn().mockResolvedValue(position),
    },
  };
}

function appFor(profile: UserProfile, staffing: StaffingServices) {
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
        profile === 'DIRETOR' || profile === 'SECRETARIO' ? [{ id: ID, nome: 'Unidade' }] : [],
    } satisfies AuthenticatedUser;
    next();
  });
  app.use('/quadros', createStaffingPlanRouter(staffing.staffingPlans));
  app.use('/postos', createWorkPositionRouter(staffing.workPositions));
  app.use(errorHandler);
  return app;
}

describe('Etapa 4 staffing API and RBAC', () => {
  it('permite gestão ao Administrador e leitura ao Operador', async () => {
    const adminServices = services();
    const admin = appFor('ADMINISTRADOR', adminServices);
    await request(admin).get('/quadros').expect(200);
    await request(admin)
      .post('/quadros')
      .send({
        anoLetivo: 2026,
        cargoFuncaoId: ID,
        periodoId: ID,
        quantidade: 5,
        segmentoEnsinoId: null,
        unidadeId: ID,
      })
      .expect(201);
    await request(admin).patch(`/quadros/${ID}`).send({ quantidade: 8 }).expect(200);
    await request(admin).patch(`/postos/${ID}/status`).send({ ativo: false }).expect(200);
    expect(adminServices.staffingPlans.create).toHaveBeenCalled();

    const operatorServices = services();
    const operator = appFor('OPERADOR', operatorServices);
    await request(operator).get('/quadros').expect(200);
    await request(operator).get('/postos').expect(200);
    await request(operator).post('/quadros').send({}).expect(403);
    await request(operator).patch(`/quadros/${ID}`).send({ quantidade: 2 }).expect(403);
    await request(operator).patch(`/postos/${ID}/status`).send({ ativo: false }).expect(403);
  });

  it.each(['DIRETOR', 'SECRETARIO'] as const)(
    '%s não consulta nem administra quadro/postos',
    async (profile) => {
      const app = appFor(profile, services());
      await request(app).get('/quadros').expect(403);
      await request(app).get('/postos').expect(403);
      await request(app).post('/quadros').send({}).expect(403);
      await request(app).patch(`/postos/${ID}/status`).send({ ativo: false }).expect(403);
    },
  );

  it('valida entrada e aceita somente campos estruturais conhecidos', () => {
    expect(
      staffingPlanCreateSchema.parse({
        anoLetivo: 2026,
        cargoFuncaoId: ID,
        periodoId: ID,
        quantidade: 5,
        segmentoEnsinoId: null,
        unidadeId: ID,
      }),
    ).toMatchObject({ quantidade: 5, observacoes: null });
    expect(
      staffingPlanCreateSchema.parse({
        anoLetivo: 2026,
        cargoFuncaoId: ID,
        periodoId: ID,
        quantidade: 0,
        segmentoEnsinoId: null,
        unidadeId: ID,
      }),
    ).toMatchObject({ quantidade: 0 });
    expect(() =>
      staffingPlanCreateSchema.parse({
        anoLetivo: 2026,
        cargoFuncaoId: ID,
        periodoId: ID,
        quantidade: -1,
        segmentoEnsinoId: null,
        unidadeId: ID,
      }),
    ).toThrow();
    expect(() => staffingPlanUpdateSchema.parse({ quantidade: -1 })).toThrow();
    expect(() => staffingPlanUpdateSchema.parse({})).toThrow();
    expect(() => staffingPlanUpdateSchema.parse({ unidadeId: OTHER_ID, vaga: true })).toThrow();
  });
});
