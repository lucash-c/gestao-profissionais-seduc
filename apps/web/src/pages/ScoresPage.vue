<script setup lang="ts">
import type { LookupRecord, ProfessionalRecord } from '@seduc/contracts';
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
  QSelect,
  QSpinner,
  QTable,
} from 'quasar';
import { onMounted, ref } from 'vue';

import { registryApi } from '@/services/registry.service';
import { formError } from '@/services/form-errors';
import ModalHeader from '@/components/ModalHeader.vue';

const rows = ref<ProfessionalRecord[]>([]);
const cargos = ref<LookupRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const search = ref('');
const registrationSearch = ref('');
const cargoFilter = ref<string | null>(null);
const dialogError = ref('');
const page = ref(1);
const totalPages = ref(1);
const selected = ref<ProfessionalRecord | null>(null);
const newScore = ref<number | null>(null);
const columns = [
  { align: 'left' as const, field: 'nomeCompleto', label: 'Nome', name: 'nome' },
  { align: 'left' as const, field: 'matricula', label: 'Matrícula', name: 'matricula' },
  {
    align: 'left' as const,
    field: (row: ProfessionalRecord) => row.cargoFuncao.nome,
    label: 'Cargo',
    name: 'cargo',
  },
  { align: 'right' as const, field: 'pontuacao', label: 'Pontuação atual', name: 'pontuacao' },
  { align: 'right' as const, field: 'id', label: 'Ações', name: 'actions' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await registryApi.listProfessionals({
      ...(cargoFilter.value ? { cargoFuncaoId: cargoFilter.value } : {}),
      nome: search.value,
      matricula: registrationSearch.value,
      page: page.value,
      pageSize: 20,
      usaPontuacao: true,
    });
    rows.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar pontuações.';
  } finally {
    loading.value = false;
  }
}
async function searchScores(): Promise<void> {
  page.value = 1;
  await load();
}
function open(row: ProfessionalRecord): void {
  dialogError.value = '';
  selected.value = row;
  newScore.value = Number(row.pontuacao);
}
async function save(): Promise<void> {
  if (!selected.value || newScore.value === null || saving.value) return;
  saving.value = true;
  dialogError.value = '';
  try {
    await registryApi.updateScore(selected.value.id, newScore.value);
    selected.value = null;
    await load();
  } catch (saveError) {
    dialogError.value = formError(saveError, 'Falha ao salvar pontuação.');
  } finally {
    saving.value = false;
  }
}
function formatScore(value: string): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value));
}
onMounted(async () => {
  await Promise.all([load(), registryApi.listCargos().then((result) => (cargos.value = result))]);
});
</script>

<template>
  <QPage class="registry-page" data-testid="scores-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Administração</p>
        <h1>Pontuações</h1>
        <p class="heading-note">
          Valor oficial informado pela Administração. O sistema não calcula pontuação.
        </p>
      </div>
    </div>
    <QCard flat bordered>
      <QCardSection class="row q-gutter-sm">
        <QInput
          v-model="search"
          dense
          outlined
          label="Buscar professor"
          data-testid="score-search"
          class="col"
          @keyup.enter="searchScores"
        /><QInput
          v-model="registrationSearch"
          dense
          outlined
          label="Matrícula"
          class="col"
          @keyup.enter="searchScores"
        /><QSelect
          v-model="cargoFilter"
          dense
          outlined
          clearable
          emit-value
          map-options
          option-label="nome"
          option-value="id"
          :options="cargos"
          label="Cargo/função"
          class="col"
          data-testid="score-cargo-filter"
        /><QBtn outline color="primary" label="Buscar" @click="searchScores" />
      </QCardSection>
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="scores-error">
        {{ error }}
      </QBanner>
      <div v-if="loading" class="registry-state" data-testid="scores-loading">
        <QSpinner color="primary" size="36px" /> Carregando pontuações…
      </div>
      <div v-else-if="rows.length === 0" class="registry-state" data-testid="scores-empty">
        Nenhum professor com pontuação encontrado.
      </div>
      <QTable
        v-else
        flat
        :rows="rows"
        :columns="columns"
        row-key="id"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template #body-cell-pontuacao="props"
          ><td class="text-right">{{ formatScore(props.row.pontuacao) }}</td></template
        >
        <template #body-cell-actions="props">
          <td class="text-right">
            <QBtn flat dense color="primary" label="Alterar" @click="open(props.row)" />
          </td>
        </template>
      </QTable>
      <QCardActions v-if="!loading && rows.length" align="center">
        <QPagination
          v-model="page"
          data-testid="scores-pagination"
          :max="totalPages"
          @update:model-value="load"
        />
      </QCardActions>
    </QCard>
    <QDialog
      :model-value="Boolean(selected)"
      @update:model-value="
        (open) => {
          if (!open) selected = null;
        }
      "
    >
      <QCard class="registry-dialog compact" data-testid="score-dialog">
        <ModalHeader
          title="Confirmar pontuação"
          :close-disabled="saving"
          @close="selected = null"
        />
        <QCardSection class="modal-scroll-body">
          <p>{{ selected?.nomeCompleto }}</p>
          <p>
            <strong>Valor anterior:</strong> {{ selected ? formatScore(selected.pontuacao) : '—' }}
          </p>
          <QInput
            v-model.number="newScore"
            outlined
            type="number"
            min="0"
            step="0.01"
            label="Novo valor"
          />
          <QBanner
            v-if="dialogError"
            class="bg-red-1 text-negative q-mt-md"
            data-testid="score-dialog-error"
            >{{ dialogError }}</QBanner
          >
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Cancelar" @click="selected = null" /><QBtn
            data-testid="save-score"
            color="primary"
            label="Confirmar alteração"
            :loading="saving"
            :disable="saving"
            @click="save"
          />
        </QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>
