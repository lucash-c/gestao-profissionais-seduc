<script setup lang="ts">
import type {
  LookupRecord,
  WorkPositionRecord,
  WorkPositionStructuralState,
} from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardActions,
  QCardSection,
  QChip,
  QDialog,
  QInput,
  QPage,
  QPagination,
  QSelect,
  QSpinner,
  QTable,
  QTd,
  QTr,
} from 'quasar';
import { computed, onMounted, ref } from 'vue';

import { registryApi } from '@/services/registry.service';
import { sessionStore } from '@/stores/session.store';

const rows = ref<WorkPositionRecord[]>([]);
const units = ref<LookupRecord[]>([]);
const cargos = ref<LookupRecord[]>([]);
const periods = ref<LookupRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const page = ref(1);
const totalPages = ref(1);
const unitFilter = ref<string | null>(null);
const yearFilter = ref<number | null>(null);
const cargoFilter = ref<string | null>(null);
const periodFilter = ref<string | null>(null);
const statusFilter = ref<'active' | 'inactive' | 'all'>('active');
const selected = ref<WorkPositionRecord | null>(null);
const canManage = computed(() => sessionStore.state.user?.perfil === 'ADMINISTRADOR');
const columns = [
  { align: 'left' as const, field: 'id', label: 'Posto', name: 'posto' },
  { align: 'left' as const, field: 'unidade', label: 'Unidade', name: 'unidade' },
  { align: 'left' as const, field: 'cargoFuncao', label: 'Cargo/função', name: 'cargo' },
  { align: 'left' as const, field: 'periodo', label: 'Período', name: 'periodo' },
  { align: 'left' as const, field: 'anoLetivo', label: 'Ano', name: 'ano' },
  { align: 'left' as const, field: 'titularAtual', label: 'Titular atual', name: 'titular' },
  { align: 'left' as const, field: 'ocupanteAtual', label: 'Ocupante atual', name: 'ocupante' },
  { align: 'left' as const, field: 'estadoEstrutural', label: 'Estado estrutural', name: 'estado' },
  { align: 'left' as const, field: 'ativo', label: 'Status', name: 'ativo' },
  { align: 'right' as const, field: 'id', label: 'Ações', name: 'actions' },
];
const stateLabels = {
  DISPONIVEL_COM_SEDE: 'Com sede: disponível',
  INATIVO: 'Inativo',
  OCUPADO_COM_SEDE: 'Com sede: ocupado',
} as const;

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await registryApi.listWorkPositions({
      ...(yearFilter.value === null ? {} : { anoLetivo: yearFilter.value }),
      ...(statusFilter.value === 'all' ? {} : { ativo: statusFilter.value === 'active' }),
      ...(cargoFilter.value ? { cargoFuncaoId: cargoFilter.value } : {}),
      page: page.value,
      pageSize: 20,
      ...(periodFilter.value ? { periodoId: periodFilter.value } : {}),
      ...(unitFilter.value ? { unidadeId: unitFilter.value } : {}),
    });
    rows.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar os postos.';
  } finally {
    loading.value = false;
  }
}

async function loadOptions(): Promise<void> {
  try {
    [units.value, cargos.value, periods.value] = await Promise.all([
      registryApi.listUnitOptions(),
      registryApi.listCargos(),
      registryApi.listPeriods(),
    ]);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar os domínios.';
  }
}

function stateLabel(state: WorkPositionStructuralState): string {
  return stateLabels[state];
}

async function confirmStatus(): Promise<void> {
  if (!selected.value || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await registryApi.updateWorkPositionStatus(selected.value.id, !selected.value.ativo);
    selected.value = null;
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao alterar o posto.';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadOptions(), load()]);
});
</script>

<template>
  <QPage class="registry-page" data-testid="work-positions-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Estrutura</p>
        <h1>Postos de Trabalho / Vagas</h1>
        <p class="heading-note">
          Consulta estrutural dos postos. Fluxos de movimentação não fazem parte desta etapa.
        </p>
      </div>
    </div>
    <QCard flat bordered>
      <QCardSection class="filter-grid">
        <QSelect
          v-model="unitFilter"
          outlined
          dense
          clearable
          emit-value
          map-options
          option-label="nome"
          option-value="id"
          :options="units"
          label="Unidade"
        />
        <QInput v-model.number="yearFilter" outlined dense clearable type="number" label="Ano" />
        <QSelect
          v-model="cargoFilter"
          outlined
          dense
          clearable
          emit-value
          map-options
          option-label="nome"
          option-value="id"
          :options="cargos"
          label="Cargo/função"
        />
        <QSelect
          v-model="periodFilter"
          outlined
          dense
          clearable
          emit-value
          map-options
          option-label="nome"
          option-value="id"
          :options="periods"
          label="Período"
        />
        <QSelect
          v-model="statusFilter"
          outlined
          dense
          emit-value
          map-options
          :options="[
            { label: 'Ativos', value: 'active' },
            { label: 'Inativos', value: 'inactive' },
            { label: 'Todos', value: 'all' },
          ]"
          label="Status"
        />
        <QBtn
          data-testid="positions-filter"
          outline
          color="primary"
          label="Filtrar"
          @click="
            page = 1;
            load();
          "
        />
      </QCardSection>
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="work-positions-error">{{
        error
      }}</QBanner>
      <div v-if="loading" class="registry-state" data-testid="work-positions-loading">
        <QSpinner color="primary" size="36px" /> Carregando postos…
      </div>
      <div v-else-if="rows.length === 0" class="registry-state" data-testid="work-positions-empty">
        Nenhum posto encontrado.
      </div>
      <QTable v-else flat :rows="rows" :columns="columns" row-key="id" hide-pagination>
        <template #body="props">
          <QTr :props="props">
            <QTd key="posto" :props="props">{{
              props.row.codigo || `Posto ${props.row.id.slice(0, 8)}`
            }}</QTd>
            <QTd key="unidade" :props="props">{{ props.row.unidade.nome }}</QTd>
            <QTd key="cargo" :props="props">{{ props.row.cargoFuncao.nome }}</QTd>
            <QTd key="periodo" :props="props">{{ props.row.periodo.nome }}</QTd>
            <QTd key="ano" :props="props">{{ props.row.anoLetivo }}</QTd>
            <QTd key="titular" :props="props">{{
              props.row.titularAtual?.nomeCompleto || 'Sem titular'
            }}</QTd>
            <QTd key="ocupante" :props="props">{{
              props.row.ocupanteAtual?.nomeCompleto || 'Sem ocupante'
            }}</QTd>
            <QTd key="estado" :props="props"
              ><QChip dense>{{ stateLabel(props.row.estadoEstrutural) }}</QChip></QTd
            >
            <QTd key="ativo" :props="props">{{ props.row.ativo ? 'Ativo' : 'Inativo' }}</QTd>
            <QTd key="actions" :props="props"
              ><QBtn
                v-if="canManage"
                data-testid="position-status-action"
                flat
                dense
                color="primary"
                :label="props.row.ativo ? 'Inativar' : 'Reativar'"
                @click="selected = props.row"
            /></QTd>
          </QTr>
        </template>
      </QTable>
      <QCardActions v-if="!loading && rows.length" align="center"
        ><QPagination
          v-model="page"
          data-testid="positions-pagination"
          :max="totalPages"
          @update:model-value="load"
      /></QCardActions>
    </QCard>

    <QDialog
      :model-value="Boolean(selected)"
      @update:model-value="
        (open) => {
          if (!open) selected = null;
        }
      "
    >
      <QCard class="registry-dialog compact" data-testid="position-status-dialog">
        <QCardSection
          ><h2>{{ selected?.ativo ? 'Inativar posto' : 'Reativar posto' }}</h2>
          <p>
            {{
              selected?.ativo
                ? 'A inativação só será concluída se o posto estiver livre.'
                : 'A reativação também ajustará a quantidade do quadro.'
            }}
          </p></QCardSection
        >
        <QCardActions align="right"
          ><QBtn flat label="Cancelar" @click="selected = null" /><QBtn
            data-testid="confirm-position-status"
            color="primary"
            label="Confirmar"
            :loading="saving"
            :disable="saving"
            @click="confirmStatus"
        /></QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>
