import type {
  EventCentralRecord,
  EventChoiceSimulation,
  PublicEventDisplay,
  WorkPositionRecord,
} from '@seduc/contracts';
import { QLayout, QPageContainer, QSelect, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EventOperationsPage from '@/pages/EventOperationsPage.vue';
import PublicEventDisplayPage from '@/pages/PublicEventDisplayPage.vue';

const mocks = vi.hoisted(() => ({
  central: vi.fn(),
  choose: vi.fn(),
  close: vi.fn(),
  movements: vi.fn(),
  publicChoices: vi.fn(),
  publicDisplay: vi.fn(),
  simulate: vi.fn(),
  vacancies: vi.fn(),
}));

vi.mock('@/services/event.service', () => ({ eventApi: mocks }));

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_A = '22222222-2222-4222-8222-222222222222';
const PARTICIPANT_B = '33333333-3333-4333-8333-333333333333';
const PROFESSIONAL_A = '44444444-4444-4444-8444-444444444444';
const PROFESSIONAL_B = '55555555-5555-4555-8555-555555555555';
const UNIT_A = '66666666-6666-4666-8666-666666666666';
const UNIT_B = '77777777-7777-4777-8777-777777777777';
const PERIOD = '88888888-8888-4888-8888-888888888888';
const POSITION_A = '99999999-9999-4999-8999-999999999999';
const POSITION_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const lookupPeriod = { ativo: true, id: PERIOD, nome: 'Manhã' };
const lookupUnitA = { ativo: true, id: UNIT_A, nome: 'EMEF A' };
const lookupUnitB = { ativo: true, id: UNIT_B, nome: 'EMEF B' };

function position(
  id: string,
  disponibilidade: 'DISPONIVEL_COM_SEDE' | 'DISPONIVEL_SEM_SEDE',
  unit = lookupUnitA,
): WorkPositionRecord {
  return {
    anoLetivo: 2027,
    ativo: true,
    cargoFuncao: { ativo: true, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', nome: 'Professor' },
    cargoFuncaoId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    codigo: id === POSITION_A ? 'PA' : 'PB',
    disponibilidade,
    estadoEstrutural: disponibilidade,
    exercicioAtual: null,
    id,
    motivosLiberacao: disponibilidade === 'DISPONIVEL_SEM_SEDE' ? ['AFASTAMENTO'] : [],
    ocupanteAtual: null,
    periodo: lookupPeriod,
    periodoId: PERIOD,
    quadroNecessidadeId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    reservadoParaEvento: false,
    titularAtual:
      disponibilidade === 'DISPONIVEL_SEM_SEDE'
        ? { id: PROFESSIONAL_B, matricula: 'M2', nomeCompleto: 'Titular B' }
        : null,
    unidade: unit,
    unidadeId: unit.id,
  };
}

const participantA = {
  cargo: 'Professor',
  dataEntradaSnapshot: '2010-01-01',
  dataNascimentoSnapshot: '1980-01-01',
  nome: 'Ana Atual',
  numeroFilhosSnapshot: 2,
  participanteId: PARTICIPANT_A,
  pontuacaoSnapshot: '100.00',
  posicao: 1,
  profissionalId: PROFESSIONAL_A,
  status: 'AGUARDANDO' as const,
};
const participantB = {
  ...participantA,
  nome: 'Bruno Próximo',
  participanteId: PARTICIPANT_B,
  pontuacaoSnapshot: '90.00',
  posicao: 2,
  profissionalId: PROFESSIONAL_B,
};
const vacancies = [
  position(POSITION_A, 'DISPONIVEL_COM_SEDE', lookupUnitA),
  position(POSITION_B, 'DISPONIVEL_SEM_SEDE', lookupUnitB),
];
const central: EventCentralRecord = {
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
    dataInicio: '2026-10-07T10:00:00.000Z',
    id: EVENT_ID,
    iniciadoPorUsuarioId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    nome: 'Remoção 2027',
    status: 'ATIVO',
    tipo: 'REMOCAO',
  },
  fila: [participantA, participantB],
  participanteAtual: participantA,
  proximos: [participantB],
  regraPeriodo: { code: null, message: null, mode: 'FIXED', periodoId: PERIOD },
  situacaoAtual: {
    exerciciosAtuais: [
      {
        ...{
          periodo: lookupPeriod,
          periodoId: PERIOD,
          postoId: POSITION_B,
          unidade: lookupUnitB,
          unidadeId: UNIT_B,
        },
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        substituiProfissional: { id: PROFESSIONAL_B, nome: 'Titular B' },
        tipo: 'SUBSTITUICAO',
      },
    ],
    sedeAtual: {
      periodo: lookupPeriod,
      periodoId: PERIOD,
      postoId: POSITION_A,
      unidade: lookupUnitA,
      unidadeId: UNIT_A,
    },
  },
  totais: { aguardando: 2, atendidos: 0, podeEncerrar: false, total: 2, vagasDisponiveis: 2 },
  ultimasMovimentacoes: [
    {
      dataHora: '2026-10-07T11:00:00.000Z',
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      origem: null,
      periodo: 'Manhã',
      postoDestinoId: POSITION_A,
      postoOrigemId: null,
      profissional: 'Escolha anterior',
      tipoDestino: 'SEDE',
      unidadeDestino: 'EMEF A',
    },
  ],
  vagasDisponiveis: vacancies,
};

const simulation: EventChoiceSimulation = {
  antes: {
    exerciciosAtuais: central.situacaoAtual!.exerciciosAtuais,
    profissional: participantA.nome,
    sedeOficial: central.situacaoAtual!.sedeAtual,
  },
  depois: {
    exercicioNovo: null,
    sedeOficial: {
      periodo: lookupPeriod,
      periodoId: PERIOD,
      postoId: POSITION_A,
      unidade: lookupUnitA,
      unidadeId: UNIT_A,
    },
    titularidadePreservada: false,
    vinculoEncerrado: central.situacaoAtual!.sedeAtual,
  },
  destino: {
    periodo: lookupPeriod,
    periodoId: PERIOD,
    postoId: POSITION_A,
    tipo: 'SEDE',
    titular: null,
    unidade: lookupUnitA,
    unidadeId: UNIT_A,
  },
  novasVagasGeradas: [
    {
      ...central.situacaoAtual!.sedeAtual!,
      tipo: 'SEDE',
    },
  ],
  participanteEsperadoId: PARTICIPANT_A,
};

const publicDisplay: PublicEventDisplay = {
  evento: { ano: 2027, nome: 'Remoção 2027', status: 'ATIVO', tipo: 'REMOCAO' },
  participanteAtual: { nome: 'Ana Atual', posicao: 1 },
  proximos: [{ nome: 'Bruno Próximo', posicao: 2 }],
  ultimasEscolhas: [
    {
      dataHora: '2026-10-07T11:00:00.000Z',
      periodo: 'Manhã',
      profissional: 'Escolha anterior',
      tipoDestino: 'SEDE',
      unidadeDestino: 'EMEF A',
    },
  ],
  vagas: [
    { periodo: 'Manhã', quantidade: 2, tipo: 'SEDE', unidade: 'EMEF A' },
    { periodo: 'Manhã', quantidade: 1, tipo: 'SEM_SEDE', unidade: 'EMEF B' },
  ],
};

async function mountPage(component: object, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: { template: '<div />' }, name: 'events', path: '/eventos' },
      { component: { template: '<div />' }, name: 'operations', path: '/eventos/:id/central' },
      { component: { template: '<div />' }, name: 'public', path: '/publico/eventos/:id' },
    ],
  });
  await router.push(path);
  await router.isReady();
  const target = {
    components: { QLayout, QPageContainer, TargetPage: component },
    template: '<QLayout><QPageContainer><TargetPage /></QPageContainer></QLayout>',
  };
  const wrapper = mount(target, {
    attachTo: document.body,
    global: { plugins: [Quasar, router], stubs: { teleport: true } },
  });
  await flushPromises();
  return wrapper;
}

function button(wrapper: Awaited<ReturnType<typeof mountPage>>, label: string) {
  return wrapper.findAll('button').find((candidate) => candidate.text().includes(label));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.central.mockResolvedValue(structuredClone(central));
  mocks.vacancies.mockResolvedValue(structuredClone(vacancies));
  mocks.simulate.mockResolvedValue(structuredClone(simulation));
  mocks.choose.mockResolvedValue({
    atendido: { ...participantA, status: 'ATENDIDO' },
    central: {
      ...structuredClone(central),
      fila: [{ ...participantA, status: 'ATENDIDO' }, participantB],
      participanteAtual: participantB,
      proximos: [],
      totais: { ...central.totais, aguardando: 1, atendidos: 1 },
    },
    movimentacao: central.ultimasMovimentacoes[0],
  });
  mocks.movements.mockResolvedValue({
    items: central.ultimasMovimentacoes,
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  });
  mocks.close.mockResolvedValue({
    ...central.evento,
    dataFim: '2026-10-07T12:00:00.000Z',
    status: 'ENCERRADO',
  });
  mocks.publicDisplay.mockResolvedValue(structuredClone(publicDisplay));
  mocks.publicChoices.mockResolvedValue({
    items: publicDisplay.ultimasEscolhas,
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Etapa 7 frontend da Central', () => {
  it('mostra carregamento enquanto busca o estado operacional', async () => {
    mocks.central.mockReturnValue(new Promise(() => undefined));

    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    expect(wrapper.text()).toContain('Carregando Central');
    wrapper.unmount();
  });

  it('mostra erro quando a Central não pode ser carregada', async () => {
    mocks.central.mockRejectedValue(new Error('Evento não está disponível.'));

    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    expect(wrapper.text()).toContain('Evento não está disponível.');
    wrapper.unmount();
  });

  it('mostra participante atual, próximos, snapshots, vínculos, vagas e últimas escolhas', async () => {
    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    expect(wrapper.get('[data-testid="current-participant"]').text()).toContain('Ana Atual');
    expect(wrapper.get('[data-testid="current-participant"]').text()).toContain('100.00');
    expect(wrapper.get('[data-testid="current-participant"]').text()).toContain('EMEF A');
    expect(wrapper.get('[data-testid="current-participant"]').text()).toContain('Substituição');
    expect(wrapper.get('[data-testid="next-participants"]').text()).toContain('Bruno Próximo');
    expect(wrapper.get('[data-testid="available-positions"]').text()).toContain(
      'SEDE FIXA / COM SEDE',
    );
    expect(wrapper.get('[data-testid="available-positions"]').text()).toContain(
      'SEM SEDE / SUBSTITUIÇÃO',
    );
    expect(wrapper.get('[data-testid="recent-movements"]').text()).toContain('Escolha anterior');
    expect(wrapper.get('[data-testid="close-event"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('consulta filtros no backend sem permitir alterar cargo ou ano', async () => {
    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);
    const selects = wrapper.findAllComponents(QSelect);

    await selects[0]!.setValue(UNIT_A);
    await flushPromises();
    expect(mocks.vacancies).toHaveBeenCalledWith(EVENT_ID, { unidadeId: UNIT_A });
    expect(wrapper.text()).not.toContain('Filtro de cargo');
    expect(wrapper.text()).not.toContain('Filtro de ano');
    wrapper.unmount();
  });

  it('simula ANTES/DESTINO/DEPOIS e bloqueia dupla confirmação enquanto envia', async () => {
    let resolveChoice: ((value: unknown) => void) | undefined;
    mocks.choose.mockReturnValue(
      new Promise((resolve) => {
        resolveChoice = resolve;
      }),
    );
    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    await button(wrapper, 'Simular escolha')!.trigger('click');
    await flushPromises();
    const dialog = wrapper.get('[data-testid="choice-dialog"]');
    expect(dialog.text()).toContain('ANTES');
    expect(dialog.text()).toContain('DESTINO');
    expect(dialog.text()).toContain('DEPOIS');
    expect(dialog.text()).toContain('NOVA VAGA GERADA');
    const confirm = wrapper.get('[data-testid="confirm-choice"]');
    await confirm.trigger('click');
    await confirm.trigger('click');
    expect(mocks.choose).toHaveBeenCalledTimes(1);
    expect(mocks.choose).toHaveBeenCalledWith(EVENT_ID, {
      participanteEsperadoId: PARTICIPANT_A,
      postoTrabalhoId: POSITION_A,
    });
    resolveChoice!({
      atendido: { ...participantA, status: 'ATENDIDO' },
      central: { ...structuredClone(central), participanteAtual: participantB, proximos: [] },
      movimentacao: central.ultimasMovimentacoes[0],
    });
    await flushPromises();
    expect(wrapper.get('[data-testid="current-participant"]').text()).toContain('Bruno Próximo');
    wrapper.unmount();
  });

  it('mantém confirmação bloqueada quando a simulação retorna conflito', async () => {
    mocks.simulate.mockRejectedValue(new Error('O posto deixou de estar disponível.'));
    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    await button(wrapper, 'Simular escolha')!.trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="choice-dialog"]').text()).toContain(
      'O posto deixou de estar disponível.',
    );
    expect(wrapper.get('[data-testid="confirm-choice"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('habilita encerramento apenas sem pendentes e passa a somente leitura', async () => {
    mocks.central.mockResolvedValue({
      ...structuredClone(central),
      fila: [{ ...participantA, status: 'ATENDIDO' }],
      participanteAtual: null,
      proximos: [],
      totais: { ...central.totais, aguardando: 0, atendidos: 1, podeEncerrar: true },
    });
    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    expect(wrapper.get('[data-testid="close-event"]').attributes('disabled')).toBeUndefined();
    await wrapper.get('[data-testid="close-event"]').trigger('click');
    await flushPromises();
    expect(mocks.close).toHaveBeenCalledWith(EVENT_ID);
    expect(wrapper.text()).toContain('Evento encerrado. Esta visualização é somente leitura.');
    wrapper.unmount();
  });

  it('mostra bloqueio formal quando o período não pode ser comprovado', async () => {
    mocks.central.mockResolvedValue({
      ...structuredClone(central),
      regraPeriodo: {
        code: 'EVENT_PERIOD_RULE_REQUIRED',
        message: 'Não existe vínculo atual inequívoco.',
        mode: 'BLOCKED',
        periodoId: null,
      },
      vagasDisponiveis: [],
    });
    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    expect(wrapper.get('[data-testid="period-rule-warning"]').text()).toContain(
      'As escolhas estão bloqueadas',
    );
    expect(wrapper.findAll('button').some((item) => item.text().includes('Simular escolha'))).toBe(
      false,
    );
    wrapper.unmount();
  });

  it('informa quando profissional sem vínculo pode escolher qualquer período', async () => {
    mocks.central.mockResolvedValue({
      ...structuredClone(central),
      regraPeriodo: {
        code: null,
        message: 'Período permitido: qualquer período disponível.',
        mode: 'ANY',
        periodoId: null,
      },
      situacaoAtual: { exerciciosAtuais: [], sedeAtual: null },
      vagasDisponiveis: [
        vacancies[0],
        {
          ...vacancies[1],
          periodo: {
            ativo: true,
            id: '12121212-1212-4121-8121-121212121212',
            nome: 'Tarde',
          },
          periodoId: '12121212-1212-4121-8121-121212121212',
        },
      ],
    });
    const wrapper = await mountPage(EventOperationsPage, `/eventos/${EVENT_ID}/central`);

    expect(wrapper.get('[data-testid="any-period-info"]').text()).toContain(
      'qualquer período disponível',
    );
    expect(wrapper.find('[data-testid="period-rule-warning"]').exists()).toBe(false);
    expect(wrapper.findAllComponents(QSelect)[1]!.props('options')).toHaveLength(2);
    wrapper.unmount();
  });
});

describe('Etapa 7 frontend do telão público', () => {
  it('mostra sessão sanitizada, vagas textuais, últimas escolhas e atualiza por polling', async () => {
    vi.useFakeTimers();
    const wrapper = await mountPage(PublicEventDisplayPage, `/publico/eventos/${EVENT_ID}`);

    expect(wrapper.get('[data-testid="public-current-participant"]').text()).toContain('Ana Atual');
    expect(wrapper.get('[data-testid="public-next-participants"]').text()).toContain(
      'Bruno Próximo',
    );
    expect(wrapper.get('[data-testid="public-vacancies"]').text()).toContain(
      'SEDE FIXA / COM SEDE',
    );
    expect(wrapper.get('[data-testid="public-vacancies"]').text()).toContain(
      'SEM SEDE / SUBSTITUIÇÃO',
    );
    expect(wrapper.get('[data-testid="public-recent-choices"]').text()).toContain(
      'Escolha anterior',
    );
    await vi.advanceTimersByTimeAsync(3_000);
    await flushPromises();
    expect(mocks.publicDisplay).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('abre histórico público paginado e mantém evento encerrado visível', async () => {
    mocks.publicDisplay.mockResolvedValue({
      ...structuredClone(publicDisplay),
      evento: { ...publicDisplay.evento, status: 'ENCERRADO' },
      participanteAtual: null,
      proximos: [],
    });
    const wrapper = await mountPage(PublicEventDisplayPage, `/publico/eventos/${EVENT_ID}`);

    expect(wrapper.text()).toContain('EVENTO ENCERRADO');
    expect(wrapper.text()).toContain('Nenhuma pessoa na mesa');
    await button(wrapper, 'Ver escolhas anteriores')!.trigger('click');
    await flushPromises();
    expect(mocks.publicChoices).toHaveBeenCalledWith(EVENT_ID, 1, 20);
    expect(wrapper.get('[data-testid="public-choice-history"]').text()).toContain(
      'Escolha anterior',
    );
    wrapper.unmount();
  });
});
