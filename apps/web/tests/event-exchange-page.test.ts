import type {
  EventExchangeCentralRecord,
  EventExchangeParticipant,
  EventExchangeSimulation,
} from '@seduc/contracts';
import { QLayout, QPageContainer, QSelect, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EventExchangePage from '@/pages/EventExchangePage.vue';

const mocks = vi.hoisted(() => ({
  confirmExchange: vi.fn(),
  exchangeCentral: vi.fn(),
  simulateExchange: vi.fn(),
}));

vi.mock('@/services/event.service', () => ({ eventApi: mocks }));

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_A = '22222222-2222-4222-8222-222222222222';
const PARTICIPANT_B = '33333333-3333-4333-8333-333333333333';
const PROFESSIONAL_A = '44444444-4444-4444-8444-444444444444';
const PROFESSIONAL_B = '55555555-5555-4555-8555-555555555555';
const POST_A = '66666666-6666-4666-8666-666666666666';
const POST_B = '77777777-7777-4777-8777-777777777777';
const UNIT_A = { ativo: true, id: '88888888-8888-4888-8888-888888888888', nome: 'EMEF A' };
const UNIT_B = { ativo: true, id: '99999999-9999-4999-8999-999999999999', nome: 'EMEF B' };
const PERIOD = { ativo: true, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nome: 'Manhã' };
const linkA = {
  periodo: PERIOD,
  periodoId: PERIOD.id,
  postoId: POST_A,
  unidade: UNIT_A,
  unidadeId: UNIT_A.id,
};
const linkB = {
  periodo: PERIOD,
  periodoId: PERIOD.id,
  postoId: POST_B,
  unidade: UNIT_B,
  unidadeId: UNIT_B.id,
};

function participant(
  participanteId: string,
  profissionalId: string,
  nome: string,
  posicao: number,
  sedeAtual: typeof linkA,
): EventExchangeParticipant {
  return {
    cargo: 'Professor',
    dataEntradaSnapshot: '2010-01-01',
    dataNascimentoSnapshot: '1980-01-01',
    nome,
    numeroFilhosSnapshot: 1,
    participanteId,
    pontuacaoSnapshot: '100.00',
    posicao,
    profissionalId,
    sedeAtual,
    status: 'AGUARDANDO',
  };
}

const participantA = participant(PARTICIPANT_A, PROFESSIONAL_A, 'Ana Atual', 1, linkA);
const participantB = participant(PARTICIPANT_B, PROFESSIONAL_B, 'Bruno Parceiro', 2, linkB);
const central: EventExchangeCentralRecord = {
  candidatos: [participantB],
  evento: {
    ano: 2027,
    cargoFuncao: {
      ativo: true,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      nome: 'Professor',
      usaPontuacao: true,
    },
    cargoFuncaoId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    dataFim: null,
    dataInicio: '2026-10-08T10:00:00.000Z',
    id: EVENT_ID,
    iniciadoPorUsuarioId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    nome: 'Permuta 2027',
    status: 'ATIVO',
    tipo: 'PERMUTA',
  },
  fila: [participantA, participantB],
  participanteAtual: participantA,
  proximos: [participantB],
  totais: { aguardando: 2, atendidos: 0, total: 2 },
  ultimasPermutas: [],
};
const simulation: EventExchangeSimulation = {
  compatibilidade: 'COMPATIVEL',
  consequenciaQuadro: 'As duas sedes oficiais serão trocadas sem alterar o quadro.',
  impedimentos: [],
  participanteAtualEsperadoId: PARTICIPANT_A,
  postoOrigemAtualEsperadoId: POST_A,
  postoOrigemSegundoEsperadoId: POST_B,
  profissionalA: {
    depois: linkB,
    nome: participantA.nome,
    participanteId: PARTICIPANT_A,
    profissionalId: PROFESSIONAL_A,
    sedeAtual: linkA,
  },
  profissionalB: {
    depois: linkA,
    nome: participantB.nome,
    participanteId: PARTICIPANT_B,
    profissionalId: PROFESSIONAL_B,
    sedeAtual: linkB,
  },
};
const confirmationResult = {
  central: {
    ...structuredClone(central),
    candidatos: [],
    fila: [
      { ...participantA, status: 'ATENDIDO' as const },
      { ...participantB, status: 'ATENDIDO' as const },
    ],
    participanteAtual: null,
    proximos: [],
    totais: { aguardando: 0, atendidos: 2, total: 2 },
    ultimasPermutas: [
      {
        dataHora: '2026-10-08T11:00:00.000Z',
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        itens: [
          {
            destino: linkB,
            origem: linkA,
            profissional: participantA.nome,
            profissionalId: PROFESSIONAL_A,
          },
          {
            destino: linkA,
            origem: linkB,
            profissional: participantB.nome,
            profissionalId: PROFESSIONAL_B,
          },
        ],
      },
    ],
  },
  movimentacao: {
    dataHora: '2026-10-08T11:00:00.000Z',
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    itens: [],
  },
};

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ component: EventExchangePage, path: '/eventos/:id/permuta' }],
  });
  await router.push(`/eventos/${EVENT_ID}/permuta`);
  await router.isReady();
  const wrapper = mount(
    {
      components: { QLayout, QPageContainer, TargetPage: EventExchangePage },
      template: '<QLayout><QPageContainer><TargetPage /></QPageContainer></QLayout>',
    },
    { attachTo: document.body, global: { plugins: [Quasar, router], stubs: { teleport: true } } },
  );
  await flushPromises();
  return wrapper;
}

function button(wrapper: Awaited<ReturnType<typeof mountPage>>, label: string) {
  return wrapper.findAll('button').find((candidate) => candidate.text().includes(label));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchangeCentral.mockResolvedValue(structuredClone(central));
  mocks.simulateExchange.mockResolvedValue(structuredClone(simulation));
  mocks.confirmExchange.mockResolvedValue(structuredClone(confirmationResult));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Etapa 8 frontend da Permuta', () => {
  it('mostra participante atual, candidatos, fila congelada e histórico', async () => {
    const wrapper = await mountPage();

    expect(wrapper.get('[data-testid="exchange-current"]').text()).toContain('Ana Atual');
    expect(wrapper.get('[data-testid="exchange-partner"]').text()).toContain(
      'Segundo participante',
    );
    expect(wrapper.get('[data-testid="exchange-queue"]').text()).toContain('Bruno Parceiro');
    expect(wrapper.get('[data-testid="exchange-history"]').text()).toContain(
      'Nenhuma permuta registrada',
    );
    wrapper.unmount();
  });

  it('simula e apresenta comparação bilateral ANTES/DEPOIS', async () => {
    const wrapper = await mountPage();

    await wrapper.findComponent(QSelect).setValue(participantB);
    await button(wrapper, 'Simular Permuta')!.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[data-testid="exchange-dialog"]');
    expect(dialog.text()).toContain('ANTES');
    expect(dialog.text()).toContain('DEPOIS');
    expect(dialog.text()).toContain('EMEF A');
    expect(dialog.text()).toContain('EMEF B');
    expect(mocks.simulateExchange).toHaveBeenCalledWith(EVENT_ID, PARTICIPANT_B);
    wrapper.unmount();
  });

  it('impede dupla confirmação e atualiza fila e histórico após sucesso', async () => {
    let resolveConfirmation: ((value: unknown) => void) | undefined;
    mocks.confirmExchange.mockReturnValue(
      new Promise((resolve) => (resolveConfirmation = resolve)),
    );
    const wrapper = await mountPage();
    await wrapper.findComponent(QSelect).setValue(participantB);
    await button(wrapper, 'Simular Permuta')!.trigger('click');
    await flushPromises();

    const confirm = wrapper.get('[data-testid="confirm-exchange"]');
    await confirm.trigger('click');
    await confirm.trigger('click');
    expect(mocks.confirmExchange).toHaveBeenCalledTimes(1);

    resolveConfirmation!(structuredClone(confirmationResult));
    await flushPromises();
    expect(wrapper.get('[data-testid="exchange-current"]').text()).toContain(
      'Nenhum participante aguardando',
    );
    expect(wrapper.get('[data-testid="exchange-history"]').text()).toContain('Ana Atual');
    wrapper.unmount();
  });

  it('exibe erro da simulação sem abrir confirmação', async () => {
    mocks.simulateExchange.mockRejectedValue(new Error('As sedes não são compatíveis.'));
    const wrapper = await mountPage();
    await wrapper.findComponent(QSelect).setValue(participantB);
    await button(wrapper, 'Simular Permuta')!.trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="exchange-error"]').text()).toContain('não são compatíveis');
    expect(wrapper.find('[data-testid="exchange-dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
