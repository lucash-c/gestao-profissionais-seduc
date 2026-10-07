import type {
  AuthenticatedUser,
  EventPreparationRecord,
  EventRecord,
  LookupRecord,
} from '@seduc/contracts';
import { QLayout, QPageContainer, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminLayout from '@/layouts/AdminLayout.vue';
import EventPreparationPage from '@/pages/EventPreparationPage.vue';
import EventsPage from '@/pages/EventsPage.vue';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getPreparation: vi.fn(),
  list: vi.fn(),
  listCargos: vi.fn(),
  savePreparation: vi.fn(),
  start: vi.fn(),
  update: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({
  logout: vi.fn(),
  state: { status: 'authenticated', user: null as AuthenticatedUser | null },
}));

vi.mock('@/services/event.service', () => ({
  eventApi: {
    create: mocks.create,
    getPreparation: mocks.getPreparation,
    list: mocks.list,
    savePreparation: mocks.savePreparation,
    start: mocks.start,
    update: mocks.update,
  },
}));
vi.mock('@/services/registry.service', () => ({
  registryApi: { listCargos: mocks.listCargos },
}));
vi.mock('@/stores/session.store', () => ({ sessionStore: sessionMock }));

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const CARGO_ID = '22222222-2222-4222-8222-222222222222';
const PROFESSIONAL_A = '33333333-3333-4333-8333-333333333333';
const PROFESSIONAL_B = '44444444-4444-4444-8444-444444444444';
const PROFESSIONAL_C = '55555555-5555-4555-8555-555555555555';
const cargo: LookupRecord & { usaPontuacao: boolean } = {
  ativo: true,
  id: CARGO_ID,
  nome: 'Professor',
  usaPontuacao: true,
};
const event: EventRecord = {
  ano: 2026,
  cargoFuncao: cargo,
  cargoFuncaoId: CARGO_ID,
  dataFim: null,
  dataInicio: null,
  id: EVENT_ID,
  iniciadoPorUsuarioId: null,
  nome: 'Remoção 2026',
  status: 'RASCUNHO',
  tipo: 'REMOCAO',
};
const preparation: EventPreparationRecord = {
  evento: event,
  gruposEmpate: [{ profissionalIds: [PROFESSIONAL_B, PROFESSIONAL_C] }],
  preview: [
    {
      dataEntrada: '2005-01-01',
      dataNascimento: '1970-01-01',
      empatePendente: false,
      nome: 'Ana Primeira',
      numeroFilhos: 3,
      posicao: 1,
      profissionalId: PROFESSIONAL_A,
      pontuacao: '100.00',
    },
    {
      dataEntrada: '2010-01-01',
      dataNascimento: '1980-01-01',
      empatePendente: true,
      nome: 'Bruna Empate',
      numeroFilhos: 2,
      posicao: null,
      profissionalId: PROFESSIONAL_B,
      pontuacao: '90.00',
    },
  ],
  profissionais: [
    {
      cargo: 'Professor',
      dataEntradaPrefeitura: '2005-01-01',
      dataNascimento: '1970-01-01',
      elegivel: true,
      empatePendente: false,
      matricula: 'M-1',
      motivoInelegibilidade: null,
      nome: 'Ana Primeira',
      numeroFilhos: 3,
      ordemPrevia: 1,
      permuta: true,
      pontuacao: '100.00',
      possuiSedeAtual: true,
      profissionalId: PROFESSIONAL_A,
      remocao: true,
      selecionado: true,
    },
    {
      cargo: 'Professor',
      dataEntradaPrefeitura: '2010-01-01',
      dataNascimento: '1980-01-01',
      elegivel: true,
      empatePendente: true,
      matricula: 'M-2',
      motivoInelegibilidade: null,
      nome: 'Bruna Empate',
      numeroFilhos: 2,
      ordemPrevia: null,
      permuta: false,
      pontuacao: '90.00',
      possuiSedeAtual: false,
      profissionalId: PROFESSIONAL_B,
      remocao: true,
      selecionado: false,
    },
    {
      cargo: 'Professor',
      dataEntradaPrefeitura: '2010-01-01',
      dataNascimento: '1980-01-01',
      elegivel: false,
      empatePendente: false,
      matricula: 'M-3',
      motivoInelegibilidade: 'Profissional não habilitado para Remoção.',
      nome: 'Carla Inelegível',
      numeroFilhos: 1,
      ordemPrevia: null,
      permuta: true,
      pontuacao: '80.00',
      possuiSedeAtual: false,
      profissionalId: PROFESSIONAL_C,
      remocao: false,
      selecionado: false,
    },
  ],
  selecionados: [PROFESSIONAL_A],
  totais: { cargo: 3, elegiveis: 2, empatesPendentes: 1, selecionados: 1 },
};

function setProfile(perfil: AuthenticatedUser['perfil']): void {
  sessionMock.state.user = {
    email: null,
    id: '66666666-6666-4666-8666-666666666666',
    login: perfil.toLowerCase(),
    nome: perfil,
    perfil,
    unidades: [],
  };
}

async function mountPage(component: object, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: { template: '<div />' }, name: 'events', path: '/eventos' },
      {
        component: { template: '<div />' },
        name: 'event-operations',
        path: '/eventos/:id/central',
      },
      {
        component: { template: '<div />' },
        name: 'event-preparation',
        path: '/eventos/:id/preparacao',
      },
      {
        component: { template: '<div />' },
        name: 'event-exchange',
        path: '/eventos/:id/permuta',
      },
      { component: { template: '<div />' }, name: 'login', path: '/login' },
      {
        component: { template: '<div />' },
        name: 'public-event-display',
        path: '/publico/eventos/:id',
      },
      { component: { template: '<div />' }, name: 'units', path: '/unidades' },
    ],
  });
  await router.push(path);
  await router.isReady();
  const target =
    component === AdminLayout
      ? component
      : {
          components: { QLayout, QPageContainer, TargetPage: component },
          template: '<QLayout><QPageContainer><TargetPage /></QPageContainer></QLayout>',
        };
  const wrapper = mount(target, {
    attachTo: document.body,
    global: { plugins: [Quasar, router], stubs: { teleport: true } },
  });
  await flushPromises();
  return { router, wrapper };
}

function button(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], label: string) {
  return wrapper.findAll('button').find((candidate) => candidate.text().includes(label));
}

function expectButtonEnabled(
  wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'],
  testId: string,
): void {
  expect(wrapper.get(`[data-testid="${testId}"]`).attributes('disabled')).toBeUndefined();
}

function expectButtonDisabled(
  wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'],
  testId: string,
): void {
  expect(wrapper.get(`[data-testid="${testId}"]`).attributes('disabled')).toBeDefined();
}

beforeEach(() => {
  vi.clearAllMocks();
  setProfile('OPERADOR');
  mocks.listCargos.mockResolvedValue([cargo]);
  mocks.list.mockResolvedValue({ items: [event], page: 1, pageSize: 20, total: 1, totalPages: 1 });
  mocks.getPreparation.mockResolvedValue(structuredClone(preparation));
  mocks.savePreparation.mockResolvedValue(structuredClone(preparation));
  mocks.start.mockResolvedValue({
    ...structuredClone(preparation),
    evento: { ...event, dataInicio: '2026-10-06T15:30:00.000Z', status: 'ATIVO' },
  });
  mocks.create.mockResolvedValue(event);
  mocks.update.mockResolvedValue(event);
});

describe('Etapa 6 frontend de eventos', () => {
  it('mostra menu somente ao OPERADOR', async () => {
    const operator = await mountPage(AdminLayout, '/eventos');
    expect(operator.wrapper.find('[data-testid="events-menu"]').exists()).toBe(true);
    operator.wrapper.unmount();

    setProfile('ADMINISTRADOR');
    const admin = await mountPage(AdminLayout, '/unidades');
    expect(admin.wrapper.find('[data-testid="events-menu"]').exists()).toBe(false);
    admin.wrapper.unmount();
  });

  it('lista eventos e abre formulário obrigatório de criação', async () => {
    const { wrapper } = await mountPage(EventsPage, '/eventos');
    expect(wrapper.text()).toContain('Remoção 2026');
    await wrapper.get('[data-testid="new-event"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="event-dialog"]').text()).toContain('Cargo/função *');
    expect(wrapper.get('[data-testid="event-dialog"]').text()).toContain('Tipo *');
    expect(wrapper.get('[data-testid="event-dialog"]').text()).toContain('Ano *');
  });

  it('oferece a operação adequada para cada evento ATIVO', async () => {
    mocks.list.mockResolvedValue({
      items: [
        { ...event, status: 'ATIVO' },
        { ...event, id: '77777777-7777-4777-8777-777777777777', status: 'ATIVO', tipo: 'LISTAO' },
        { ...event, id: '88888888-8888-4888-8888-888888888888', status: 'ATIVO', tipo: 'PERMUTA' },
        { ...event, id: '99999999-9999-4999-8999-999999999999', status: 'ENCERRADO' },
      ],
      page: 1,
      pageSize: 20,
      total: 4,
      totalPages: 1,
    });
    const { wrapper } = await mountPage(EventsPage, '/eventos');

    expect(
      wrapper.findAll('a').filter((item) => item.text().includes('Abrir Central')),
    ).toHaveLength(2);
    expect(
      wrapper.findAll('a').filter((item) => item.text().includes('Abrir Permuta')),
    ).toHaveLength(1);
    expect(wrapper.findAll('a').some((item) => item.text().includes('Ver resultado'))).toBe(true);
  });

  it('mantém a lista completa visível durante busca e exibe filhos, chips e inelegível bloqueado', async () => {
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);
    expect(wrapper.text()).toContain('Ana Primeira');
    expect(wrapper.text()).toContain('Bruna Empate');
    expect(wrapper.text()).toContain('Carla Inelegível');
    expect(wrapper.text()).toContain('Filhos');
    expect(wrapper.text()).toContain('COM SEDE');
    expect(wrapper.text()).toContain('SEM SEDE');
    expect(wrapper.text()).toContain('Profissional não habilitado para Remoção.');
    const rowsBefore = wrapper.findAll('[data-testid="event-professionals-table"] tbody tr').length;
    await wrapper.get('[data-testid="event-search"]').setValue('Ana');
    expect(wrapper.findAll('[data-testid="event-professionals-table"] tbody tr')).toHaveLength(
      rowsBefore,
    );
    expect(wrapper.findAll('.q-checkbox.disabled')).toHaveLength(1);
  });

  it('aplica TODOS, COM SEDE, SEM SEDE, REMOÇÃO e PERMUTA somente aos elegíveis', async () => {
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);
    for (const label of ['TODOS', 'COM SEDE', 'SEM SEDE', 'REMOÇÃO', 'PERMUTA']) {
      expect(button(wrapper, label)).toBeDefined();
      await button(wrapper, label)!.trigger('click');
      await flushPromises();
    }
    await wrapper.get('[data-testid="save-preparation"]').trigger('click');
    await flushPromises();
    expect(mocks.savePreparation).toHaveBeenCalledWith(EVENT_ID, [PROFESSIONAL_A]);
  });

  it('permite iniciar quando a preparação carregada não tem alterações locais', async () => {
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);

    expectButtonEnabled(wrapper, 'start-event');
    expect(wrapper.find('[data-testid="unsaved-selection-warning"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="event-preview-heading"]').text()).toBe('Prévia da fila');
  });

  it('compara a seleção como conjunto sem considerar a ordem dos IDs', async () => {
    mocks.getPreparation.mockResolvedValue({
      ...structuredClone(preparation),
      selecionados: [PROFESSIONAL_A, PROFESSIONAL_B],
      totais: { ...preparation.totais, selecionados: 2 },
    });
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);

    await wrapper.get(`[data-testid="professional-select-${PROFESSIONAL_A}"]`).trigger('click');
    await wrapper.get(`[data-testid="professional-select-${PROFESSIONAL_A}"]`).trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="unsaved-selection-warning"]').exists()).toBe(false);
    expectButtonEnabled(wrapper, 'start-event');
  });

  it('bloqueia o início e identifica a prévia salva ao marcar ou desmarcar um profissional', async () => {
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);
    const warning = '[data-testid="unsaved-selection-warning"]';

    await wrapper.get(`[data-testid="professional-select-${PROFESSIONAL_B}"]`).trigger('click');
    await flushPromises();
    expectButtonDisabled(wrapper, 'start-event');
    expectButtonEnabled(wrapper, 'save-preparation');
    expect(wrapper.get(warning).text()).toContain(
      'Existem alterações na seleção ainda não salvas. Salve a preparação antes de iniciar o evento.',
    );
    expect(wrapper.get('[data-testid="event-preview-heading"]').text()).toBe(
      'Prévia da última preparação salva',
    );
    expect(mocks.start).not.toHaveBeenCalled();

    await wrapper.get(`[data-testid="professional-select-${PROFESSIONAL_B}"]`).trigger('click');
    await wrapper.get(`[data-testid="professional-select-${PROFESSIONAL_A}"]`).trigger('click');
    await flushPromises();
    expectButtonDisabled(wrapper, 'start-event');
    expect(wrapper.find(warning).exists()).toBe(true);
  });

  it('bloqueia o início quando um seletor em massa altera a seleção', async () => {
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);

    await button(wrapper, 'TODOS')!.trigger('click');
    await flushPromises();

    expectButtonDisabled(wrapper, 'start-event');
    expect(wrapper.find('[data-testid="unsaved-selection-warning"]').exists()).toBe(true);
  });

  it('sincroniza a seleção após salvar e libera novamente o início', async () => {
    mocks.savePreparation.mockResolvedValue({
      ...structuredClone(preparation),
      selecionados: [PROFESSIONAL_A, PROFESSIONAL_B],
      totais: { ...preparation.totais, selecionados: 2 },
    });
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);

    await wrapper.get(`[data-testid="professional-select-${PROFESSIONAL_B}"]`).trigger('click');
    await flushPromises();
    expectButtonDisabled(wrapper, 'start-event');

    await wrapper.get('[data-testid="save-preparation"]').trigger('click');
    await flushPromises();

    expect(mocks.savePreparation).toHaveBeenCalledWith(EVENT_ID, [PROFESSIONAL_A, PROFESSIONAL_B]);
    expect(wrapper.find('[data-testid="unsaved-selection-warning"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="event-preview-heading"]').text()).toBe('Prévia da fila');
    expectButtonEnabled(wrapper, 'start-event');
  });

  it('exibe a prévia do backend, empate, totais e confirmação sem dupla submissão', async () => {
    let resolveStart: ((value: EventPreparationRecord) => void) | undefined;
    mocks.start.mockReturnValue(
      new Promise<EventPreparationRecord>((resolve) => {
        resolveStart = resolve;
      }),
    );
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);
    expect(wrapper.text()).toContain('Prévia da fila');
    expect(wrapper.text()).toContain('Empate pendente');
    expect(wrapper.text()).toContain('3Total do cargo');
    expect(wrapper.text()).toContain('2Elegíveis');
    await wrapper.get('[data-testid="start-event"]').trigger('click');
    await flushPromises();
    const dialog = wrapper.get('[data-testid="start-event-dialog"]');
    expect(dialog.text()).toContain('serão congelados para esta sessão');
    const confirm = dialog
      .findAll('button')
      .find((candidate) => candidate.text().includes('Confirmar início'))!;
    await confirm.trigger('click');
    await confirm.trigger('click');
    expect(mocks.start).toHaveBeenCalledTimes(1);
    resolveStart!(structuredClone(preparation));
    await flushPromises();
  });

  it('fica somente leitura quando o evento está ATIVO', async () => {
    mocks.getPreparation.mockResolvedValue({
      ...structuredClone(preparation),
      evento: { ...event, dataInicio: '2026-10-06T15:30:00.000Z', status: 'ATIVO' },
    });
    const { wrapper } = await mountPage(EventPreparationPage, `/eventos/${EVENT_ID}/preparacao`);
    expect(wrapper.text()).toContain(
      'Evento iniciado. A operação da sessão será disponibilizada na próxima etapa.',
    );
    expect(wrapper.find('[data-testid="save-preparation"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="start-event"]').exists()).toBe(false);
  });
});
