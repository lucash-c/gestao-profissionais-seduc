<script setup lang="ts">
import type { ProfessionalRecord } from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardActions,
  QCardSection,
  QDialog,
  QInput,
  QPage,
  QSpinner,
  QTable,
} from 'quasar';
import { onMounted, ref } from 'vue';

import { registryApi } from '@/services/registry.service';

const rows = ref<ProfessionalRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const search = ref('');
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
      nome: search.value,
      page: 1,
      pageSize: 100,
      usaPontuacao: true,
    });
    rows.value = result.items;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar pontuações.';
  } finally {
    loading.value = false;
  }
}
function open(row: ProfessionalRecord): void {
  selected.value = row;
  newScore.value = Number(row.pontuacao);
}
async function save(): Promise<void> {
  if (!selected.value || newScore.value === null || saving.value) return;
  saving.value = true;
  try {
    await registryApi.updateScore(selected.value.id, newScore.value);
    selected.value = null;
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao salvar pontuação.';
  } finally {
    saving.value = false;
  }
}
onMounted(load);
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
          @keyup.enter="load"
        /><QBtn outline color="primary" label="Buscar" @click="load" />
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
      <QTable v-else flat :rows="rows" :columns="columns" row-key="id" hide-pagination>
        <template #body-cell-actions="props">
          <td class="text-right">
            <QBtn flat dense color="primary" label="Alterar" @click="open(props.row)" />
          </td>
        </template>
      </QTable>
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
        <QCardSection>
          <h2>Confirmar pontuação</h2>
          <p>{{ selected?.nomeCompleto }}</p>
          <p><strong>Valor anterior:</strong> {{ selected?.pontuacao }}</p>
          <QInput
            v-model.number="newScore"
            outlined
            type="number"
            min="0"
            step="0.01"
            label="Novo valor"
          />
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
