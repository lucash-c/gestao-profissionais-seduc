<script setup lang="ts">
import type { LookupRecord, PhoneRecord, UnitRecord } from '@seduc/contracts';
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

import StatusChip from '@/components/StatusChip.vue';
import { registryApi } from '@/services/registry.service';
import { sessionStore } from '@/stores/session.store';

interface PhoneForm extends Partial<PhoneRecord> {
  numero: string;
  tipo: string;
}

const rows = ref<UnitRecord[]>([]);
const types = ref<LookupRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const dialogOpen = ref(false);
const editing = ref<UnitRecord | null>(null);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const typeFilter = ref<string | null>(null);
const statusFilter = ref<'all' | 'active' | 'inactive'>('active');
const canCreate = computed(() => sessionStore.state.user?.perfil === 'ADMINISTRADOR');
const canEdit = computed(() => sessionStore.state.user?.perfil !== 'OPERADOR');
const form = reactive({
  ativo: true,
  bairro: '',
  cep: '',
  cidade: '',
  codigoInep: '',
  complemento: '',
  endereco: '',
  nome: '',
  numero: '',
  observacoes: '',
  poloRegiao: '',
  telefones: [] as PhoneForm[],
  tipoUnidadeId: '',
});

const columns = [
  { align: 'left' as const, field: 'nome', label: 'Unidade', name: 'nome' },
  {
    align: 'left' as const,
    field: (row: UnitRecord) => row.tipoUnidade.nome,
    label: 'Tipo',
    name: 'tipo',
  },
  { align: 'left' as const, field: 'cidade', label: 'Cidade', name: 'cidade' },
  { align: 'center' as const, field: 'ativo', label: 'Status', name: 'ativo' },
  { align: 'right' as const, field: 'id', label: 'Ações', name: 'actions' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [result, typeOptions] = await Promise.all([
      registryApi.listUnits({
        ...(statusFilter.value === 'all' ? {} : { ativo: statusFilter.value === 'active' }),
        nome: search.value,
        page: page.value,
        pageSize: 10,
        ...(typeFilter.value ? { tipoUnidadeId: typeFilter.value } : {}),
      }),
      registryApi.listTiposUnidade(),
    ]);
    rows.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
    types.value = typeOptions;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar unidades.';
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  Object.assign(form, {
    ativo: true,
    bairro: '',
    cep: '',
    cidade: '',
    codigoInep: '',
    complemento: '',
    endereco: '',
    nome: '',
    numero: '',
    observacoes: '',
    poloRegiao: '',
    telefones: [],
    tipoUnidadeId: '',
  });
}

function openCreate(): void {
  editing.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(row: UnitRecord): void {
  editing.value = row;
  Object.assign(form, {
    ativo: row.ativo,
    bairro: row.bairro ?? '',
    cep: row.cep ?? '',
    cidade: row.cidade ?? '',
    codigoInep: row.codigoInep ?? '',
    complemento: row.complemento ?? '',
    endereco: row.endereco ?? '',
    nome: row.nome,
    numero: row.numero ?? '',
    observacoes: row.observacoes ?? '',
    poloRegiao: row.poloRegiao ?? '',
    telefones: row.telefones.map((phone) => ({ ...phone })),
    tipoUnidadeId: row.tipoUnidadeId,
  });
  dialogOpen.value = true;
}

function addPhone(): void {
  form.telefones.push({ numero: '', tipo: 'CELULAR' });
}

async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    if (!editing.value) {
      await registryApi.createUnit(form);
    } else {
      await registryApi.updateUnit(editing.value.id, form);
    }
    dialogOpen.value = false;
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao salvar unidade.';
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <QPage class="registry-page" data-testid="units-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Cadastros</p>
        <h1>Unidades</h1>
      </div>
      <QBtn
        v-if="canCreate"
        data-testid="new-unit"
        color="primary"
        icon="add"
        label="Nova unidade"
        @click="openCreate"
      />
    </div>

    <QCard flat bordered>
      <QCardSection class="filter-grid">
        <QInput
          v-model="search"
          dense
          outlined
          label="Buscar por nome"
          data-testid="unit-search"
          @keyup.enter="
            page = 1;
            load();
          "
        />
        <QSelect
          v-model="typeFilter"
          dense
          outlined
          clearable
          emit-value
          map-options
          option-label="nome"
          option-value="id"
          :options="types"
          label="Tipo"
        />
        <QSelect
          v-model="statusFilter"
          dense
          outlined
          emit-value
          map-options
          :options="[
            { label: 'Ativas', value: 'active' },
            { label: 'Inativas', value: 'inactive' },
            { label: 'Todas', value: 'all' },
          ]"
          label="Status"
        />
        <QBtn
          outline
          color="primary"
          label="Filtrar"
          @click="
            page = 1;
            load();
          "
        />
      </QCardSection>
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="units-error">
        {{ error }}
      </QBanner>
      <div v-if="loading" class="registry-state" data-testid="units-loading">
        <QSpinner color="primary" size="36px" /> Carregando unidades…
      </div>
      <div v-else-if="rows.length === 0" class="registry-state" data-testid="units-empty">
        Nenhuma unidade encontrada.
      </div>
      <QTable v-else flat :rows="rows" :columns="columns" row-key="id" hide-pagination>
        <template #body="props">
          <QTr :props="props">
            <QTd key="nome" :props="props">{{ props.row.nome }}</QTd>
            <QTd key="tipo" :props="props">{{ props.row.tipoUnidade.nome }}</QTd>
            <QTd key="cidade" :props="props">{{ props.row.cidade || '—' }}</QTd>
            <QTd key="ativo" :props="props"
              ><StatusChip :status="props.row.ativo ? 'ATIVO' : 'INATIVO'"
            /></QTd>
            <QTd key="actions" :props="props">
              <QBtn
                v-if="canEdit"
                flat
                dense
                color="primary"
                label="Editar"
                @click="openEdit(props.row)"
              />
            </QTd>
          </QTr>
        </template>
      </QTable>
      <QCardActions v-if="!loading && rows.length" align="center">
        <QPagination v-model="page" :max="totalPages" @update:model-value="load" />
      </QCardActions>
    </QCard>

    <QDialog v-model="dialogOpen" persistent>
      <QCard class="registry-dialog" data-testid="unit-dialog">
        <QCardSection>
          <h2>{{ editing ? 'Editar unidade' : 'Nova unidade' }}</h2>
        </QCardSection>
        <QCardSection class="form-grid">
          <QInput v-model="form.nome" outlined label="Nome *" />
          <QSelect
            v-model="form.tipoUnidadeId"
            outlined
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="types"
            label="Tipo *"
          />
          <QInput v-model="form.codigoInep" outlined label="Código INEP (opcional)" />
          <QInput v-model="form.poloRegiao" outlined label="Polo/região (opcional)" />
          <QInput v-model="form.endereco" outlined label="Endereço" />
          <QInput v-model="form.numero" outlined label="Número" />
          <QInput v-model="form.complemento" outlined label="Complemento" />
          <QInput v-model="form.bairro" outlined label="Bairro" />
          <QInput v-model="form.cidade" outlined label="Cidade" />
          <QInput v-model="form.cep" outlined label="CEP" />
          <QSelect
            v-model="form.ativo"
            outlined
            emit-value
            map-options
            :options="[
              { label: 'Ativa', value: true },
              { label: 'Inativa', value: false },
            ]"
            label="Status"
          />
          <QInput
            v-model="form.observacoes"
            outlined
            type="textarea"
            label="Observações"
            class="full-span"
          />
          <div class="full-span">
            <div class="row items-center justify-between">
              <strong>Telefones</strong
              ><QBtn flat dense icon="add" label="Adicionar" @click="addPhone" />
            </div>
            <div
              v-for="(phone, index) in form.telefones"
              :key="phone.id ?? index"
              class="phone-row"
            >
              <QInput v-model="phone.tipo" dense outlined label="Tipo" /><QInput
                v-model="phone.numero"
                dense
                outlined
                label="Número"
              />
              <QBtn
                flat
                round
                color="negative"
                icon="delete"
                aria-label="Remover telefone"
                @click="form.telefones.splice(index, 1)"
              />
            </div>
          </div>
        </QCardSection>
        <QCardActions align="right">
          <QBtn v-close-popup flat label="Cancelar" /><QBtn
            data-testid="save-unit"
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
