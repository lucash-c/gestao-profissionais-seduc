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
import CepLookupInput from '@/components/CepLookupInput.vue';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog.vue';
import ModalHeader from '@/components/ModalHeader.vue';
import { applyViaCepAddress, type ViaCepAddress } from '@/services/cep.service';
import { fieldError, formError } from '@/services/form-errors';
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
const deleting = ref<UnitRecord | null>(null);
const deleteError = ref('');
const dialogError = ref('');
const saveFailure = ref<unknown>(null);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const typeFilter = ref<string | null>(null);
const statusFilter = ref<'all' | 'active' | 'inactive'>('active');
const numberInput = ref<{ focus: () => void } | null>(null);
const canCreate = computed(() => sessionStore.state.user?.perfil === 'ADMINISTRADOR');
const canDelete = canCreate;
const canEdit = computed(() => sessionStore.state.user?.perfil !== 'OPERADOR');
const formValid = computed(() => Boolean(form.nome.trim() && form.tipoUnidadeId));
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
  dialogError.value = '';
  saveFailure.value = null;
  editing.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(row: UnitRecord): void {
  dialogError.value = '';
  saveFailure.value = null;
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

function applyCepAddress(address: ViaCepAddress): void {
  applyViaCepAddress(form, address);
  queueMicrotask(() => numberInput.value?.focus());
}

async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  dialogError.value = '';
  saveFailure.value = null;
  try {
    if (!editing.value) {
      await registryApi.createUnit(form);
    } else {
      await registryApi.updateUnit(editing.value.id, form);
    }
    dialogOpen.value = false;
    await load();
  } catch (saveError) {
    saveFailure.value = saveError;
    dialogError.value = formError(saveError, 'Falha ao salvar unidade.');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(password: string): Promise<void> {
  if (!deleting.value || saving.value) return;
  saving.value = true;
  deleteError.value = '';
  try {
    await registryApi.deleteUnit(deleting.value.id, password);
    deleting.value = null;
    await load();
  } catch (deleteFailure) {
    deleteError.value = formError(deleteFailure, 'Falha ao excluir unidade.');
  } finally {
    saving.value = false;
  }
}

function issue(path: string): string | undefined {
  return fieldError(saveFailure.value, path);
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
      <QTable
        v-else
        flat
        :rows="rows"
        :columns="columns"
        row-key="id"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
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
              /><QBtn
                v-if="canDelete"
                flat
                round
                dense
                color="negative"
                icon="delete"
                aria-label="Excluir unidade"
                @click="
                  deleting = props.row;
                  deleteError = '';
                "
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
        <ModalHeader
          :title="editing ? 'Editar unidade' : 'Nova unidade'"
          :close-disabled="saving"
          @close="dialogOpen = false"
        />
        <QCardSection class="form-grid">
          <QBanner
            v-if="dialogError"
            class="bg-red-1 text-negative full-span"
            data-testid="unit-dialog-error"
            >{{ dialogError }}</QBanner
          >
          <QInput
            v-model="form.nome"
            data-testid="unit-name"
            outlined
            label="Nome *"
            :error="Boolean(issue('nome'))"
            :error-message="issue('nome')"
          />
          <QSelect
            v-model="form.tipoUnidadeId"
            data-testid="unit-type"
            outlined
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="types"
            label="Tipo *"
            :error="Boolean(issue('tipoUnidadeId'))"
            :error-message="issue('tipoUnidadeId')"
          />
          <QInput v-model="form.codigoInep" outlined label="Código INEP (opcional)" />
          <QInput v-model="form.poloRegiao" outlined label="Polo/região (opcional)" />
          <CepLookupInput
            v-model="form.cep"
            :error="Boolean(issue('cep'))"
            :error-message="issue('cep')"
            @address-found="applyCepAddress"
          />
          <QInput v-model="form.endereco" outlined label="Endereço" />
          <QInput ref="numberInput" v-model="form.numero" outlined label="Número" />
          <QInput v-model="form.complemento" outlined label="Complemento" />
          <QInput v-model="form.bairro" outlined label="Bairro" />
          <QInput v-model="form.cidade" outlined label="Cidade" />
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
            :disable="saving || !formValid"
            @click="save"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <DeleteConfirmationDialog
      :open="Boolean(deleting)"
      title="Excluir unidade"
      :description="`Confirme a exclusão de ${deleting?.nome ?? 'esta unidade'} com sua senha atual.`"
      :error="deleteError"
      :loading="saving"
      @cancel="deleting = null"
      @confirm="confirmDelete"
    />
  </QPage>
</template>
