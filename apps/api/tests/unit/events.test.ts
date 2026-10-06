import type {
  AuthenticatedUser,
  EventPreparationRecord,
  EventRecord,
  UserProfile,
} from '@seduc/contracts';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../src/http/error-handler.js';
import { createEventRouter } from '../../src/modules/events/event.router.js';
import {
  eventCreateSchema,
  eventPreparationSchema,
  eventUpdateSchema,
} from '../../src/modules/events/event.schemas.js';
import {
  rankCandidates,
  type EventServices,
  type RankingCandidate,
} from '../../src/modules/events/event.service.js';

const ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const event: EventRecord = {
  ano: 2026,
  cargoFuncao: { ativo: true, id: ID, nome: 'Professor', usaPontuacao: true },
  cargoFuncaoId: ID,
  dataFim: null,
  dataInicio: null,
  id: ID,
  iniciadoPorUsuarioId: null,
  nome: 'Remoção 2026',
  status: 'RASCUNHO',
  tipo: 'REMOCAO',
};
const preparation: EventPreparationRecord = {
  evento: event,
  gruposEmpate: [],
  preview: [],
  profissionais: [],
  selecionados: [],
  totais: { cargo: 0, elegiveis: 0, empatesPendentes: 0, selecionados: 0 },
};

function candidate(
  profissionalId: string,
  overrides: Partial<RankingCandidate> = {},
): RankingCandidate {
  return {
    dataEntrada: '2010-01-01',
    dataNascimento: '1980-01-01',
    nome: profissionalId,
    numeroFilhos: 1,
    pontuacao: '10.00',
    profissionalId,
    ...overrides,
  };
}

function services(): EventServices {
  return {
    create: vi.fn().mockResolvedValue(event),
    get: vi.fn().mockResolvedValue(event),
    list: vi
      .fn()
      .mockResolvedValue({ items: [event], page: 1, pageSize: 20, total: 1, totalPages: 1 }),
    preparation: vi.fn().mockResolvedValue(preparation),
    savePreparation: vi.fn().mockResolvedValue(preparation),
    start: vi.fn().mockResolvedValue(preparation),
    update: vi.fn().mockResolvedValue(event),
  };
}

function appFor(profile: UserProfile, service: EventServices) {
  const app = express();
  app.use(express.json());
  app.use((request_, _response, next) => {
    request_.authenticatedUser = {
      email: null,
      id: USER_ID,
      login: profile.toLowerCase(),
      nome: profile,
      perfil: profile,
      unidades: [],
    } satisfies AuthenticatedUser;
    next();
  });
  app.use('/eventos', createEventRouter(service));
  app.use(errorHandler);
  return app;
}

describe('Etapa 6 ranking oficial', () => {
  it('prioriza a maior pontuação', () => {
    const result = rankCandidates(
      [candidate('menor', { pontuacao: '9' }), candidate('maior', { pontuacao: '10' })],
      true,
    );
    expect(result.ranked.map(({ profissionalId }) => profissionalId)).toEqual(['maior', 'menor']);
  });

  it('com mesma pontuação prioriza a entrada mais antiga', () => {
    const result = rankCandidates(
      [candidate('recente'), candidate('antigo', { dataEntrada: '2000-01-01' })],
      true,
    );
    expect(result.ranked[0]?.profissionalId).toBe('antigo');
  });

  it('com mesma pontuação e entrada prioriza o nascimento mais antigo', () => {
    const result = rankCandidates(
      [candidate('jovem'), candidate('velho', { dataNascimento: '1970-01-01' })],
      true,
    );
    expect(result.ranked[0]?.profissionalId).toBe('velho');
  });

  it('com critérios anteriores iguais prioriza o maior número de filhos', () => {
    const result = rankCandidates(
      [candidate('menos', { numeroFilhos: 1 }), candidate('mais', { numeroFilhos: 4 })],
      true,
    );
    expect(result.ranked[0]?.profissionalId).toBe('mais');
  });

  it('ordena cargo com pontuação por pontuação, entrada, nascimento e filhos', () => {
    const result = rankCandidates(
      [
        candidate('score-low', { pontuacao: '9' }),
        candidate('children', { numeroFilhos: 3 }),
        candidate('birth', { dataNascimento: '1970-01-01' }),
        candidate('admission', { dataEntrada: '2005-01-01' }),
        candidate('score-high', { pontuacao: '100' }),
      ],
      true,
    );
    expect(result.ranked.map(({ profissionalId }) => profissionalId)).toEqual([
      'score-high',
      'admission',
      'birth',
      'children',
      'score-low',
    ]);
    expect(result.ranked.map(({ posicao }) => posicao)).toEqual([1, 2, 3, 4, 5]);
  });

  it('ignora pontuação em cargo sem pontuação e usa entrada, nascimento e filhos', () => {
    const result = rankCandidates(
      [
        candidate('score-ignored', { pontuacao: '999' }),
        candidate('children', { numeroFilhos: 4, pontuacao: '1' }),
        candidate('birth', { dataNascimento: '1970-01-01', pontuacao: '1' }),
        candidate('admission', { dataEntrada: '2001-01-01', pontuacao: '1' }),
      ],
      false,
    );
    expect(result.ranked.map(({ profissionalId }) => profissionalId)).toEqual([
      'admission',
      'birth',
      'children',
      'score-ignored',
    ]);
  });

  it('marca igualdade absoluta sem usar nome, matrícula implícita, UUID ou inserção', () => {
    const tied = [
      candidate('ffffffff-ffff-4fff-8fff-ffffffffffff', { nome: 'Ana' }),
      candidate('00000000-0000-4000-8000-000000000000', { nome: 'Zilda' }),
    ];
    const forward = rankCandidates(tied, true);
    const reverse = rankCandidates([...tied].reverse(), true);

    expect(forward.gruposEmpate).toHaveLength(1);
    expect(
      forward.ranked.every(({ empatePendente, posicao }) => empatePendente && posicao === null),
    ).toBe(true);
    expect(reverse.gruposEmpate).toHaveLength(1);
    expect(
      reverse.ranked.every(({ empatePendente, posicao }) => empatePendente && posicao === null),
    ).toBe(true);
  });

  it('também marca empate absoluto sem pontuação', () => {
    const result = rankCandidates([candidate('A'), candidate('B', { pontuacao: '500' })], false);
    expect(result.gruposEmpate[0]?.profissionalIds).toEqual(['A', 'B']);
    expect(result.ranked.map(({ posicao }) => posicao)).toEqual([null, null]);
  });

  it('sem pontuação prioriza isoladamente a entrada mais antiga', () => {
    const result = rankCandidates(
      [
        candidate('recente', { pontuacao: '999' }),
        candidate('antigo', { dataEntrada: '2000-01-01', pontuacao: '1' }),
      ],
      false,
    );
    expect(result.ranked[0]?.profissionalId).toBe('antigo');
  });

  it('sem pontuação e com mesma entrada prioriza o nascimento mais antigo', () => {
    const result = rankCandidates(
      [candidate('jovem'), candidate('velho', { dataNascimento: '1970-01-01' })],
      false,
    );
    expect(result.ranked[0]?.profissionalId).toBe('velho');
  });

  it('sem pontuação e com datas iguais prioriza o maior número de filhos', () => {
    const result = rankCandidates(
      [candidate('menos', { numeroFilhos: 1 }), candidate('mais', { numeroFilhos: 4 })],
      false,
    );
    expect(result.ranked[0]?.profissionalId).toBe('mais');
  });

  it('não usa nome como desempate', () => {
    const result = rankCandidates(
      [candidate('primeiro', { nome: 'Zilda' }), candidate('segundo', { nome: 'Ana' })],
      true,
    );
    expect(result.gruposEmpate).toHaveLength(1);
    expect(result.ranked.every(({ posicao }) => posicao === null)).toBe(true);
  });

  it('não usa matrícula como desempate', () => {
    const result = rankCandidates(
      [candidate('primeiro', { matricula: 'Z-999' }), candidate('segundo', { matricula: 'A-001' })],
      true,
    );
    expect(result.gruposEmpate).toHaveLength(1);
  });

  it('não usa UUID como desempate', () => {
    const result = rankCandidates(
      [
        candidate('ffffffff-ffff-4fff-8fff-ffffffffffff'),
        candidate('00000000-0000-4000-8000-000000000000'),
      ],
      true,
    );
    expect(result.gruposEmpate).toHaveLength(1);
  });
});

describe('Etapa 6 API e RBAC', () => {
  it('permite criar, editar, preparar e iniciar somente ao OPERADOR', async () => {
    const service = services();
    const operator = request(appFor('OPERADOR', service));
    await operator.get('/eventos').expect(200);
    await operator
      .post('/eventos')
      .send({ ano: 2026, cargoFuncaoId: ID, nome: 'Evento', tipo: 'REMOCAO' })
      .expect(201);
    await operator.patch(`/eventos/${ID}`).send({ nome: 'Evento revisto' }).expect(200);
    await operator.get(`/eventos/${ID}/preparacao`).expect(200);
    await operator.put(`/eventos/${ID}/preparacao`).send({ profissionalIds: [] }).expect(200);
    await operator.post(`/eventos/${ID}/iniciar`).send({ iniciadoPorUsuarioId: ID }).expect(200);
    expect(service.start).toHaveBeenCalledWith(ID, USER_ID);
  });

  it.each(['ADMINISTRADOR', 'DIRETOR', 'SECRETARIO'] as const)(
    'nega toda operação de evento para %s',
    async (profile) => {
      const app = appFor(profile, services());
      await request(app).get('/eventos').expect(403);
      await request(app).post('/eventos').send({}).expect(403);
      await request(app).get(`/eventos/${ID}/preparacao`).expect(403);
      await request(app).post(`/eventos/${ID}/iniciar`).expect(403);
    },
  );

  it('exige cargo e rejeita campos de controle ou seleção duplicada estrutural inválida', () => {
    expect(() => eventCreateSchema.parse({ ano: 2026, nome: 'Evento', tipo: 'LISTAO' })).toThrow();
    expect(() =>
      eventCreateSchema.parse({
        ano: 2026,
        cargoFuncaoId: ID,
        dataInicio: new Date().toISOString(),
        nome: 'Evento',
        status: 'ATIVO',
        tipo: 'LISTAO',
      }),
    ).toThrow();
    expect(() => eventUpdateSchema.parse({})).toThrow();
    expect(
      eventPreparationSchema.parse({ profissionalIds: [ID, ID] }).profissionalIds,
    ).toHaveLength(2);
  });
});
