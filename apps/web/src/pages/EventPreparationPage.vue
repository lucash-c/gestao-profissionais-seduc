<script setup lang="ts">
import type { EventPreparationProfessional, EventPreparationRecord } from '@seduc/contracts';
import {
  QBanner,
  QBtn,
  QCard,
  QCardActions,
  QCardSection,
  QCheckbox,
  QDialog,
  QInput,
  QPage,
  QSpinner,
  QTable,
  QTd,
  QTr,
} from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import StatusChip from '@/components/StatusChip.vue';
import ModalHeader from '@/components/ModalHeader.vue';
import { eventApi } from '@/services/event.service';

const route = useRoute();
const preparation = ref<EventPreparationRecord | null>(null);
const selected = ref<string[]>([]);
const search = ref('');
const loading = ref(true);
const saving = ref(false);
const starting = ref(false);
const confirmStart = ref(false);
const error = ref('');
const eventId = computed(() => String(route.params.id));
const readOnly = computed(() => preparation.value?.evento.status !== 'RASCUNHO');
const hasUnsavedChanges = computed(() => {
  if (!preparation.value) return false;
  const persisted = new Set(preparation.value.selecionados);
  const current = new Set(selected.value);
  return persisted.size !== current.size || [...persisted].some((id) => !current.has(id));
});
const columns = [
  { align: 'left' as const, field: 'selecionado', label: '', name: 'select' },
  { align: 'left' as const, field: 'matricula', label: 'Matrícula', name: 'matricula' },
  { align: 'left' as const, field: 'nome', label: 'Nome', name: 'nome' },
  { align: 'left' as const, field: 'possuiSedeAtual', label: 'Sede', name: 'sede' },
  { align: 'right' as const, field: 'pontuacao', label: 'Pontuação', name: 'pontuacao' },
  { align: 'left' as const, field: 'dataEntradaPrefeitura', label: 'Admissão', name: 'admissao' },
  { align: 'left' as const, field: 'dataNascimento', label: 'Nascimento', name: 'nascimento' },
  { align: 'right' as const, field: 'numeroFilhos', label: 'Filhos', name: 'filhos' },
  { align: 'left' as const, field: 'remocao', label: 'Remoção', name: 'remocao' },
  { align: 'left' as const, field: 'permuta', label: 'Permuta', name: 'permuta' },
  { align: 'left' as const, field: 'elegivel', label: 'Elegibilidade', name: 'elegibilidade' },
];
const previewColumns = [
  { align: 'left' as const, field: 'posicao', label: 'Posição', name: 'posicao' },
  { align: 'left' as const, field: 'nome', label: 'Nome', name: 'nome' },
  { align: 'right' as const, field: 'pontuacao', label: 'Pontuação', name: 'pontuacao' },
  { align: 'left' as const, field: 'dataEntrada', label: 'Admissão', name: 'admissao' },
  { align: 'left' as const, field: 'dataNascimento', label: 'Nascimento', name: 'nascimento' },
  { align: 'right' as const, field: 'numeroFilhos', label: 'Filhos', name: 'filhos' },
];

function matchesSearch(row: EventPreparationProfessional): boolean {
  const term = search.value.trim().toLocaleLowerCase('pt-BR');
  return Boolean(term) && `${row.nome} ${row.matricula}`.toLocaleLowerCase('pt-BR').includes(term);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    preparation.value = await eventApi.getPreparation(eventId.value);
    selected.value = [...preparation.value.selecionados];
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : 'Falha ao carregar a preparação.';
  } finally {
    loading.value = false;
  }
}

function selectWhere(predicate: (row: EventPreparationProfessional) => boolean): void {
  if (!preparation.value || readOnly.value) return;
  selected.value = preparation.value.profissionais
    .filter((row) => row.elegivel && predicate(row))
    .map((row) => row.profissionalId);
}

async function save(): Promise<void> {
  if (saving.value || readOnly.value) return;
  saving.value = true;
  error.value = '';
  try {
    preparation.value = await eventApi.savePreparation(eventId.value, selected.value);
    selected.value = [...preparation.value.selecionados];
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao salvar a preparação.';
  } finally {
    saving.value = false;
  }
}

async function start(): Promise<void> {
  if (starting.value || readOnly.value || hasUnsavedChanges.value) return;
  starting.value = true;
  error.value = '';
  try {
    preparation.value = await eventApi.start(eventId.value);
    selected.value = [...preparation.value.selecionados];
    confirmStart.value = false;
  } catch (startError) {
    error.value = startError instanceof Error ? startError.message : 'Falha ao iniciar o evento.';
    confirmStart.value = false;
  } finally {
    starting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <QPage class="registry-page" data-testid="event-preparation-page">
    <div v-if="loading" class="registry-state" data-testid="event-preparation-loading">
      <QSpinner color="primary" size="36px" /> Carregando preparação…
    </div>
    <template v-else-if="preparation">
      <div class="registry-heading">
        <div>
          <div class="row items-center q-gutter-xs q-mb-xs">
            <StatusChip :status="preparation.evento.tipo" />
            <StatusChip :status="preparation.evento.status" />
          </div>
          <h1>Preparação da fila</h1>
          <p>
            {{ preparation.evento.nome }} · {{ preparation.evento.ano }} ·
            {{ preparation.evento.cargoFuncao.nome }}
          </p>
        </div>
      </div>
      <QBanner v-if="readOnly" class="bg-blue-1 text-primary"
        >Evento iniciado. A operação da sessão será disponibilizada na próxima etapa.</QBanner
      >
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="event-preparation-error">{{
        error
      }}</QBanner>

      <div class="event-totals">
        <QCard flat bordered
          ><QCardSection
            ><strong>{{ preparation.totais.cargo }}</strong
            ><span>Total do cargo</span></QCardSection
          ></QCard
        >
        <QCard flat bordered
          ><QCardSection
            ><strong>{{ preparation.totais.elegiveis }}</strong
            ><span>Elegíveis</span></QCardSection
          ></QCard
        >
        <QCard flat bordered
          ><QCardSection
            ><strong>{{ selected.length }}</strong
            ><span>Selecionados</span></QCardSection
          ></QCard
        >
        <QCard flat bordered
          ><QCardSection
            ><strong>{{ preparation.totais.empatesPendentes }}</strong
            ><span>Empates pendentes</span></QCardSection
          ></QCard
        >
      </div>

      <QCard flat bordered>
        <QCardSection class="event-controls">
          <QInput
            v-model="search"
            outlined
            dense
            clearable
            label="Realçar nome ou matrícula"
            data-testid="event-search"
          />
          <QBtn outline label="TODOS" :disable="readOnly" @click="selectWhere(() => true)" />
          <QBtn
            outline
            label="COM SEDE"
            :disable="readOnly"
            @click="selectWhere((row) => row.possuiSedeAtual)"
          />
          <QBtn
            outline
            label="SEM SEDE"
            :disable="readOnly"
            @click="selectWhere((row) => !row.possuiSedeAtual)"
          />
          <QBtn
            outline
            label="REMOÇÃO"
            :disable="readOnly"
            @click="selectWhere((row) => row.remocao)"
          />
          <QBtn
            outline
            label="PERMUTA"
            :disable="readOnly"
            @click="selectWhere((row) => row.permuta)"
          />
        </QCardSection>
        <QTable
          flat
          :rows="preparation.profissionais"
          :columns="columns"
          row-key="profissionalId"
          :pagination="{ rowsPerPage: 0 }"
          hide-pagination
          data-testid="event-professionals-table"
        >
          <template #body="props">
            <QTr :props="props" :class="{ 'event-search-match': matchesSearch(props.row) }">
              <QTd key="select" :props="props"
                ><QCheckbox
                  v-model="selected"
                  :val="props.row.profissionalId"
                  :disable="readOnly || !props.row.elegivel"
                  :data-testid="`professional-select-${props.row.profissionalId}`"
              /></QTd>
              <QTd key="matricula" :props="props">{{ props.row.matricula }}</QTd>
              <QTd key="nome" :props="props">{{ props.row.nome }}</QTd>
              <QTd key="sede" :props="props"
                ><StatusChip :status="props.row.possuiSedeAtual ? 'COM_SEDE' : 'SEM_SEDE'"
              /></QTd>
              <QTd key="pontuacao" :props="props">{{ props.row.pontuacao ?? '—' }}</QTd>
              <QTd key="admissao" :props="props">{{ props.row.dataEntradaPrefeitura }}</QTd>
              <QTd key="nascimento" :props="props">{{ props.row.dataNascimento }}</QTd>
              <QTd key="filhos" :props="props">{{ props.row.numeroFilhos }}</QTd>
              <QTd key="remocao" :props="props"
                ><StatusChip
                  :status="props.row.remocao ? 'REMOCAO' : 'Não habilitada'"
                  :tone="props.row.remocao ? 'info' : 'neutral'"
              /></QTd>
              <QTd key="permuta" :props="props"
                ><StatusChip
                  :status="props.row.permuta ? 'PERMUTA' : 'Não habilitada'"
                  :tone="props.row.permuta ? 'info' : 'neutral'"
              /></QTd>
              <QTd key="elegibilidade" :props="props"
                ><StatusChip
                  :status="props.row.elegivel ? 'Elegível' : props.row.motivoInelegibilidade"
                  :tone="props.row.elegivel ? 'positive' : 'negative'"
              /></QTd>
            </QTr>
          </template>
        </QTable>
        <QBanner
          v-if="hasUnsavedChanges"
          class="bg-orange-1 text-dark"
          data-testid="unsaved-selection-warning"
        >
          Existem alterações na seleção ainda não salvas. Salve a preparação antes de iniciar o
          evento.
        </QBanner>
        <QCardActions v-if="!readOnly" align="right">
          <QBtn
            data-testid="save-preparation"
            outline
            color="primary"
            label="Salvar preparação"
            :loading="saving"
            :disable="saving || starting"
            @click="save"
          />
          <QBtn
            data-testid="start-event"
            color="primary"
            label="Iniciar evento"
            :loading="starting"
            :disable="saving || starting || hasUnsavedChanges"
            @click="confirmStart = true"
          />
        </QCardActions>
      </QCard>

      <h2 data-testid="event-preview-heading">
        {{ hasUnsavedChanges ? 'Prévia da última preparação salva' : 'Prévia da fila' }}
      </h2>
      <QTable
        flat
        bordered
        :rows="preparation.preview"
        :columns="previewColumns"
        row-key="profissionalId"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        data-testid="event-preview-table"
      >
        <template #body-cell-posicao="props"
          ><QTd :props="props">{{
            props.row.empatePendente ? 'Empate pendente' : props.row.posicao
          }}</QTd></template
        >
      </QTable>

      <QDialog v-model="confirmStart" persistent>
        <QCard data-testid="start-event-dialog" class="registry-dialog">
          <ModalHeader
            title="Iniciar evento?"
            :close-disabled="starting"
            @close="confirmStart = false"
          />
          <QCardSection class="modal-scroll-body">
            <p>
              Ao iniciar, a seleção e os critérios oficiais de classificação serão congelados para
              esta sessão.
            </p></QCardSection
          >
          <QCardActions align="right"
            ><QBtn flat label="Cancelar" :disable="starting" @click="confirmStart = false" /><QBtn
              color="primary"
              label="Confirmar início"
              :loading="starting"
              :disable="starting"
              @click="start"
          /></QCardActions>
        </QCard>
      </QDialog>
    </template>
    <QBanner v-else-if="error" class="bg-red-1 text-negative">{{ error }}</QBanner>
  </QPage>
</template>

<style scoped>
.event-totals {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.event-totals strong,
.event-totals span {
  display: block;
}
.event-totals strong {
  color: var(--fluent-primary);
  font-size: 1.25rem;
  line-height: 1.1;
}
.event-totals span {
  color: var(--fluent-text-secondary);
  font-size: 0.78rem;
  margin-top: 4px;
}
.event-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.event-controls .q-btn {
  min-height: 32px;
}
.event-controls .q-input {
  min-width: 260px;
}
.event-search-match {
  background: var(--fluent-warning-surface);
}
@media (max-width: 800px) {
  .event-totals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
