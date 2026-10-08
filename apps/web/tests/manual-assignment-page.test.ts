import type {
  AuthenticatedUser,
  ManualAssignmentProfessional,
  ManualExerciseEndSimulation,
  ManualSeatRemovalSimulation,
} from '@seduc/contracts';
import { QLayout, QPageContainer, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ManualAssignmentPage from '@/pages/ManualAssignmentPage.vue';

const mocks = vi.hoisted(() => ({
  configuration: vi.fn(),
  confirm: vi.fn(),
  confirmExerciseEnd: vi.fn(),
  confirmSeatRemoval: vi.fn(),
  listPositions: vi.fn(),
  listProfessionals: vi.fn(),
  simulate: vi.fn(),
  simulateExerciseEnd: vi.fn(),
  simulateSeatRemoval: vi.fn(),
  updateConfiguration: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({
  state: { status: 'authenticated', user: null as AuthenticatedUser | null },
}));

vi.mock('@/services/manual-assignment.service', () => ({ manualAssignmentApi: mocks }));
vi.mock('@/stores/session.store', () => ({ sessionStore: sessionMock }));

const PROFESSIONAL_ID = '11111111-1111-4111-8111-111111111111';
const PLACEMENT_ID = '22222222-2222-4222-8222-222222222222';
const EXERCISE_ID = '33333333-3333-4333-8333-333333333333';
const POSITION_ID = '44444444-4444-4444-8444-444444444444';
const UNIT_ID = '55555555-5555-4555-8555-555555555555';

function user(profile: AuthenticatedUser['perfil']): AuthenticatedUser {
  return {
    email: `${profile.toLowerCase()}@seduc.test`,
    id: '66666666-6666-4666-8666-666666666666',
    login: profile.toLowerCase(),
    nome: profile,
    perfil: profile,
    unidades: [],
  };
}

function professional(
  input: { exercise?: boolean; seat?: boolean } = {},
): ManualAssignmentProfessional {
  return {
    afastado: false,
    ativo: true,
    cargoFuncao: { ativo: true, id: '77777777-7777-4777-8777-777777777777', nome: 'Professor' },
    cargoFuncaoId: '77777777-7777-4777-8777-777777777777',
    exerciciosAtuais: input.exercise
      ? [
          {
            dataFim: null,
            dataInicio: '2026-10-08T12:00:00.000Z',
            id: EXERCISE_ID,
            observacoes: null,
            postoId: POSITION_ID,
            substituiProfissional: null,
            tipo: 'SUBSTITUICAO',
            unidadeId: UNIT_ID,
            unidadeNome: 'EMEF Exercício',
          },
        ]
      : [],
    id: PROFESSIONAL_ID,
    matricula: 'M-11',
    nomeCompleto: 'João Administrativo',
    sedeAtual: input.seat
      ? {
          dataFim: null,
          dataInicio: '2020-01-01T12:00:00.000Z',
          id: PLACEMENT_ID,
          motivoFim: null,
          postoId: POSITION_ID,
          unidadeId: UNIT_ID,
          unidadeNome: 'EMEF Sede',
        }
      : null,
  };
}

const seatRemovalSimulation: ManualSeatRemovalSimulation = {
  exercicioAtual: null,
  ocupanteAtual: null,
  profissional: { id: PROFESSIONAL_ID, matricula: 'M-11', nomeCompleto: 'João Administrativo' },
  sedeAtual: {
    lotacaoSedeId: PLACEMENT_ID,
    postoCodigo: 'P-01',
    postoId: POSITION_ID,
    unidadeId: UNIT_ID,
    unidadeNome: 'EMEF Sede',
  },
};

const exerciseEndSimulation: ManualExerciseEndSimulation = {
  exercicioAtual: {
    id: EXERCISE_ID,
    postoCodigo: 'P-02',
    postoId: POSITION_ID,
    tipo: 'SUBSTITUICAO',
    unidadeId: UNIT_ID,
    unidadeNome: 'EMEF Exercício',
  },
  impedimento: null,
  podeConfirmar: true,
  postoOcupado: {
    postoCodigo: 'P-02',
    postoId: POSITION_ID,
    unidadeId: UNIT_ID,
    unidadeNome: 'EMEF Exercício',
  },
  profissional: { id: PROFESSIONAL_ID, matricula: 'M-11', nomeCompleto: 'João Administrativo' },
  sedeAtual: null,
  situacaoPrevista: 'PERMANECE_SEM_SEDE',
};

function mountPage() {
  return mount(
    {
      components: { QLayout, QPageContainer, TargetPage: ManualAssignmentPage },
      template: '<QLayout><QPageContainer><TargetPage /></QPageContainer></QLayout>',
    },
    { attachTo: document.body, global: { plugins: [Quasar], stubs: { teleport: true } } },
  );
}

async function select(wrapper: ReturnType<typeof mountPage>): Promise<void> {
  const button = wrapper.findAll('button').find((item) => item.text().includes('Selecionar'));
  await button!.trigger('click');
  await flushPromises();
}

function dialogButton(testId: string, label: string): HTMLElement {
  return [...document.querySelectorAll(`[data-testid="${testId}"] button`)].find((button) =>
    button.textContent?.includes(label),
  ) as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.state.user = user('ADMINISTRADOR');
  mocks.configuration.mockResolvedValue({ habilitada: true });
  mocks.listProfessionals.mockResolvedValue({
    items: [professional({ exercise: true, seat: true })],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  });
  mocks.listPositions.mockResolvedValue([]);
  mocks.simulateSeatRemoval.mockResolvedValue(structuredClone(seatRemovalSimulation));
  mocks.simulateExerciseEnd.mockResolvedValue(structuredClone(exerciseEndSimulation));
  mocks.confirmSeatRemoval.mockResolvedValue(undefined);
  mocks.confirmExerciseEnd.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ações administrativas da atribuição manual', () => {
  it('mostra ações aplicáveis somente ao Administrador e confirma cada operação separadamente', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await select(wrapper);

    expect(wrapper.find('[data-testid="manual-administrative-actions"]').exists()).toBe(true);
    await wrapper.get('[data-testid="manual-remove-seat"]').trigger('click');
    await flushPromises();
    expect(mocks.simulateSeatRemoval).toHaveBeenCalledWith({
      lotacaoSedeId: PLACEMENT_ID,
      profissionalId: PROFESSIONAL_ID,
    });
    expect(document.body.textContent).toContain('A sede ficará sem titular');
    dialogButton('manual-remove-seat-confirmation', 'Confirmar retirada').click();
    await flushPromises();
    expect(mocks.confirmSeatRemoval).toHaveBeenCalledWith({
      lotacaoSedeId: PLACEMENT_ID,
      profissionalId: PROFESSIONAL_ID,
    });

    await wrapper.get('[data-testid="manual-end-exercise"]').trigger('click');
    await flushPromises();
    expect(mocks.simulateExerciseEnd).toHaveBeenCalledWith({
      exercicioId: EXERCISE_ID,
      profissionalId: PROFESSIONAL_ID,
    });
    expect(document.body.textContent).toContain('Situação prevista:');
    dialogButton('manual-end-exercise-confirmation', 'Confirmar encerramento').click();
    await flushPromises();
    expect(mocks.confirmExerciseEnd).toHaveBeenCalledWith({
      exercicioId: EXERCISE_ID,
      profissionalId: PROFESSIONAL_ID,
    });
  });

  it('omite cada ação sem o vínculo correspondente e oculta ambas para Diretor', async () => {
    mocks.listProfessionals.mockResolvedValueOnce({
      items: [professional({ seat: true })],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const withoutExercise = mountPage();
    await flushPromises();
    await select(withoutExercise);
    expect(withoutExercise.find('[data-testid="manual-remove-seat"]').exists()).toBe(true);
    expect(withoutExercise.find('[data-testid="manual-end-exercise"]').exists()).toBe(false);
    withoutExercise.unmount();

    mocks.listProfessionals.mockResolvedValueOnce({
      items: [professional({ exercise: true })],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const withoutSeat = mountPage();
    await flushPromises();
    await select(withoutSeat);
    expect(withoutSeat.find('[data-testid="manual-remove-seat"]').exists()).toBe(false);
    expect(withoutSeat.find('[data-testid="manual-end-exercise"]').exists()).toBe(true);
    withoutSeat.unmount();

    sessionMock.state.user = user('DIRETOR');
    mocks.listProfessionals.mockResolvedValueOnce({
      items: [professional({ exercise: true, seat: true })],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const director = mountPage();
    await flushPromises();
    await select(director);
    expect(director.find('[data-testid="manual-administrative-actions"]').exists()).toBe(false);
  });
});
