<script setup lang="ts">
import type {
  ManualAssignmentProfessional,
  ManualAssignmentSimulation,
  ManualExerciseEndSimulation,
  ManualSeatRemovalSimulation,
  WorkPositionRecord,
} from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardActions,
  QCardSection,
  QDialog,
  QInput,
  QPage,
  QPagination,
  QSpinner,
  QTable,
  QToggle,
} from 'quasar';
import { computed, onMounted, ref } from 'vue';

import ModalHeader from '@/components/ModalHeader.vue';
import StatusChip from '@/components/StatusChip.vue';
import { formError } from '@/services/form-errors';
import {
  manualAssignmentApi,
  type ManualAssignmentInput,
  type ManualExerciseEndInput,
  type ManualSeatRemovalInput,
} from '@/services/manual-assignment.service';
import { sessionStore } from '@/stores/session.store';

const enabled = ref(false);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const search = ref('');
const page = ref(1);
const totalPages = ref(1);
const professionals = ref<ManualAssignmentProfessional[]>([]);
const selectedProfessional = ref<ManualAssignmentProfessional | null>(null);
const positions = ref<WorkPositionRecord[]>([]);
const simulation = ref<ManualAssignmentSimulation | null>(null);
const pendingInput = ref<ManualAssignmentInput | null>(null);
const seatRemovalSimulation = ref<ManualSeatRemovalSimulation | null>(null);
const exerciseEndSimulation = ref<ManualExerciseEndSimulation | null>(null);
const pendingSeatRemoval = ref<ManualSeatRemovalInput | null>(null);
const pendingExerciseEnd = ref<ManualExerciseEndInput | null>(null);
const isAdmin = computed(() => sessionStore.state.user?.perfil === 'ADMINISTRADOR');

const professionalColumns = [
  { align: 'left' as const, field: 'matricula', label: 'Matrícula', name: 'matricula' },
  { align: 'left' as const, field: 'nomeCompleto', label: 'Nome', name: 'nome' },
  { align: 'left' as const, field: 'cargoFuncao', label: 'Cargo', name: 'cargo' },
  { align: 'left' as const, field: 'sedeAtual', label: 'Situação', name: 'situacao' },
  { align: 'right' as const, field: 'id', label: 'Ação', name: 'acao' },
];
const positionColumns = [
  { align: 'left' as const, field: 'codigo', label: 'Posto', name: 'codigo' },
  { align: 'left' as const, field: 'unidade', label: 'Unidade', name: 'unidade' },
  { align: 'left' as const, field: 'periodo', label: 'Período', name: 'periodo' },
  { align: 'left' as const, field: 'disponibilidade', label: 'Tipo', name: 'tipo' },
  { align: 'right' as const, field: 'id', label: 'Ação', name: 'acao' },
];

function destinationType(position: WorkPositionRecord): 'COM_SEDE' | 'SEM_SEDE' {
  return position.disponibilidade === 'DISPONIVEL_COM_SEDE' ? 'COM_SEDE' : 'SEM_SEDE';
}

function situation(professional: ManualAssignmentProfessional): string {
  if (!professional.ativo) return 'Inativo';
  if (professional.afastado) return 'Afastado';
  if (professional.exerciciosAtuais.length) {
    return `Em exercício: ${professional.exerciciosAtuais.map(({ unidadeNome }) => unidadeNome).join(', ')}`;
  }
  return professional.sedeAtual ? `Sede: ${professional.sedeAtual.unidadeNome}` : 'Sem sede';
}

function exerciseLabel(exercise: { postoCodigo?: string; unidadeNome: string }): string {
  return [exercise.postoCodigo, exercise.unidadeNome].filter(Boolean).join(' — ');
}

function exerciseOutcomeLabel(simulation: ManualExerciseEndSimulation): string {
  if (simulation.situacaoPrevista === 'RETORNA_A_PROPRIA_SEDE') {
    return 'Retorna à própria sede';
  }
  if (simulation.situacaoPrevista === 'PERMANECE_AFASTADO') return 'Permanece afastado';
  if (simulation.situacaoPrevista === 'PERMANECE_EM_OUTRO_EXERCICIO') {
    return 'Permanece em outro exercício';
  }
  return 'Permanece sem sede';
}

async function loadProfessionals(): Promise<void> {
  if (!enabled.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await manualAssignmentApi.listProfessionals(search.value, page.value);
    professionals.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
  } catch (failure) {
    error.value = formError(failure, 'Falha ao carregar profissionais.');
  } finally {
    loading.value = false;
  }
}

async function applySearch(): Promise<void> {
  page.value = 1;
  await loadProfessionals();
}

async function selectProfessional(professional: ManualAssignmentProfessional): Promise<void> {
  selectedProfessional.value = professional;
  positions.value = [];
  error.value = '';
  try {
    positions.value = await manualAssignmentApi.listPositions(professional.id);
  } catch (failure) {
    error.value = formError(failure, 'Falha ao carregar postos disponíveis.');
  }
}

async function openSimulation(position: WorkPositionRecord): Promise<void> {
  if (!selectedProfessional.value) return;
  error.value = '';
  const input: ManualAssignmentInput = {
    postoTrabalhoId: position.id,
    profissionalId: selectedProfessional.value.id,
    tipoDestino: destinationType(position),
  };
  try {
    pendingInput.value = input;
    simulation.value = await manualAssignmentApi.simulate(input);
  } catch (failure) {
    pendingInput.value = null;
    error.value = formError(failure, 'Falha ao simular a atribuição.');
  }
}

async function confirm(): Promise<void> {
  if (!pendingInput.value || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await manualAssignmentApi.confirm(pendingInput.value);
    simulation.value = null;
    pendingInput.value = null;
    await refreshSelectedProfessional();
  } catch (failure) {
    error.value = formError(failure, 'Falha ao confirmar a atribuição.');
  } finally {
    saving.value = false;
  }
}

async function refreshSelectedProfessional(): Promise<void> {
  const selectedId = selectedProfessional.value?.id;
  await loadProfessionals();
  const refreshed = professionals.value.find(({ id }) => id === selectedId) ?? null;
  selectedProfessional.value = refreshed;
  if (refreshed) await selectProfessional(refreshed);
  else positions.value = [];
}

async function openSeatRemoval(): Promise<void> {
  const professional = selectedProfessional.value;
  if (!professional?.sedeAtual) return;
  error.value = '';
  const input: ManualSeatRemovalInput = {
    lotacaoSedeId: professional.sedeAtual.id,
    profissionalId: professional.id,
  };
  try {
    pendingSeatRemoval.value = input;
    seatRemovalSimulation.value = await manualAssignmentApi.simulateSeatRemoval(input);
  } catch (failure) {
    pendingSeatRemoval.value = null;
    error.value = formError(failure, 'Falha ao simular a retirada de sede.');
  }
}

async function openExerciseEnd(exercicioId: string): Promise<void> {
  const professional = selectedProfessional.value;
  if (!professional) return;
  error.value = '';
  const input: ManualExerciseEndInput = { exercicioId, profissionalId: professional.id };
  try {
    pendingExerciseEnd.value = input;
    exerciseEndSimulation.value = await manualAssignmentApi.simulateExerciseEnd(input);
  } catch (failure) {
    pendingExerciseEnd.value = null;
    error.value = formError(failure, 'Falha ao simular o encerramento do exercício.');
  }
}

async function confirmSeatRemoval(): Promise<void> {
  if (!pendingSeatRemoval.value || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await manualAssignmentApi.confirmSeatRemoval(pendingSeatRemoval.value);
    seatRemovalSimulation.value = null;
    pendingSeatRemoval.value = null;
    await refreshSelectedProfessional();
  } catch (failure) {
    error.value = formError(failure, 'Falha ao retirar a sede.');
  } finally {
    saving.value = false;
  }
}

async function confirmExerciseEnd(): Promise<void> {
  if (!pendingExerciseEnd.value || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await manualAssignmentApi.confirmExerciseEnd(pendingExerciseEnd.value);
    exerciseEndSimulation.value = null;
    pendingExerciseEnd.value = null;
    await refreshSelectedProfessional();
  } catch (failure) {
    error.value = formError(failure, 'Falha ao encerrar o exercício.');
  } finally {
    saving.value = false;
  }
}

async function toggleEnabled(value: boolean): Promise<void> {
  saving.value = true;
  error.value = '';
  try {
    enabled.value = (await manualAssignmentApi.updateConfiguration(value)).habilitada;
    if (enabled.value) await loadProfessionals();
    else {
      professionals.value = [];
      positions.value = [];
      selectedProfessional.value = null;
    }
  } catch (failure) {
    enabled.value = !value;
    error.value = formError(failure, 'Falha ao atualizar a configuração.');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    enabled.value = (await manualAssignmentApi.configuration()).habilitada;
    if (enabled.value) await loadProfessionals();
  } catch (failure) {
    error.value = formError(failure, 'Falha ao carregar a Atribuição manual.');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <QPage class="registry-page" data-testid="manual-assignment-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Implantação</p>
        <h1>Atribuição manual</h1>
        <p class="heading-note">Vincula sede ou exercício sem criar evento ou fila.</p>
      </div>
      <QToggle
        v-if="isAdmin"
        :model-value="enabled"
        :disable="saving"
        label="Atribuição manual habilitada"
        data-testid="manual-assignment-toggle"
        @update:model-value="toggleEnabled"
      />
    </div>
    <QBanner v-if="!enabled" class="bg-orange-1 text-warning">
      A Atribuição manual está desabilitada pelo Administrador.
    </QBanner>
    <QBanner v-if="error" class="bg-red-1 text-negative">{{ error }}</QBanner>
    <QCard v-if="enabled" flat bordered>
      <QCardSection class="row q-gutter-sm">
        <QInput
          v-model="search"
          dense
          outlined
          class="col"
          label="Nome, matrícula ou cargo"
          @keyup.enter="applySearch"
        />
        <QBtn outline color="primary" label="Pesquisar" @click="applySearch" />
      </QCardSection>
      <div v-if="loading" class="registry-state"><QSpinner /> Carregando profissionais…</div>
      <div v-else-if="professionals.length === 0" class="registry-state">
        Nenhum profissional encontrado.
      </div>
      <QTable
        v-else
        flat
        :rows="professionals"
        :columns="professionalColumns"
        row-key="id"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template #body-cell-cargo="props"
          ><td>{{ props.row.cargoFuncao.nome }}</td></template
        >
        <template #body-cell-situacao="props"
          ><td>{{ situation(props.row) }}</td></template
        >
        <template #body-cell-acao="props">
          <td class="text-right">
            <QBtn flat color="primary" label="Selecionar" @click="selectProfessional(props.row)" />
          </td>
        </template>
      </QTable>
      <QCardActions v-if="professionals.length" align="center">
        <QPagination v-model="page" :max="totalPages" @update:model-value="loadProfessionals" />
      </QCardActions>
    </QCard>

    <QCard v-if="selectedProfessional" flat bordered class="q-mt-md">
      <QCardSection>
        <h2>{{ selectedProfessional.nomeCompleto }}</h2>
        <p>
          {{ selectedProfessional.cargoFuncao.nome }} ·
          <StatusChip :status="selectedProfessional.afastado ? 'AFASTADO' : 'ATIVO'" />
        </p>
      </QCardSection>
      <QCardSection
        v-if="
          isAdmin &&
          (selectedProfessional.sedeAtual || selectedProfessional.exerciciosAtuais.length > 0)
        "
        class="administrative-actions"
        data-testid="manual-administrative-actions"
      >
        <p class="eyebrow">Controle administrativo</p>
        <h3>Ações administrativas</h3>
        <p class="text-caption text-grey-7">
          Titularidade e exercício são tratados separadamente e preservam o histórico.
        </p>
        <div class="row q-gutter-sm q-mt-sm">
          <QBtn
            v-if="selectedProfessional.sedeAtual"
            outline
            color="secondary"
            icon="home_off"
            label="Retirar sede"
            data-testid="manual-remove-seat"
            @click="openSeatRemoval"
          />
          <QBtn
            v-for="exercise in selectedProfessional.exerciciosAtuais"
            :key="exercise.id"
            outline
            color="secondary"
            icon="work_off"
            label="Encerrar exercício atual"
            :aria-label="`Encerrar exercício atual em ${exercise.unidadeNome}`"
            data-testid="manual-end-exercise"
            @click="openExerciseEnd(exercise.id)"
          />
        </div>
      </QCardSection>
      <div v-if="positions.length === 0" class="registry-state">
        Nenhum posto compatível disponível.
      </div>
      <QTable
        v-else
        flat
        :rows="positions"
        :columns="positionColumns"
        row-key="id"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template #body-cell-unidade="props"
          ><td>{{ props.row.unidade.nome }}</td></template
        >
        <template #body-cell-periodo="props"
          ><td>{{ props.row.periodo.nome }}</td></template
        >
        <template #body-cell-tipo="props"
          ><td>{{ destinationType(props.row) }}</td></template
        >
        <template #body-cell-acao="props">
          <td class="text-right">
            <QBtn flat color="primary" label="Simular" @click="openSimulation(props.row)" />
          </td>
        </template>
      </QTable>
    </QCard>

    <QDialog :model-value="Boolean(simulation)" persistent>
      <QCard class="registry-dialog compact" data-testid="manual-assignment-confirmation">
        <ModalHeader
          title="Confirmar atribuição"
          :close-disabled="saving"
          @close="simulation = null"
        />
        <QCardSection class="modal-scroll-body" v-if="simulation">
          <p><strong>Profissional:</strong> {{ simulation.profissional.nomeCompleto }}</p>
          <p>
            <strong>Destino:</strong> {{ simulation.destino.codigo }} —
            {{ simulation.destino.unidade.nome }}
          </p>
          <p><strong>Vínculo:</strong> {{ simulation.tipoDestino }}</p>
          <p v-if="simulation.sedeAnterior">
            A sede anterior será encerrada: {{ simulation.sedeAnterior.unidadeNome }}.
          </p>
          <p v-if="simulation.exerciciosEncerrados.length">
            {{ simulation.exerciciosEncerrados.length }} exercício(s) ativo(s) serão encerrados.
          </p>
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Cancelar" @click="simulation = null" />
          <QBtn color="primary" label="Confirmar" :loading="saving" @click="confirm" />
        </QCardActions>
      </QCard>
    </QDialog>

    <QDialog :model-value="Boolean(seatRemovalSimulation)" persistent>
      <QCard class="registry-dialog compact" data-testid="manual-remove-seat-confirmation">
        <ModalHeader
          title="Retirar sede"
          :close-disabled="saving"
          @close="seatRemovalSimulation = null"
        />
        <QCardSection v-if="seatRemovalSimulation" class="modal-scroll-body">
          <p>
            <strong>Profissional:</strong> {{ seatRemovalSimulation.profissional.nomeCompleto }}
          </p>
          <p>
            <strong>Sede atual:</strong> {{ seatRemovalSimulation.sedeAtual.postoCodigo }} —
            {{ seatRemovalSimulation.sedeAtual.unidadeNome }}
          </p>
          <p>
            <strong>Ocupante atual do posto:</strong>
            {{ seatRemovalSimulation.ocupanteAtual?.nomeCompleto ?? 'Nenhum' }}
          </p>
          <p>
            <strong>Exercício atual:</strong>
            {{
              seatRemovalSimulation.exercicioAtual
                ? exerciseLabel(seatRemovalSimulation.exercicioAtual)
                : 'Nenhum'
            }}
          </p>
          <h3 class="q-mt-md">Depois</h3>
          <p><strong>Sede:</strong> Sem sede</p>
          <p>
            <strong>Exercício atual:</strong>
            {{
              seatRemovalSimulation.exercicioAtual
                ? `${exerciseLabel(seatRemovalSimulation.exercicioAtual)} (preservado)`
                : 'Nenhum'
            }}
          </p>
          <p><strong>Titular do posto anterior:</strong> Sem titular</p>
          <p>
            <strong>Ocupante do posto anterior:</strong>
            {{ seatRemovalSimulation.ocupanteAtual?.nomeCompleto ?? 'Nenhum' }}
          </p>
          <QBanner class="bg-blue-1 text-primary q-mt-md">
            A sede ficará sem titular e será reservada para realocação em evento formal.
          </QBanner>
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Cancelar" :disable="saving" @click="seatRemovalSimulation = null" />
          <QBtn
            color="primary"
            label="Confirmar retirada"
            :loading="saving"
            @click="confirmSeatRemoval"
          />
        </QCardActions>
      </QCard>
    </QDialog>

    <QDialog :model-value="Boolean(exerciseEndSimulation)" persistent>
      <QCard class="registry-dialog compact" data-testid="manual-end-exercise-confirmation">
        <ModalHeader
          title="Encerrar exercício atual"
          :close-disabled="saving"
          @close="exerciseEndSimulation = null"
        />
        <QCardSection v-if="exerciseEndSimulation" class="modal-scroll-body">
          <p>
            <strong>Profissional:</strong> {{ exerciseEndSimulation.profissional.nomeCompleto }}
          </p>
          <p>
            <strong>Sede oficial:</strong>
            {{
              exerciseEndSimulation.sedeAtual
                ? `${exerciseEndSimulation.sedeAtual.postoCodigo} — ${exerciseEndSimulation.sedeAtual.unidadeNome}`
                : 'Sem sede'
            }}
          </p>
          <p>
            <strong>Exercício atual:</strong>
            {{ exerciseLabel(exerciseEndSimulation.exercicioAtual) }}
          </p>
          <p>
            <strong>Posto ocupado:</strong> {{ exerciseEndSimulation.postoOcupado.postoCodigo }} —
            {{ exerciseEndSimulation.postoOcupado.unidadeNome }}
          </p>
          <h3 class="q-mt-md">Depois</h3>
          <p>
            <strong>Sede:</strong>
            {{ exerciseEndSimulation.sedeAtual ? 'Preservada' : 'Sem sede' }}
          </p>
          <p><strong>Exercício:</strong> Nenhum</p>
          <p>
            <strong>Situação prevista:</strong> {{ exerciseOutcomeLabel(exerciseEndSimulation) }}
          </p>
          <QBanner v-if="exerciseEndSimulation.impedimento" class="bg-red-1 text-negative q-mt-md">
            {{ exerciseEndSimulation.impedimento }}
          </QBanner>
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Cancelar" :disable="saving" @click="exerciseEndSimulation = null" />
          <QBtn
            color="primary"
            label="Confirmar encerramento"
            :disable="!exerciseEndSimulation?.podeConfirmar"
            :loading="saving"
            @click="confirmExerciseEnd"
          />
        </QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>
