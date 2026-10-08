<script setup lang="ts">
import type {
  ManualAssignmentProfessional,
  ManualAssignmentSimulation,
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
    await Promise.all([
      loadProfessionals(),
      selectedProfessional.value && selectProfessional(selectedProfessional.value),
    ]);
  } catch (failure) {
    error.value = formError(failure, 'Falha ao confirmar a atribuição.');
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
  </QPage>
</template>
