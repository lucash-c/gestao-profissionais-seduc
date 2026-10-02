import type { DatabaseConnection } from '@seduc/database';
import type {
  AuthenticatedUser,
  ProfessionalRecord,
  UnitRecord,
  UserProfile,
  UserRecord,
} from '@seduc/contracts';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { createRequireAllowedOrigin } from '../../src/http/origin-protection.js';
import { hashPassword } from '../../src/modules/auth/auth.crypto.js';
import type {
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
} from '../../src/modules/auth/auth.types.js';
import {
  professionalCreateSchema,
  professionalUpdateSchema,
  userCreateSchema,
} from '../../src/modules/registries/registry.schemas.js';
import {
  createPrismaRegistryServices,
  type RegistryServices,
} from '../../src/modules/registries/registry.service.js';
import { createTestEnvironment } from '../helpers/environment.js';

const UNIT_A = '11111111-1111-4111-8111-111111111111';
const UNIT_B = '22222222-2222-4222-8222-222222222222';
const RECORD_ID = '33333333-3333-4333-8333-333333333333';
const PHONE_ID = '44444444-4444-4444-8444-444444444444';
const CARGO_ID = '55555555-5555-4555-8555-555555555555';
const TYPE_ID = '66666666-6666-4666-8666-666666666666';
const PASSWORD = 'Senha administrativa 2026!';

class AuthMemory implements AuthRepository {
  sessions = new Map<string, { expiraEm: Date; usuarioId: string }>();
  users = new Map<string, AuthUserRecord>();

  async createSession(input: { expiraEm: Date; tokenHash: string; usuarioId: string }) {
    this.sessions.set(input.tokenHash, input);
  }
  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    const user = session ? this.users.get(session.usuarioId) : undefined;
    return session && user ? { expiraEm: session.expiraEm, usuario: user } : null;
  }
  async findUserByIdentifier(identifier: string) {
    return [...this.users.values()].find((user) => user.login === identifier) ?? null;
  }
}

const unit: UnitRecord = {
  ativo: true,
  bairro: null,
  cep: null,
  cidade: null,
  codigoInep: null,
  complemento: null,
  endereco: null,
  id: UNIT_A,
  nome: 'Unidade A',
  numero: null,
  observacoes: null,
  poloRegiao: null,
  telefones: [],
  tipoUnidade: { ativo: true, id: TYPE_ID, nome: 'EMEF' },
  tipoUnidadeId: TYPE_ID,
};

const professional: ProfessionalRecord = {
  ativo: true,
  bairro: null,
  cargoFuncao: {
    ativo: true,
    ehProfessor: true,
    id: CARGO_ID,
    nome: 'Professor',
    usaPontuacao: true,
  },
  cargoFuncaoId: CARGO_ID,
  cep: null,
  cidade: null,
  complemento: null,
  cpf: '12345678901',
  dataDesligamento: null,
  dataEntradaPrefeitura: '2020-01-01',
  dataNascimento: '1980-01-01',
  email: null,
  endereco: null,
  exercicioAtual: null,
  id: RECORD_ID,
  matricula: 'M-1',
  nomeCompleto: 'Profissional Teste',
  numero: null,
  numeroFilhos: 0,
  observacoes: null,
  permuta: false,
  pontuacao: '0',
  remocao: false,
  sedeAtual: { postoId: RECORD_ID, unidadeId: UNIT_A, unidadeNome: 'Unidade A' },
  telefones: [],
};

function createServices(): RegistryServices {
  const services: RegistryServices = {
    lookups: {
      cargos: vi.fn().mockResolvedValue([professional.cargoFuncao]),
      tiposUnidade: vi.fn().mockResolvedValue([unit.tipoUnidade]),
      unidades: vi.fn().mockResolvedValue([{ ativo: true, id: UNIT_A, nome: 'Unidade A' }]),
    },
    professionals: {
      addPhone: vi.fn().mockResolvedValue(professional),
      create: vi.fn().mockResolvedValue(professional),
      deletePhone: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(professional),
      list: vi.fn().mockResolvedValue({
        items: [professional],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      }),
      administrativeUnitId: vi.fn(async (id: string) => (id === RECORD_ID ? UNIT_A : UNIT_B)),
      update: vi.fn().mockResolvedValue(professional),
      updatePhone: vi.fn().mockResolvedValue(professional),
      updateScore: vi.fn().mockResolvedValue({ ...professional, pontuacao: '10' }),
    },
    units: {
      addPhone: vi.fn().mockResolvedValue({
        ...unit,
        telefones: [{ id: PHONE_ID, numero: '19999999999', tipo: 'CELULAR' }],
      }),
      create: vi.fn().mockResolvedValue(unit),
      deletePhone: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(unit),
      list: vi
        .fn()
        .mockResolvedValue({ items: [unit], page: 1, pageSize: 20, total: 1, totalPages: 1 }),
      update: vi.fn().mockResolvedValue(unit),
      updatePhone: vi.fn().mockResolvedValue(unit),
    },
    users: {
      create: vi.fn(
        async (input) =>
          ({
            ativo: input.ativo,
            email: input.email,
            id: RECORD_ID,
            login: input.login,
            nome: input.nome,
            perfil: input.perfil,
            unidade: null,
            unidadeId: input.unidadeId,
          }) satisfies UserRecord,
      ),
      list: vi
        .fn()
        .mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
      resetPassword: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue({} as UserRecord),
    },
  };
  return services;
}

function database(): DatabaseConnection {
  return { client: {} as DatabaseConnection['client'], disconnect: vi.fn(), ping: vi.fn() };
}

async function scenario(profile: UserProfile, unitId: string | null = null) {
  const auth = new AuthMemory();
  const services = createServices();
  const user: AuthenticatedUser = {
    email: null,
    id: RECORD_ID,
    login: profile.toLowerCase(),
    nome: profile,
    perfil: profile,
    unidade: unitId ? { id: unitId, nome: 'Unidade vinculada' } : null,
  };
  auth.users.set(user.id, { ...user, ativo: true, senhaHash: await hashPassword(PASSWORD) });
  const app = createApp({
    authRepository: auth,
    database: database(),
    environment: createTestEnvironment(),
    registryServices: services,
  });
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ identifier: user.login, password: PASSWORD }).expect(200);
  return { agent, services };
}

const unitPayload = { nome: 'Unidade Nova', tipoUnidadeId: TYPE_ID };
const professionalPayload = {
  cargoFuncaoId: CARGO_ID,
  cpf: '123.456.789-01',
  dataEntradaPrefeitura: '2020-01-01',
  dataNascimento: '1980-01-01',
  matricula: 'M-2',
  nomeCompleto: 'Profissional Nova',
};

describe('Etapa 3 registry API and RBAC', () => {
  it('permite ao Admin criar, editar, inativar e gerenciar telefones de unidade', async () => {
    const { agent, services } = await scenario('ADMINISTRADOR');
    await agent
      .post('/unidades')
      .set('Origin', 'http://localhost:9000')
      .send(unitPayload)
      .expect(201);
    await agent.patch(`/unidades/${UNIT_A}`).send({ nome: 'Nova denominação' }).expect(200);
    await agent.patch(`/unidades/${UNIT_A}`).send({ ativo: false }).expect(200);
    await agent
      .post(`/unidades/${UNIT_A}/telefones`)
      .send({ numero: '(19) 99999-9999', tipo: 'CELULAR' })
      .expect(201);
    expect(services.units.create).toHaveBeenCalledWith(
      expect.objectContaining({ codigoInep: null, poloRegiao: null }),
    );
    expect(services.units.update).toHaveBeenCalledTimes(2);
    expect(services.units.addPhone).toHaveBeenCalled();
  });

  it('mantém Operador em leitura para unidades e profissionais', async () => {
    const { agent } = await scenario('OPERADOR');
    await agent.get('/unidades').expect(200);
    await agent.get('/profissionais').expect(200);
    await agent.post('/unidades').send(unitPayload).expect(403);
    await agent.patch(`/unidades/${UNIT_A}`).send({ ativo: false }).expect(403);
    await agent.patch(`/profissionais/${RECORD_ID}`).send({ remocao: true }).expect(403);
    await agent.patch(`/profissionais/${RECORD_ID}`).send({ permuta: true }).expect(403);
    await agent.patch(`/profissionais/${RECORD_ID}/pontuacao`).send({ pontuacao: 20 }).expect(403);
  });

  it.each(['DIRETOR', 'SECRETARIO'] as const)(
    '%s edita somente a unidade e os profissionais do próprio escopo',
    async (profile) => {
      const { agent } = await scenario(profile, UNIT_A);
      await agent.patch(`/unidades/${UNIT_A}`).send({ nome: 'Permitida' }).expect(200);
      await agent.patch(`/unidades/${UNIT_B}`).send({ nome: 'Negada' }).expect(403);
      await agent
        .patch(`/profissionais/${RECORD_ID}`)
        .send({ remocao: true, permuta: true })
        .expect(200);
      await agent.patch(`/profissionais/${UNIT_B}`).send({ remocao: true }).expect(403);
      await agent.post('/profissionais').send(professionalPayload).expect(403);
    },
  );

  it('permite ao Admin criar/editar profissional e reserva pontuação ao endpoint específico', async () => {
    const { agent, services } = await scenario('ADMINISTRADOR');
    await agent.post('/profissionais').send(professionalPayload).expect(201);
    await agent
      .patch(`/profissionais/${RECORD_ID}`)
      .send({ remocao: true, permuta: true })
      .expect(200);
    await agent.patch(`/profissionais/${RECORD_ID}`).send({ pontuacao: 123 }).expect(400);
    await agent.patch(`/profissionais/${RECORD_ID}/pontuacao`).send({ pontuacao: 123 }).expect(200);
    expect(services.professionals.updateScore).toHaveBeenCalledWith(RECORD_ID, 123);
  });

  it('aceita a coleção final de telefones nos PATCH cadastrais', async () => {
    const { agent, services } = await scenario('ADMINISTRADOR');
    const telefones = [{ id: PHONE_ID, numero: '19999999999', tipo: 'CELULAR' }];
    await agent.patch(`/unidades/${UNIT_A}`).send({ nome: 'Unidade', telefones }).expect(200);
    await agent
      .patch(`/profissionais/${RECORD_ID}`)
      .send({ nomeCompleto: 'Profissional', telefones })
      .expect(200);
    expect(services.units.update).toHaveBeenCalledWith(
      UNIT_A,
      expect.objectContaining({ telefones }),
      expect.anything(),
    );
    expect(services.professionals.update).toHaveBeenCalledWith(
      RECORD_ID,
      expect.objectContaining({ telefones }),
      expect.anything(),
    );
  });

  it('restringe a gestão de usuários ao Admin e nunca devolve senha', async () => {
    const admin = await scenario('ADMINISTRADOR');
    const response = await admin.agent
      .post('/usuarios')
      .send({
        login: 'diretora',
        nome: 'Diretora',
        perfil: 'DIRETOR',
        senha: PASSWORD,
        unidadeId: UNIT_A,
      })
      .expect(201);
    expect(response.text).not.toContain('senha');
    await admin.agent.get('/usuarios').expect(200);
    await admin.agent.patch(`/usuarios/${RECORD_ID}/senha`).send({ senha: PASSWORD }).expect(204);

    const operator = await scenario('OPERADOR');
    await operator.agent.get('/usuarios').expect(403);
    await operator.agent.post('/usuarios').send({}).expect(403);
  });

  it('valida Origin em mutações autenticadas sem afetar GET', async () => {
    const { agent } = await scenario('ADMINISTRADOR');
    await agent.get('/unidades').expect(200);
    await agent
      .post('/unidades')
      .set('Origin', 'http://localhost:9000')
      .send(unitPayload)
      .expect(201);
    await agent
      .post('/unidades')
      .set('Origin', 'https://externo.invalid')
      .send(unitPayload)
      .expect(403);
    await agent.post('/unidades').send(unitPayload).expect(201);
  });
});

describe('Etapa 3 validation rules', () => {
  it('normaliza CPF e aplica defaults independentes de remoção e permuta', () => {
    const parsed = professionalCreateSchema.parse(professionalPayload);
    expect(parsed).toMatchObject({ cpf: '12345678901', permuta: false, remocao: false });
    expect(
      professionalCreateSchema.parse({ ...professionalPayload, permuta: true, remocao: true }),
    ).toMatchObject({
      permuta: true,
      remocao: true,
    });
  });

  it('bloqueia pontuação no PATCH cadastral e exige unidade para Diretor/Secretário', () => {
    expect(() => professionalUpdateSchema.parse({ pontuacao: 10 })).toThrow();
    for (const perfil of ['DIRETOR', 'SECRETARIO'] as const) {
      expect(() =>
        userCreateSchema.parse({ login: perfil, nome: perfil, perfil, senha: PASSWORD }),
      ).toThrow();
    }
  });

  it('rejeita CPF com caracteres inválidos e datas civis inexistentes', () => {
    expect(() =>
      professionalCreateSchema.parse({ ...professionalPayload, cpf: 'abc12345678901' }),
    ).toThrow();
    expect(() =>
      professionalCreateSchema.parse({ ...professionalPayload, dataNascimento: '2026-02-31' }),
    ).toThrow();
  });

  it('mapeia respostas de usuário por allowlist e nunca expõe senhaHash', async () => {
    const client = {
      usuario: {
        create: vi.fn().mockResolvedValue({
          ativo: true,
          atualizadoEm: new Date(),
          criadoEm: new Date(),
          email: null,
          id: RECORD_ID,
          login: 'admin-seguro',
          nome: 'Admin seguro',
          perfil: 'ADMINISTRADOR',
          senhaHash: 'hash-que-nao-pode-sair',
          unidade: null,
          unidadeId: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createPrismaRegistryServices({
      client: client as unknown as DatabaseConnection['client'],
      disconnect: vi.fn(),
      ping: vi.fn(),
    });

    const output = await service.users.create(
      userCreateSchema.parse({
        login: 'admin-seguro',
        nome: 'Admin seguro',
        perfil: 'ADMINISTRADOR',
        senha: PASSWORD,
      }),
    );

    expect(output).not.toHaveProperty('senhaHash');
    expect(JSON.stringify(output)).not.toContain('hash-que-nao-pode-sair');
  });

  it('exige Origin em produção e permite ausência apenas fora dela', async () => {
    const production = express();
    production.post(
      '/',
      createRequireAllowedOrigin(createTestEnvironment({ NODE_ENV: 'production' })),
      (_request, response) => response.sendStatus(204),
    );
    await request(production).post('/').expect(403);

    const testApp = express();
    testApp.post(
      '/',
      createRequireAllowedOrigin(createTestEnvironment({ NODE_ENV: 'test' })),
      (_request, response) => response.sendStatus(204),
    );
    await request(testApp).post('/').expect(204);
  });
});
