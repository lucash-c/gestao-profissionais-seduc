import type {
  AuthenticatedUser,
  ProfessionalRecord,
  ProfessionalRelationshipsRecord,
  StaffingPlanRecord,
  UnitRecord,
  UserRecord,
  WorkPositionRecord,
} from '@seduc/contracts';
import { QInput, QLayout, QPageContainer, QPagination, QSelect, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminLayout from '@/layouts/AdminLayout.vue';
import ProfessionalsPage from '@/pages/ProfessionalsPage.vue';
import ScoresPage from '@/pages/ScoresPage.vue';
import StaffingPlansPage from '@/pages/StaffingPlansPage.vue';
import UnitsPage from '@/pages/UnitsPage.vue';
import UsersPage from '@/pages/UsersPage.vue';
import WorkPositionsPage from '@/pages/WorkPositionsPage.vue';

const mocks = vi.hoisted(() => ({
  addProfessionalPhone: vi.fn(),
  addUnitPhone: vi.fn(),
  createProfessional: vi.fn(),
  createStaffingPlan: vi.fn(),
  createUnit: vi.fn(),
  createUser: vi.fn(),
  deleteProfessional: vi.fn(),
  deleteStaffingPlan: vi.fn(),
  deleteUnit: vi.fn(),
  deleteUser: vi.fn(),
  deleteWorkPosition: vi.fn(),
  deleteProfessionalPhone: vi.fn(),
  deleteUnitPhone: vi.fn(),
  getProfessionalRelationships: vi.fn(),
  listCargos: vi.fn(),
  listProfessionals: vi.fn(),
  listPeriods: vi.fn(),
  listSegments: vi.fn(),
  listStaffingPlans: vi.fn(),
  listTiposUnidade: vi.fn(),
  listUnitOptions: vi.fn(),
  listUnits: vi.fn(),
  listUsers: vi.fn(),
  listWorkPositions: vi.fn(),
  resetPassword: vi.fn(),
  updateProfessional: vi.fn(),
  updateProfessionalPhone: vi.fn(),
  updateScore: vi.fn(),
  updateStaffingPlan: vi.fn(),
  updateUnit: vi.fn(),
  updateUnitPhone: vi.fn(),
  updateUser: vi.fn(),
  updateWorkPositionStatus: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({
  logout: vi.fn(),
  state: { status: 'authenticated', user: null as AuthenticatedUser | null },
}));

vi.mock('@/services/registry.service', () => ({ registryApi: mocks }));
vi.mock('@/stores/session.store', () => ({ sessionStore: sessionMock }));

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const UNIT_B_ID = '11111111-1111-4111-8111-222222222222';
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
    permiteMultiplosExercicios: false,
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
  exerciciosAtuais: [
    {
      id: RECORD_ID,
      postoId: RECORD_ID,
      substituiProfissional: null,
      tipo: 'SEDE',
      unidadeId: UNIT_ID,
      unidadeNome: 'EMEF Teste',
    },
    {
      id: UNIT_B_ID,
      postoId: UNIT_B_ID,
      substituiProfissional: null,
      tipo: 'SEDE',
      unidadeId: UNIT_B_ID,
      unidadeNome: 'EMEF Segunda',
    },
  ],
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
  situacaoFuncional: { descricao: 'Trabalhando na própria sede', tipo: 'PROPRIA_SEDE' },
  telefones: [],
};
const user: UserRecord = {
  ativo: true,
  email: null,
  id: RECORD_ID,
  login: 'diretor',
  nome: 'Diretor',
  perfil: 'DIRETOR',
  unidadeIds: [UNIT_ID, UNIT_B_ID],
  unidades: [
    { id: UNIT_ID, nome: 'EMEF Teste' },
    { id: UNIT_B_ID, nome: 'EMEF Segunda' },
  ],
};
const staffingPlan: StaffingPlanRecord = {
  anoLetivo: 2026,
  cargoFuncao: professional.cargoFuncao,
  cargoFuncaoId: CARGO_ID,
  id: RECORD_ID,
  observacoes: 'Planejamento anual',
  periodo: { ativo: true, id: TYPE_ID, nome: 'Integral' },
  periodoId: TYPE_ID,
  quantidade: 5,
  quantidadePostosAtivos: 5,
  segmentoEnsino: null,
  segmentoEnsinoId: null,
  unidade: { ativo: true, id: UNIT_ID, nome: unit.nome },
  unidadeId: UNIT_ID,
};
const workPosition: WorkPositionRecord = {
  anoLetivo: 2026,
  ativo: true,
  cargoFuncao: professional.cargoFuncao,
  cargoFuncaoId: CARGO_ID,
  codigo: 'PEB1-0000000001',
  disponibilidade: 'DISPONIVEL_COM_SEDE',
  estadoEstrutural: 'DISPONIVEL_COM_SEDE',
  exercicioAtual: null,
  id: RECORD_ID,
  motivosLiberacao: [],
  ocupanteAtual: null,
  periodo: staffingPlan.periodo,
  periodoId: TYPE_ID,
  quadroNecessidadeId: RECORD_ID,
  titularAtual: null,
  unidade: staffingPlan.unidade,
  unidadeId: UNIT_ID,
};
const relationships: ProfessionalRelationshipsRecord = {
  afastamentos: [
    {
      ativo: true,
      dataFim: null,
      dataInicio: '2026-01-01T12:00:00.000Z',
      id: RECORD_ID,
      observacoes: null,
      profissionalId: RECORD_ID,
      tipo: 'Licença médica',
    },
  ],
  afastamentosAtivos: [
    {
      ativo: true,
      dataFim: null,
      dataInicio: '2026-01-01T12:00:00.000Z',
      id: RECORD_ID,
      observacoes: null,
      profissionalId: RECORD_ID,
      tipo: 'Licença médica',
    },
  ],
  exerciciosAtuais: [],
  historicoExercicios: [],
  historicoSedes: [
    {
      dataFim: null,
      dataInicio: '2025-01-01T12:00:00.000Z',
      id: RECORD_ID,
      motivoFim: null,
      postoId: RECORD_ID,
      unidadeId: UNIT_ID,
      unidadeNome: 'EMEF Teste',
    },
  ],
  profissionalId: RECORD_ID,
  sedeAtual: null,
};

function setProfile(perfil: AuthenticatedUser['perfil']): void {
  sessionMock.state.user = {
    email: null,
    id: RECORD_ID,
    login: perfil.toLowerCase(),
    nome: perfil,
    perfil,
    unidades:
      perfil === 'DIRETOR' || perfil === 'SECRETARIO' ? [{ id: UNIT_ID, nome: 'EMEF Teste' }] : [],
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
  mocks.listPeriods.mockResolvedValue([staffingPlan.periodo]);
  mocks.listSegments.mockResolvedValue([]);
  mocks.listUnitOptions.mockResolvedValue([
    { id: UNIT_ID, nome: unit.nome },
    { id: UNIT_B_ID, nome: 'EMEF Segunda' },
  ]);
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
  mocks.listStaffingPlans.mockResolvedValue({
    items: [staffingPlan],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  });
  mocks.listWorkPositions.mockResolvedValue({
    items: [workPosition],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  });
  mocks.getProfessionalRelationships.mockResolvedValue(relationships);
  mocks.createUnit.mockResolvedValue(unit);
  mocks.updateUnit.mockResolvedValue(unit);
  mocks.createProfessional.mockResolvedValue(professional);
  mocks.createStaffingPlan.mockResolvedValue(staffingPlan);
  mocks.updateProfessional.mockResolvedValue(professional);
  mocks.updateScore.mockResolvedValue(professional);
  mocks.updateStaffingPlan.mockResolvedValue(staffingPlan);
  mocks.createUser.mockResolvedValue(user);
  mocks.updateUser.mockResolvedValue(user);
  mocks.resetPassword.mockResolvedValue(undefined);
  mocks.deleteProfessional.mockResolvedValue(undefined);
  mocks.deleteStaffingPlan.mockResolvedValue(undefined);
  mocks.deleteUnit.mockResolvedValue(undefined);
  mocks.deleteUser.mockResolvedValue(undefined);
  mocks.deleteWorkPosition.mockResolvedValue(undefined);
  mocks.updateWorkPositionStatus.mockResolvedValue({ ...workPosition, ativo: false });
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

  it('mantém erro de salvamento dentro do modal e associa issue ao campo', async () => {
    mocks.updateUnit.mockRejectedValueOnce(
      Object.assign(new Error('Revise os campos informados.'), {
        issues: [{ message: 'CEP deve possuir 8 dígitos.', path: 'cep' }],
      }),
    );
    const wrapper = mountPage(UnitsPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((item) => item.text().includes('Editar'))!
      .trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="save-unit"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="unit-dialog-error"]').text()).toContain(
      'Revise os campos informados.',
    );
    expect(wrapper.get('[data-testid="unit-dialog"]').text()).toContain(
      'CEP deve possuir 8 dígitos.',
    );
    expect(wrapper.find('[data-testid="units-error"]').exists()).toBe(false);
    wrapper.unmount();
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
    await wrapper
      .findAllComponents(QInput)
      .find((component) => component.props('label') === 'Nome *')!
      .setValue('EMEF Nova');
    wrapper
      .findAllComponents(QSelect)
      .find((component) => component.props('label') === 'Tipo *')!
      .vm.$emit('update:modelValue', TYPE_ID);
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
    const details = readonly.findAll('button').find((button) => button.text().includes('Detalhes'));
    await details!.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('Consultar históricos');
    expect(document.body.querySelector('[data-testid="save-professional"]')).toBeNull();
    readonly.unmount();

    setProfile('ADMINISTRADOR');
    const admin = mountPage(ProfessionalsPage);
    await flushPromises();
    const edit = admin.findAll('button').find((button) => button.text().includes('Editar'));
    await edit!.trigger('click');
    await flushPromises();
    const history = document.body.querySelector('[data-testid="readonly-placement"]');
    expect(history?.textContent).toContain('não podem ser alterados');
    expect(history?.textContent).toContain('Exercícios temporários atuais');
    expect(history?.textContent).toContain('Nenhum. A atividade atual ocorre na própria sede.');
    expect(history?.textContent).not.toContain('Sem exercício');
    expect(history?.textContent).toContain('Licença médica');
    expect(history?.textContent).toContain('Consultar históricos');
    expect(history?.querySelector('input')).toBeNull();
  });

  it('monta Pontuações com confirmação anterior/novo e Usuários com dialogs', async () => {
    const scores = mountPage(ScoresPage);
    await flushPromises();
    expect(scores.text()).toContain('O sistema não calcula pontuação');
    const change = scores.findAll('button').find((button) => button.text().includes('Alterar'));
    await change!.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('Valor anterior: 12,50');
    scores.unmount();

    const users = mountPage(UsersPage);
    await flushPromises();
    expect(users.text()).toContain('EMEF Teste, EMEF Segunda');
    await users.get('button[aria-label="Editar usuário"]').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('[data-testid="user-units-multiple"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="user-unit-single"]')).toBeNull();
    await users.get('[data-testid="new-user"]').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('[data-testid="user-dialog"]')).not.toBeNull();
    users.unmount();
  });

  it('valida 12–72 caracteres e confirmação antes de redefinir senha', async () => {
    const users = mountPage(UsersPage);
    await flushPromises();
    await users.get('button[aria-label="Redefinir senha"]').trigger('click');
    await flushPromises();
    const dialog = document.body.querySelector('[data-testid="password-dialog"]')!;
    expect(dialog.textContent).toContain('Use uma senha entre 12 e 72 caracteres');
    const inputs = dialog.querySelectorAll('input');
    inputs[0]!.value = 'a'.repeat(11);
    inputs[0]!.dispatchEvent(new Event('input'));
    inputs[1]!.value = 'a'.repeat(11);
    inputs[1]!.dispatchEvent(new Event('input'));
    await flushPromises();
    const save = document.body.querySelector('[data-testid="save-password"]') as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    inputs[0]!.value = 'a'.repeat(73);
    inputs[0]!.dispatchEvent(new Event('input'));
    inputs[1]!.value = 'a'.repeat(73);
    inputs[1]!.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(save.disabled).toBe(true);

    inputs[0]!.value = 'a'.repeat(12);
    inputs[0]!.dispatchEvent(new Event('input'));
    inputs[1]!.value = 'b'.repeat(12);
    inputs[1]!.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(save.disabled).toBe(true);

    inputs[1]!.value = 'a'.repeat(12);
    inputs[1]!.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(save.disabled).toBe(false);
    save.click();
    await flushPromises();
    expect(mocks.resetPassword).toHaveBeenCalledWith(RECORD_ID, 'a'.repeat(12));
    users.unmount();
  });

  it('mantém o erro específico de redefinição de senha dentro do modal', async () => {
    mocks.resetPassword.mockRejectedValueOnce(new Error('A senha não pode repetir a anterior.'));
    const users = mountPage(UsersPage);
    await flushPromises();
    await users.get('button[aria-label="Redefinir senha"]').trigger('click');
    await flushPromises();
    const inputs = document.body
      .querySelector('[data-testid="password-dialog"]')!
      .querySelectorAll('input');
    for (const input of inputs) {
      input.value = 'uma-senha-segura';
      input.dispatchEvent(new Event('input'));
    }
    await flushPromises();
    (document.body.querySelector('[data-testid="save-password"]') as HTMLElement).click();
    await flushPromises();

    expect(document.body.querySelector('[data-testid="password-error"]')?.textContent).toContain(
      'A senha não pode repetir a anterior.',
    );
    expect(users.find('[data-testid="users-error"]').exists()).toBe(false);
  });

  it('pagina Pontuações usando a resposta paginada da API', async () => {
    mocks.listProfessionals.mockResolvedValue({
      items: [professional],
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
    const scores = mountPage(ScoresPage);
    await flushPromises();
    const pagination = scores.findComponent(QPagination);
    expect(pagination.exists()).toBe(true);
    pagination.vm.$emit('update:modelValue', 2);
    await flushPromises();
    expect(mocks.listProfessionals).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20, usaPontuacao: true }),
    );
  });

  it('envia o filtro de cargo das Pontuações ao backend e o limpa na página 1', async () => {
    const scores = mountPage(ScoresPage);
    await flushPromises();
    const cargo = scores
      .findAllComponents(QSelect)
      .find((select) => select.props('label') === 'Cargo/função');
    expect(cargo).toBeDefined();
    cargo!.vm.$emit('update:modelValue', CARGO_ID);
    await flushPromises();
    await scores
      .findAll('button')
      .find((button) => button.text().includes('Buscar'))!
      .trigger('click');
    await flushPromises();
    expect(mocks.listProfessionals).toHaveBeenLastCalledWith(
      expect.objectContaining({ cargoFuncaoId: CARGO_ID, page: 1, usaPontuacao: true }),
    );

    cargo!.vm.$emit('update:modelValue', null);
    await flushPromises();
    await scores
      .findAll('button')
      .find((button) => button.text().includes('Buscar'))!
      .trigger('click');
    await flushPromises();
    expect(mocks.listProfessionals).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ cargoFuncaoId: CARGO_ID }),
    );
  });

  it('envia cadastro e coleção final de telefones em um único PATCH', async () => {
    const unitWrapper = mountPage(UnitsPage);
    await flushPromises();
    const editUnit = unitWrapper
      .findAll('button')
      .find((button) => button.text().includes('Editar'));
    await editUnit!.trigger('click');
    await flushPromises();
    (document.body.querySelector('[data-testid="save-unit"]') as HTMLElement).click();
    await flushPromises();
    expect(mocks.updateUnit).toHaveBeenCalledWith(
      UNIT_ID,
      expect.objectContaining({ telefones: [] }),
    );
    expect(mocks.addUnitPhone).not.toHaveBeenCalled();
    expect(mocks.updateUnitPhone).not.toHaveBeenCalled();
    expect(mocks.deleteUnitPhone).not.toHaveBeenCalled();
    unitWrapper.unmount();

    const professionalWrapper = mountPage(ProfessionalsPage);
    await flushPromises();
    const editProfessional = professionalWrapper
      .findAll('button')
      .find((button) => button.text().includes('Editar'));
    await editProfessional!.trigger('click');
    await flushPromises();
    (document.body.querySelector('[data-testid="save-professional"]') as HTMLElement).click();
    await flushPromises();
    expect(mocks.updateProfessional).toHaveBeenCalledWith(
      RECORD_ID,
      expect.objectContaining({ telefones: [] }),
    );
    expect(mocks.addProfessionalPhone).not.toHaveBeenCalled();
    expect(mocks.updateProfessionalPhone).not.toHaveBeenCalled();
    expect(mocks.deleteProfessionalPhone).not.toHaveBeenCalled();
  });

  it('exibe menus de Usuários e Pontuações somente para Admin', () => {
    setProfile('ADMINISTRADOR');
    const admin = mountPage(AdminLayout);
    expect(admin.find('[data-testid="users-menu"]').exists()).toBe(true);
    expect(admin.find('[data-testid="scores-menu"]').exists()).toBe(true);
    expect(admin.find('[data-testid="staffing-plans-menu"]').exists()).toBe(true);
    expect(admin.find('[data-testid="work-positions-menu"]').exists()).toBe(true);
    expect(admin.find('[data-testid="audit-menu"]').exists()).toBe(true);
    expect(admin.find('[data-testid="correction-menu"]').exists()).toBe(false);
    expect(admin.text()).toContain('Cadastros');
    expect(admin.text()).toContain('Administração');
    expect(admin.text()).not.toMatch(/ETAPA \d+/i);
    admin.unmount();

    setProfile('OPERADOR');
    const operator = mountPage(AdminLayout);
    expect(operator.find('[data-testid="users-menu"]').exists()).toBe(false);
    expect(operator.find('[data-testid="scores-menu"]').exists()).toBe(false);
    expect(operator.find('[data-testid="staffing-plans-menu"]').exists()).toBe(true);
    expect(operator.find('[data-testid="work-positions-menu"]').exists()).toBe(true);
    expect(operator.find('[data-testid="audit-menu"]').exists()).toBe(false);
    expect(operator.find('[data-testid="correction-menu"]').exists()).toBe(false);
  });
});

describe('Etapa 4 Quasar pages', () => {
  it('exibe loading, vazio, erro, filtros e paginação do quadro', async () => {
    let resolveList!: (value: unknown) => void;
    mocks.listStaffingPlans.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    const loadingWrapper = mountPage(StaffingPlansPage);
    expect(loadingWrapper.find('[data-testid="staffing-plans-loading"]').exists()).toBe(true);
    resolveList({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    await flushPromises();
    expect(loadingWrapper.find('[data-testid="staffing-plans-empty"]').exists()).toBe(true);
    loadingWrapper.unmount();

    mocks.listStaffingPlans.mockRejectedValueOnce(new Error('Falha controlada do quadro'));
    const errorWrapper = mountPage(StaffingPlansPage);
    await flushPromises();
    expect(errorWrapper.get('[data-testid="staffing-plans-error"]').text()).toContain(
      'Falha controlada do quadro',
    );
    errorWrapper.unmount();

    mocks.listStaffingPlans.mockResolvedValue({
      items: [staffingPlan],
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
    const wrapper = mountPage(StaffingPlansPage);
    await flushPromises();
    await wrapper.get('[data-testid="staffing-filter"]').trigger('click');
    const pagination = wrapper.findComponent(QPagination);
    pagination.vm.$emit('update:modelValue', 2);
    await flushPromises();
    expect(mocks.listStaffingPlans).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20 }),
    );
  });

  it('mostra impacto da quantidade e bloqueia dupla submissão do quadro', async () => {
    let finish!: (value: StaffingPlanRecord) => void;
    mocks.updateStaffingPlan.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mountPage(StaffingPlansPage);
    await flushPromises();
    const adjust = wrapper.findAll('button').find((button) => button.text().includes('Ajustar'));
    await adjust!.trigger('click');
    await flushPromises();
    const quantityField = document.body.querySelector('[data-testid="staffing-quantity"]')!;
    const quantity = (
      quantityField instanceof HTMLInputElement
        ? quantityField
        : quantityField.querySelector('input')
    ) as HTMLInputElement;
    expect(quantity.min).toBe('0');
    quantity.value = '0';
    quantity.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();
    expect(document.body.textContent).toContain('Serão inativados 5 postos livres.');
    const save = document.body.querySelector('[data-testid="save-staffing-plan"]') as HTMLElement;
    save.click();
    save.click();
    await flushPromises();
    expect(mocks.updateStaffingPlan).toHaveBeenCalledOnce();
    expect(mocks.updateStaffingPlan).toHaveBeenCalledWith(
      RECORD_ID,
      expect.objectContaining({ quantidade: 0 }),
    );
    finish({ ...staffingPlan, quantidade: 0, quantidadePostosAtivos: 0 });
    await flushPromises();
  });

  it('exibe postos, estado textual, diálogo e respeita RBAC visual', async () => {
    mocks.listWorkPositions.mockResolvedValueOnce({
      items: [
        {
          ...workPosition,
          disponibilidade: 'DISPONIVEL_SEM_SEDE',
          estadoEstrutural: 'DISPONIVEL_SEM_SEDE',
          motivosLiberacao: ['AFASTAMENTO'],
          titularAtual: { id: RECORD_ID, matricula: 'M-1', nomeCompleto: 'Maria' },
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const admin = mountPage(WorkPositionsPage);
    await flushPromises();
    expect(admin.text()).toContain('Vaga sem sede');
    expect(admin.text()).toContain('titular afastado');
    expect(admin.text()).toContain('Sem ocupante no momento');
    expect(admin.get('[data-testid="positions-summary"]').text()).toContain('1 posto encontrado');
    expect(mocks.listWorkPositions).toHaveBeenCalledWith(
      expect.not.objectContaining({ ativo: true }),
    );
    await admin.get('[data-testid="position-status-action"]').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('[data-testid="position-status-dialog"]')).not.toBeNull();
    (document.body.querySelector('[data-testid="confirm-position-status"]') as HTMLElement).click();
    await flushPromises();
    expect(mocks.updateWorkPositionStatus).toHaveBeenCalledWith(RECORD_ID, false);
    admin.unmount();

    setProfile('OPERADOR');
    const operator = mountPage(WorkPositionsPage);
    await flushPromises();
    expect(operator.text()).toContain('Vaga com sede');
    expect(operator.find('[data-testid="position-status-action"]').exists()).toBe(false);
  });

  it('exibe estados vazio e erro dos postos', async () => {
    mocks.listWorkPositions.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    const empty = mountPage(WorkPositionsPage);
    await flushPromises();
    expect(empty.find('[data-testid="work-positions-empty"]').exists()).toBe(true);
    empty.unmount();

    mocks.listWorkPositions.mockRejectedValueOnce(new Error('Falha controlada dos postos'));
    const error = mountPage(WorkPositionsPage);
    await flushPromises();
    expect(error.get('[data-testid="work-positions-error"]').text()).toContain(
      'Falha controlada dos postos',
    );
  });
});
