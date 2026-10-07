<script setup lang="ts">
import type { EventRecord, EventType, LookupRecord } from '@seduc/contracts';
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
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { eventApi } from '@/services/event.service';
import { registryApi } from '@/services/registry.service';

const router = useRouter();
const rows = ref<EventRecord[]>([]);
const cargos = ref<LookupRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const page = ref(1);
const totalPages = ref(1);
const dialogOpen = ref(false);
const editing = ref<EventRecord | null>(null);
const form = reactive({
  ano: new Date().getFullYear(),
  cargoFuncaoId: '',
  nome: '',
  tipo: 'REMOCAO' as EventType,
});
const types = [
  { label: 'Remoção', value: 'REMOCAO' },
  { label: 'Permuta', value: 'PERMUTA' },
  { label: 'Listão', value: 'LISTAO' },
];
const columns = [
  { align: 'left' as const, field: 'nome', label: 'Nome', name: 'nome' },
  { align: 'left' as const, field: 'tipo', label: 'Tipo', name: 'tipo' },
  { align: 'left' as const, field: 'ano', label: 'Ano', name: 'ano' },
  { align: 'left' as const, field: 'cargoFuncao', label: 'Cargo/função', name: 'cargo' },
  { align: 'left' as const, field: 'status', label: 'Status', name: 'status' },
  { align: 'left' as const, field: 'dataInicio', label: 'Início', name: 'inicio' },
  { align: 'right' as const, field: 'id', label: 'Ações', name: 'acoes' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await eventApi.list(page.value);
    rows.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar eventos.';
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  Object.assign(form, {
    ano: new Date().getFullYear(),
    cargoFuncaoId: '',
    nome: '',
    tipo: 'REMOCAO',
  });
  dialogOpen.value = true;
}

function openEdit(event: EventRecord): void {
  editing.value = event;
  Object.assign(form, {
    ano: event.ano,
    cargoFuncaoId: event.cargoFuncaoId,
    nome: event.nome,
    tipo: event.tipo,
  });
  dialogOpen.value = true;
}

async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const event = editing.value
      ? await eventApi.update(editing.value.id, { ...form })
      : await eventApi.create({ ...form });
    dialogOpen.value = false;
    await load();
    if (!editing.value) await router.push({ name: 'event-preparation', params: { id: event.id } });
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao salvar o evento.';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    cargos.value = await registryApi.listCargos();
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar cargos.';
  }
  await load();
});
</script>

<template>
  <QPage class="registry-page" data-testid="events-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Sessões</p>
        <h1>Eventos</h1>
      </div>
      <QBtn
        data-testid="new-event"
        color="primary"
        icon="add"
        label="Novo evento"
        @click="openCreate"
      />
    </div>
    <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="events-error">{{
      error
    }}</QBanner>
    <QCard flat bordered>
      <div v-if="loading" class="registry-state" data-testid="events-loading">
        <QSpinner color="primary" size="36px" /> Carregando eventos…
      </div>
      <div v-else-if="rows.length === 0" class="registry-state">Nenhum evento encontrado.</div>
      <QTable v-else flat :rows="rows" :columns="columns" row-key="id" hide-pagination>
        <template #body="props">
          <QTr :props="props">
            <QTd key="nome" :props="props">{{ props.row.nome }}</QTd>
            <QTd key="tipo" :props="props">{{ props.row.tipo }}</QTd>
            <QTd key="ano" :props="props">{{ props.row.ano }}</QTd>
            <QTd key="cargo" :props="props">{{ props.row.cargoFuncao.nome }}</QTd>
            <QTd key="status" :props="props">{{ props.row.status }}</QTd>
            <QTd key="inicio" :props="props">{{
              props.row.dataInicio ? new Date(props.row.dataInicio).toLocaleString('pt-BR') : '—'
            }}</QTd>
            <QTd key="acoes" :props="props">
              <QBtn
                v-if="props.row.status === 'RASCUNHO'"
                flat
                dense
                label="Editar"
                @click="openEdit(props.row)"
              />
              <QBtn
                v-if="props.row.status === 'RASCUNHO'"
                flat
                dense
                color="primary"
                label="Preparar fila"
                :to="{ name: 'event-preparation', params: { id: props.row.id } }"
              />
              <QBtn
                v-if="
                  props.row.status === 'ATIVO' && ['REMOCAO', 'LISTAO'].includes(props.row.tipo)
                "
                flat
                dense
                color="primary"
                label="Abrir Central"
                :to="{ name: 'event-operations', params: { id: props.row.id } }"
              />
              <QBtn
                v-if="props.row.status === 'ATIVO' && props.row.tipo === 'PERMUTA'"
                flat
                dense
                color="primary"
                label="Abrir Permuta"
                :to="{ name: 'event-exchange', params: { id: props.row.id } }"
              />
              <QBtn
                v-if="props.row.status === 'ENCERRADO' && props.row.tipo !== 'PERMUTA'"
                flat
                dense
                label="Ver resultado"
                :to="{ name: 'public-event-display', params: { id: props.row.id } }"
              />
            </QTd>
          </QTr>
        </template>
      </QTable>
      <QCardActions v-if="!loading && rows.length" align="center"
        ><QPagination v-model="page" :max="totalPages" @update:model-value="load"
      /></QCardActions>
    </QCard>

    <QDialog v-model="dialogOpen" persistent>
      <QCard class="registry-dialog" data-testid="event-dialog">
        <QCardSection
          ><h2>{{ editing ? 'Editar evento' : 'Novo evento' }}</h2></QCardSection
        >
        <QCardSection class="form-grid">
          <QInput v-model="form.nome" outlined label="Nome *" />
          <QInput
            v-model.number="form.ano"
            outlined
            type="number"
            min="1"
            max="9999"
            label="Ano *"
          />
          <QSelect
            v-model="form.tipo"
            outlined
            emit-value
            map-options
            :options="types"
            label="Tipo *"
          />
          <QSelect
            v-model="form.cargoFuncaoId"
            outlined
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="cargos"
            label="Cargo/função *"
          />
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Cancelar" :disable="saving" @click="dialogOpen = false" />
          <QBtn
            data-testid="save-event"
            color="primary"
            label="Salvar"
            :loading="saving"
            :disable="saving"
            @click="save"
          />
        </QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>
