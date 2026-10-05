<script setup lang="ts">
import type { LookupRecord, StaffingPlanRecord } from '@seduc/contracts';
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
  QTd,
  QTr,
} from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import { registryApi } from '@/services/registry.service';
import { sessionStore } from '@/stores/session.store';

const rows = ref<StaffingPlanRecord[]>([]);
const units = ref<LookupRecord[]>([]);
const cargos = ref<LookupRecord[]>([]);
const periods = ref<LookupRecord[]>([]);
const segments = ref<LookupRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const page = ref(1);
const totalPages = ref(1);
const unitFilter = ref<string | null>(null);
const yearFilter = ref<number | null>(null);
const cargoFilter = ref<string | null>(null);
const periodFilter = ref<string | null>(null);
const segmentFilter = ref<string | null>(null);
const dialogOpen = ref(false);
const editing = ref<StaffingPlanRecord | null>(null);
const canManage = computed(() => sessionStore.state.user?.perfil === 'ADMINISTRADOR');
const form = reactive({
  anoLetivo: new Date().getFullYear(),
  cargoFuncaoId: '',
  observacoes: '',
  periodoId: '',
  quantidade: 1,
  segmentoEnsinoId: null as string | null,
  unidadeId: '',
});
const impact = computed(() => {
  if (!editing.value || form.quantidade === editing.value.quantidade) return '';
  const difference = Math.abs(form.quantidade - editing.value.quantidade);
  return form.quantidade > editing.value.quantidade
    ? `Serão criados ${difference} postos.`
    : `Serão inativados ${difference} postos livres.`;
});
const columns = [
  { align: 'left' as const, field: 'anoLetivo', label: 'Ano', name: 'ano' },
  { align: 'left' as const, field: 'unidade', label: 'Unidade', name: 'unidade' },
  { align: 'left' as const, field: 'cargoFuncao', label: 'Cargo/função', name: 'cargo' },
  { align: 'left' as const, field: 'periodo', label: 'Período', name: 'periodo' },
  { align: 'left' as const, field: 'segmentoEnsino', label: 'Segmento', name: 'segmento' },
  { align: 'right' as const, field: 'quantidade', label: 'Quantidade', name: 'quantidade' },
  {
    align: 'right' as const,
    field: 'quantidadePostosAtivos',
    label: 'Postos ativos',
    name: 'postos',
  },
  { align: 'left' as const, field: 'observacoes', label: 'Observações', name: 'observacoes' },
  { align: 'right' as const, field: 'id', label: 'Ações', name: 'actions' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await registryApi.listStaffingPlans({
      ...(yearFilter.value === null ? {} : { anoLetivo: yearFilter.value }),
      ...(cargoFilter.value ? { cargoFuncaoId: cargoFilter.value } : {}),
      page: page.value,
      pageSize: 20,
      ...(periodFilter.value ? { periodoId: periodFilter.value } : {}),
      ...(segmentFilter.value ? { segmentoEnsinoId: segmentFilter.value } : {}),
      ...(unitFilter.value ? { unidadeId: unitFilter.value } : {}),
    });
    rows.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar o quadro.';
  } finally {
    loading.value = false;
  }
}

async function loadOptions(): Promise<void> {
  try {
    [units.value, cargos.value, periods.value, segments.value] = await Promise.all([
      registryApi.listUnitOptions(),
      registryApi.listCargos(),
      registryApi.listPeriods(),
      registryApi.listSegments(),
    ]);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar os domínios.';
  }
}

function resetForm(): void {
  Object.assign(form, {
    anoLetivo: new Date().getFullYear(),
    cargoFuncaoId: '',
    observacoes: '',
    periodoId: '',
    quantidade: 1,
    segmentoEnsinoId: null,
    unidadeId: '',
  });
}

function openCreate(): void {
  editing.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(row: StaffingPlanRecord): void {
  editing.value = row;
  Object.assign(form, {
    anoLetivo: row.anoLetivo,
    cargoFuncaoId: row.cargoFuncaoId,
    observacoes: row.observacoes ?? '',
    periodoId: row.periodoId,
    quantidade: row.quantidade,
    segmentoEnsinoId: row.segmentoEnsinoId,
    unidadeId: row.unidadeId,
  });
  dialogOpen.value = true;
}

async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    if (editing.value) {
      await registryApi.updateStaffingPlan(editing.value.id, {
        observacoes: form.observacoes,
        quantidade: form.quantidade,
      });
    } else {
      await registryApi.createStaffingPlan({ ...form });
    }
    dialogOpen.value = false;
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao salvar o quadro.';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadOptions(), load()]);
});
</script>

<template>
  <QPage class="registry-page" data-testid="staffing-plans-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Estrutura</p>
        <h1>Quadro de Necessidades</h1>
      </div>
      <QBtn
        v-if="canManage"
        data-testid="new-staffing-plan"
        color="primary"
        icon="add"
        label="Nova necessidade"
        @click="openCreate"
      />
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
          v-model="segmentFilter"
          outlined
          dense
          clearable
          emit-value
          map-options
          option-label="nome"
          option-value="id"
          :options="segments"
          label="Segmento"
        />
        <QBtn
          data-testid="staffing-filter"
          outline
          color="primary"
          label="Filtrar"
          @click="
            page = 1;
            load();
          "
        />
      </QCardSection>
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="staffing-plans-error">{{
        error
      }}</QBanner>
      <div v-if="loading" class="registry-state" data-testid="staffing-plans-loading">
        <QSpinner color="primary" size="36px" /> Carregando quadro…
      </div>
      <div v-else-if="rows.length === 0" class="registry-state" data-testid="staffing-plans-empty">
        Nenhuma necessidade encontrada.
      </div>
      <QTable v-else flat :rows="rows" :columns="columns" row-key="id" hide-pagination>
        <template #body="props">
          <QTr :props="props">
            <QTd key="ano" :props="props">{{ props.row.anoLetivo }}</QTd>
            <QTd key="unidade" :props="props">{{ props.row.unidade.nome }}</QTd>
            <QTd key="cargo" :props="props">{{ props.row.cargoFuncao.nome }}</QTd>
            <QTd key="periodo" :props="props">{{ props.row.periodo.nome }}</QTd>
            <QTd key="segmento" :props="props">{{ props.row.segmentoEnsino?.nome || '—' }}</QTd>
            <QTd key="quantidade" :props="props">{{ props.row.quantidade }}</QTd>
            <QTd key="postos" :props="props">{{ props.row.quantidadePostosAtivos }}</QTd>
            <QTd key="observacoes" :props="props">{{ props.row.observacoes || '—' }}</QTd>
            <QTd key="actions" :props="props"
              ><QBtn
                v-if="canManage"
                flat
                dense
                color="primary"
                label="Ajustar"
                @click="openEdit(props.row)"
            /></QTd>
          </QTr>
        </template>
      </QTable>
      <QCardActions v-if="!loading && rows.length" align="center"
        ><QPagination
          v-model="page"
          data-testid="staffing-pagination"
          :max="totalPages"
          @update:model-value="load"
      /></QCardActions>
    </QCard>

    <QDialog v-model="dialogOpen" persistent>
      <QCard class="registry-dialog" data-testid="staffing-plan-dialog">
        <QCardSection
          ><h2>{{ editing ? 'Ajustar necessidade' : 'Nova necessidade' }}</h2></QCardSection
        >
        <QCardSection class="form-grid">
          <QSelect
            v-model="form.unidadeId"
            :disable="Boolean(editing)"
            outlined
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="units"
            label="Unidade *"
          />
          <QInput
            v-model.number="form.anoLetivo"
            :disable="Boolean(editing)"
            outlined
            type="number"
            min="1"
            label="Ano letivo *"
          />
          <QSelect
            v-model="form.cargoFuncaoId"
            :disable="Boolean(editing)"
            outlined
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="cargos"
            label="Cargo/função *"
          />
          <QSelect
            v-model="form.periodoId"
            :disable="Boolean(editing)"
            outlined
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="periods"
            label="Período *"
          />
          <QSelect
            v-model="form.segmentoEnsinoId"
            :disable="Boolean(editing)"
            outlined
            clearable
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="segments"
            label="Segmento (opcional)"
          />
          <QInput
            v-model.number="form.quantidade"
            data-testid="staffing-quantity"
            outlined
            type="number"
            min="0"
            label="Quantidade *"
          />
          <QInput
            v-model="form.observacoes"
            outlined
            type="textarea"
            label="Observações"
            class="full-span"
          />
          <QBanner
            v-if="impact"
            class="bg-blue-1 text-primary full-span"
            data-testid="staffing-impact"
            >{{ impact }}</QBanner
          >
        </QCardSection>
        <QCardActions align="right"
          ><QBtn v-close-popup flat label="Cancelar" /><QBtn
            data-testid="save-staffing-plan"
            color="primary"
            label="Salvar"
            :loading="saving"
            :disable="saving"
            @click="save"
        /></QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>
