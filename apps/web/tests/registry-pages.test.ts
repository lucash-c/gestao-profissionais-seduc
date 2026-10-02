import type {
  AuthenticatedUser,
  ProfessionalRecord,
  UnitRecord,
  UserRecord,
} from '@seduc/contracts';
import { QLayout, QPageContainer, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminLayout from '@/layouts/AdminLayout.vue';
import ProfessionalsPage from '@/pages/ProfessionalsPage.vue';
import ScoresPage from '@/pages/ScoresPage.vue';
import UnitsPage from '@/pages/UnitsPage.vue';
import UsersPage from '@/pages/UsersPage.vue';

const mocks = vi.hoisted(() => ({
  addProfessionalPhone: vi.fn(),
  addUnitPhone: vi.fn(),
  createProfessional: vi.fn(),
  createUnit: vi.fn(),
  createUser: vi.fn(),
  deleteProfessionalPhone: vi.fn(),
  deleteUnitPhone: vi.fn(),
  listCargos: vi.fn(),
  listProfessionals: vi.fn(),
  listTiposUnidade: vi.fn(),
  listUnitOptions: vi.fn(),
  listUnits: vi.fn(),
  listUsers: vi.fn(),
  resetPassword: vi.fn(),
  updateProfessional: vi.fn(),
  updateProfessionalPhone: vi.fn(),
  updateScore: vi.fn(),
  updateUnit: vi.fn(),
  updateUnitPhone: vi.fn(),
  updateUser: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({
  logout: vi.fn(),
  state: { status: 'authenticated', user: null as AuthenticatedUser | null },
}));

vi.mock('@/services/registry.service', () => ({ registryApi: mocks }));
vi.mock('@/stores/session.store', () => ({ sessionStore: sessionMock }));

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const TYPE_ID = '22222222-2222-4222-8222-222222222222';
const CARGO_ID = '33333333-3333-4333-8333-333333333333';
const RECORD_ID = '44444444-4444-4444-8444-444444444444';

const unit: UnitRecord = {
  ativo: true,
  bairro: null,
  cep: null,
  cidade: 'Americana',
  codigoInep: null,
  complemento: null,
  endereco: null,
  id: UNIT_ID,
  nome: 'EMEF Teste',
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
  exercicioAtual: {
    postoId: RECORD_ID,
    tipo: 'SEDE',
    unidadeId: UNIT_ID,
    unidadeNome: 'EMEF Teste',
  },
  id: RECORD_ID,
  matricula: 'M-1',
  nomeCompleto: 'Professora Teste',
  numero: null,
  numeroFilhos: 0,
  observacoes: null,
  permuta: false,
  pontuacao: '12.50',
  remocao: false,
  sedeAtual: { postoId: RECORD_ID, unidadeId: UNIT_ID, unidadeNome: 'EMEF Teste' },
  telefones: [],
};
const user: UserRecord = {
  ativo: true,
  email: null,
  id: RECORD_ID,
  login: 'operador',
  nome: 'Operador',
  perfil: 'OPERADOR',
  unidade: null,
  unidadeId: null,
};

function setProfile(perfil: AuthenticatedUser['perfil']): void {
  sessionMock.state.user = {
    email: null,
    id: RECORD_ID,
    login: perfil.toLowerCase(),
    nome: perfil,
    perfil,
    unidade:
      perfil === 'DIRETOR' || perfil === 'SECRETARIO' ? { id: UNIT_ID, nome: 'EMEF Teste' } : null,
  };
}

function mountPage(component: object) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ component: { template: '<div />' }, path: '/:pathMatch(.*)*' }],
  });
  const target =
    component === AdminLayout
      ? component
      : {
          components: { QLayout, QPageContainer, TargetPage: component },
          template: '<QLayout><QPageContainer><TargetPage /></QPageContainer></QLayout>',
        };
  return mount(target, {
    attachTo: document.body,
    global: { plugins: [Quasar, router], stubs: { teleport: true } },
  });
}

beforeEach(() => {
  setProfile('ADMINISTRADOR');
  mocks.listTiposUnidade.mockResolvedValue([unit.tipoUnidade]);
  mocks.listCargos.mockResolvedValue([professional.cargoFuncao]);
  mocks.listUnitOptions.mockResolvedValue([{ id: UNIT_ID, nome: unit.nome }]);
  mocks.listUnits.mockResolvedValue({
    items: [unit],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  });
  mocks.listProfessionals.mockResolvedValue({
    items: [professional],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  });
  mocks.listUsers.mockResolvedValue({
    items: [user],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  });
  mocks.createUnit.mockResolvedValue(unit);
  mocks.updateUnit.mockResolvedValue(unit);
  mocks.createProfessional.mockResolvedValue(professional);
  mocks.updateProfessional.mockResolvedValue(professional);
  mocks.updateScore.mockResolvedValue(professional);
  mocks.createUser.mockResolvedValue(user);
  mocks.updateUser.mockResolvedValue(user);
  mocks.resetPassword.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('Etapa 3 Quasar pages', () => {
  it('exibe loading, vazio e filtros/paginação de unidades', async () => {
    let resolveList!: (value: unknown) => void;
    mocks.listUnits.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    const wrapper = mountPage(UnitsPage);
    expect(wrapper.find('[data-testid="units-loading"]').exists()).toBe(true);
    resolveList({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    await flushPromises();
    expect(wrapper.find('[data-testid="units-empty"]').exists()).toBe(true);
    await wrapper.get('[data-testid="unit-search"]').setValue('Norte');
    await wrapper.get('[data-testid="unit-search"]').trigger('keyup.enter');
    await flushPromises();
    expect(mocks.listUnits).toHaveBeenLastCalledWith(
      expect.objectContaining({ nome: 'Norte', page: 1 }),
    );
  });

  it('mostra erros e bloqueia dupla submissão no diálogo de unidade', async () => {
    mocks.listUnits.mockRejectedValueOnce(new Error('Falha controlada'));
    const errorWrapper = mountPage(UnitsPage);
    await flushPromises();
    expect(errorWrapper.get('[data-testid="units-error"]').text()).toContain('Falha controlada');
    errorWrapper.unmount();

    let finish!: (value: UnitRecord) => void;
    mocks.createUnit.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mountPage(UnitsPage);
    await flushPromises();
    await wrapper.get('[data-testid="new-unit"]').trigger('click');
    await flushPromises();
    const save = document.body.querySelector('[data-testid="save-unit"]') as HTMLElement;
    save.click();
    save.click();
    await flushPromises();
    expect(mocks.createUnit).toHaveBeenCalledOnce();
    finish(unit);
    await flushPromises();
  });

  it('aplica UX de leitura ao Operador e não oferece sede/exercício editáveis', async () => {
    setProfile('OPERADOR');
    const readonly = mountPage(ProfessionalsPage);
    await flushPromises();
    expect(readonly.text()).toContain('Professora Teste');
    expect(readonly.find('[data-testid="new-professional"]').exists()).toBe(false);
    expect(readonly.text()).not.toContain('Editar');
    readonly.unmount();

    setProfile('ADMINISTRADOR');
    const admin = mountPage(ProfessionalsPage);
    await flushPromises();
    const edit = admin.findAll('button').find((button) => button.text().includes('Editar'));
    await edit!.trigger('click');
    await flushPromises();
    const history = document.body.querySelector('[data-testid="readonly-placement"]');
    expect(history?.textContent).toContain('não podem ser alterados');
    expect(history?.querySelector('input')).toBeNull();
  });

  it('monta Pontuações com confirmação anterior/novo e Usuários com dialogs', async () => {
    const scores = mountPage(ScoresPage);
    await flushPromises();
    expect(scores.text()).toContain('O sistema não calcula pontuação');
    const change = scores.findAll('button').find((button) => button.text().includes('Alterar'));
    await change!.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('Valor anterior: 12.50');
    scores.unmount();

    const users = mountPage(UsersPage);
    await flushPromises();
    await users.get('[data-testid="new-user"]').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('[data-testid="user-dialog"]')).not.toBeNull();
    users.unmount();
  });

  it('exibe menus de Usuários e Pontuações somente para Admin', () => {
    setProfile('ADMINISTRADOR');
    const admin = mountPage(AdminLayout);
    expect(admin.find('[data-testid="users-menu"]').exists()).toBe(true);
    expect(admin.find('[data-testid="scores-menu"]').exists()).toBe(true);
    admin.unmount();

    setProfile('OPERADOR');
    const operator = mountPage(AdminLayout);
    expect(operator.find('[data-testid="users-menu"]').exists()).toBe(false);
    expect(operator.find('[data-testid="scores-menu"]').exists()).toBe(false);
  });
});
