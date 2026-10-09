<script setup lang="ts">
import type {
  LookupRecord,
  PhoneRecord,
  ProfessionalAbsenceRecord,
  ProfessionalRecord,
  ProfessionalRelationshipsRecord,
} from '@seduc/contracts';
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

const rows = ref<ProfessionalRecord[]>([]);
const cargos = ref<LookupRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const dialogOpen = ref(false);
const editing = ref<ProfessionalRecord | null>(null);
const deleting = ref<ProfessionalRecord | null>(null);
const deleteError = ref('');
const dialogError = ref('');
const relationshipsError = ref('');
const saveFailure = ref<unknown>(null);
const relationships = ref<ProfessionalRelationshipsRecord | null>(null);
const absenceCreateOpen = ref(false);
const absenceEndTarget = ref<ProfessionalAbsenceRecord | null>(null);
const absenceError = ref('');
const absenceForm = reactive({ dataInicio: '', observacoes: '', tipo: '' });
const absenceEndDate = ref('');
const page = ref(1);
const totalPages = ref(1);
const nameFilter = ref('');
const registrationFilter = ref('');
const cargoFilter = ref<string | null>(null);
const activeFilter = ref<'all' | 'active' | 'inactive'>('active');
const removalFilter = ref<'all' | 'yes' | 'no'>('all');
const exchangeFilter = ref<'all' | 'yes' | 'no'>('all');
const numberInput = ref<{ focus: () => void } | null>(null);
const profile = computed(() => sessionStore.state.user?.perfil);
const canCreate = computed(() => profile.value === 'ADMINISTRADOR');
const canDelete = canCreate;
const canEdit = computed(() =>
  ['ADMINISTRADOR', 'DIRETOR', 'SECRETARIO'].includes(profile.value ?? ''),
);
const canManageAbsences = canEdit;
const currentExercises = computed(
  () => relationships.value?.exerciciosAtuais ?? editing.value?.exerciciosAtuais ?? [],
);
const functionalSituation = computed(() => {
  if (relationships.value?.afastamentosAtivos.length) return 'Afastado';
  return editing.value?.situacaoFuncional.descricao ?? '—';
});
const currentExerciseEmptyMessage = computed(() =>
  editing.value?.situacaoFuncional.tipo === 'PROPRIA_SEDE'
    ? 'Nenhum. A atividade atual ocorre na própria sede.'
    : 'Nenhum exercício temporário ativo.',
);
const formValid = computed(() =>
  Boolean(
    form.matricula.trim() &&
    form.nomeCompleto.trim() &&
    form.cpf.replace(/\D/g, '').length === 11 &&
    form.cargoFuncaoId &&
    form.dataEntradaPrefeitura &&
    form.dataNascimento,
  ),
);

const form = reactive({
  ativo: true,
  bairro: '',
  cargoFuncaoId: '',
  cep: '',
  cidade: '',
  complemento: '',
  cpf: '',
  dataDesligamento: '' as string | null,
  dataEntradaPrefeitura: '',
  dataNascimento: '',
  email: '' as string | null,
  endereco: '',
  matricula: '',
  nomeCompleto: '',
  numero: '',
  numeroFilhos: 0,
  observacoes: '',
  permuta: false,
  remocao: false,
  telefones: [] as PhoneForm[],
});

const columns = [
  { align: 'left' as const, field: 'matricula', label: 'Matrícula', name: 'matricula' },
  { align: 'left' as const, field: 'nomeCompleto', label: 'Nome', name: 'nome' },
  {
    align: 'left' as const,
    field: (row: ProfessionalRecord) => row.cargoFuncao.nome,
    label: 'Cargo',
    name: 'cargo',
  },
  {
    align: 'left' as const,
    field: (row: ProfessionalRecord) => row.sedeAtual?.unidadeNome ?? 'Sem sede',
    label: 'Sede',
    name: 'sede',
  },
  {
    align: 'left' as const,
    field: (row: ProfessionalRecord) => row.situacaoFuncional.descricao,
    label: 'Situação funcional',
    name: 'situacao',
  },
  { align: 'center' as const, field: 'pontuacao', label: 'Pontuação', name: 'pontuacao' },
  { align: 'center' as const, field: 'remocao', label: 'Remoção', name: 'remocao' },
  { align: 'center' as const, field: 'permuta', label: 'Permuta', name: 'permuta' },
  { align: 'right' as const, field: 'id', label: 'Ações', name: 'actions' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [result, cargoOptions] = await Promise.all([
      registryApi.listProfessionals({
        ...(activeFilter.value === 'all' ? {} : { ativo: activeFilter.value === 'active' }),
        ...(cargoFilter.value ? { cargoFuncaoId: cargoFilter.value } : {}),
        matricula: registrationFilter.value,
        nome: nameFilter.value,
        page: page.value,
        pageSize: 10,
        ...(exchangeFilter.value === 'all' ? {} : { permuta: exchangeFilter.value === 'yes' }),
        ...(removalFilter.value === 'all' ? {} : { remocao: removalFilter.value === 'yes' }),
      }),
      registryApi.listCargos(),
    ]);
    rows.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
    cargos.value = cargoOptions;
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : 'Falha ao carregar profissionais.';
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  Object.assign(form, {
    ativo: true,
    bairro: '',
    cargoFuncaoId: '',
    cep: '',
    cidade: '',
    complemento: '',
    cpf: '',
    dataDesligamento: null,
    dataEntradaPrefeitura: '',
    dataNascimento: '',
    email: null,
    endereco: '',
    matricula: '',
    nomeCompleto: '',
    numero: '',
    numeroFilhos: 0,
    observacoes: '',
    permuta: false,
    remocao: false,
    telefones: [],
  });
}

function applyCepAddress(address: ViaCepAddress): void {
  applyViaCepAddress(form, address);
  queueMicrotask(() => numberInput.value?.focus());
}

function openCreate(): void {
  dialogError.value = '';
  relationshipsError.value = '';
  saveFailure.value = null;
  editing.value = null;
  relationships.value = null;
  resetForm();
  dialogOpen.value = true;
}
async function openEdit(row: ProfessionalRecord): Promise<void> {
  dialogError.value = '';
  relationshipsError.value = '';
  saveFailure.value = null;
  editing.value = row;
  relationships.value = null;
  Object.assign(form, {
    ativo: row.ativo,
    bairro: row.bairro ?? '',
    cargoFuncaoId: row.cargoFuncaoId,
    cep: row.cep ?? '',
    cidade: row.cidade ?? '',
    complemento: row.complemento ?? '',
    cpf: row.cpf,
    dataDesligamento: row.dataDesligamento,
    dataEntradaPrefeitura: row.dataEntradaPrefeitura,
    dataNascimento: row.dataNascimento,
    email: row.email,
    endereco: row.endereco ?? '',
    matricula: row.matricula,
    nomeCompleto: row.nomeCompleto,
    numero: row.numero ?? '',
    numeroFilhos: row.numeroFilhos,
    observacoes: row.observacoes ?? '',
    permuta: row.permuta,
    remocao: row.remocao,
    telefones: row.telefones.map((phone) => ({ ...phone })),
  });
  dialogOpen.value = true;
  try {
    relationships.value = await registryApi.getProfessionalRelationships(row.id);
  } catch (loadError) {
    relationshipsError.value =
      loadError instanceof Error
        ? loadError.message
        : 'Falha ao carregar vínculos do profissional.';
  }
}

function dateAsTimestamp(value: string): string {
  return new Date(`${value}T12:00:00-03:00`).toISOString();
}

async function refreshRelationships(): Promise<void> {
  if (!editing.value) return;
  relationships.value = await registryApi.getProfessionalRelationships(editing.value.id);
}

function openAbsenceCreate(): void {
  const today = new Date();
  absenceError.value = '';
  Object.assign(absenceForm, {
    dataInicio: today.toISOString().slice(0, 10),
    observacoes: '',
    tipo: '',
  });
  absenceCreateOpen.value = true;
}

async function createAbsence(): Promise<void> {
  if (!editing.value || saving.value || !absenceForm.tipo.trim() || !absenceForm.dataInicio) return;
  saving.value = true;
  absenceError.value = '';
  try {
    await registryApi.createProfessionalAbsence(editing.value.id, {
      dataInicio: dateAsTimestamp(absenceForm.dataInicio),
      observacoes: absenceForm.observacoes.trim() || null,
      tipo: absenceForm.tipo.trim(),
    });
    absenceCreateOpen.value = false;
    await Promise.all([refreshRelationships(), load()]);
  } catch (failure) {
    absenceError.value = formError(failure, 'Falha ao registrar afastamento.');
  } finally {
    saving.value = false;
  }
}

function openAbsenceEnd(absence: ProfessionalAbsenceRecord): void {
  absenceError.value = '';
  absenceEndDate.value = new Date().toISOString().slice(0, 10);
  absenceEndTarget.value = absence;
}

async function endAbsence(): Promise<void> {
  if (!editing.value || !absenceEndTarget.value || !absenceEndDate.value || saving.value) return;
  saving.value = true;
  absenceError.value = '';
  try {
    await registryApi.endProfessionalAbsence(
      editing.value.id,
      absenceEndTarget.value.id,
      dateAsTimestamp(absenceEndDate.value),
    );
    absenceEndTarget.value = null;
    await Promise.all([refreshRelationships(), load()]);
  } catch (failure) {
    absenceError.value = formError(failure, 'Falha ao encerrar afastamento.');
  } finally {
    saving.value = false;
  }
}
function addPhone(): void {
  form.telefones.push({ numero: '', tipo: 'CELULAR' });
}

async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  dialogError.value = '';
  saveFailure.value = null;
  try {
    if (!editing.value) {
      await registryApi.createProfessional(form);
    } else {
      await registryApi.updateProfessional(editing.value.id, form);
    }
    dialogOpen.value = false;
    await load();
  } catch (saveError) {
    saveFailure.value = saveError;
    dialogError.value = formError(saveError, 'Falha ao salvar profissional.');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(password: string): Promise<void> {
  if (!deleting.value || saving.value) return;
  saving.value = true;
  deleteError.value = '';
  try {
    await registryApi.deleteProfessional(deleting.value.id, password);
    deleting.value = null;
    await load();
  } catch (deleteFailure) {
    deleteError.value = formError(deleteFailure, 'Falha ao excluir profissional.');
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
  <QPage class="registry-page" data-testid="professionals-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Cadastros</p>
        <h1>Profissionais</h1>
      </div>
      <QBtn
        v-if="canCreate"
        data-testid="new-professional"
        color="primary"
        icon="person_add"
        label="Novo profissional"
        @click="openCreate"
      />
    </div>
    <QCard flat bordered>
      <QCardSection class="filter-grid professional-filters">
        <QInput v-model="registrationFilter" dense outlined label="Matrícula" />
        <QInput
          v-model="nameFilter"
          dense
          outlined
          label="Nome"
          data-testid="professional-search"
        />
        <QSelect
          v-model="cargoFilter"
          dense
          outlined
          clearable
          emit-value
          map-options
          option-label="nome"
          option-value="id"
          :options="cargos"
          label="Cargo"
        />
        <QSelect
          v-model="activeFilter"
          dense
          outlined
          emit-value
          map-options
          :options="[
            { label: 'Ativos', value: 'active' },
            { label: 'Inativos', value: 'inactive' },
            { label: 'Todos', value: 'all' },
          ]"
          label="Status"
        />
        <QSelect
          v-model="removalFilter"
          dense
          outlined
          emit-value
          map-options
          :options="[
            { label: 'Remoção: todos', value: 'all' },
            { label: 'Sim', value: 'yes' },
            { label: 'Não', value: 'no' },
          ]"
          label="Remoção"
        />
        <QSelect
          v-model="exchangeFilter"
          dense
          outlined
          emit-value
          map-options
          :options="[
            { label: 'Permuta: todos', value: 'all' },
            { label: 'Sim', value: 'yes' },
            { label: 'Não', value: 'no' },
          ]"
          label="Permuta"
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
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="professionals-error">
        {{ error }}
      </QBanner>
      <div v-if="loading" class="registry-state" data-testid="professionals-loading">
        <QSpinner color="primary" size="36px" /> Carregando profissionais…
      </div>
      <div v-else-if="rows.length === 0" class="registry-state" data-testid="professionals-empty">
        Nenhum profissional encontrado.
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
            <QTd key="matricula" :props="props">{{ props.row.matricula }}</QTd
            ><QTd key="nome" :props="props">{{ props.row.nomeCompleto }}</QTd>
            <QTd key="cargo" :props="props">{{ props.row.cargoFuncao.nome }}</QTd
            ><QTd key="sede" :props="props">
              <StatusChip :status="props.row.sedeAtual ? 'COM_SEDE' : 'SEM_SEDE'" />
              <span class="block text-caption">{{
                props.row.sedeAtual?.unidadeNome ?? 'Sem sede definida'
              }}</span>
            </QTd>
            <QTd key="situacao" :props="props">{{ props.row.situacaoFuncional.descricao }}</QTd>
            <QTd key="pontuacao" :props="props">{{ props.row.pontuacao }}</QTd
            ><QTd key="remocao" :props="props"
              ><StatusChip
                :status="props.row.remocao ? 'REMOCAO' : 'Não habilitada'"
                :tone="props.row.remocao ? 'info' : 'neutral'"
            /></QTd>
            <QTd key="permuta" :props="props"
              ><StatusChip
                :status="props.row.permuta ? 'PERMUTA' : 'Não habilitada'"
                :tone="props.row.permuta ? 'info' : 'neutral'" /></QTd
            ><QTd key="actions" :props="props">
              <QBtn
                flat
                dense
                color="primary"
                :label="canEdit ? 'Editar' : 'Detalhes'"
                @click="openEdit(props.row)"
              /><QBtn
                v-if="canDelete"
                flat
                round
                dense
                color="negative"
                icon="delete"
                aria-label="Excluir profissional"
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
      <QCard class="registry-dialog wide" data-testid="professional-dialog">
        <ModalHeader
          :title="
            editing
              ? canEdit
                ? 'Editar profissional'
                : 'Detalhes do profissional'
              : 'Novo profissional'
          "
          :close-disabled="saving"
          @close="dialogOpen = false"
        />
        <div class="modal-scroll-content">
          <QCardSection>
            <div v-if="editing" class="readonly-history" data-testid="readonly-placement">
              <p><strong>Situação funcional:</strong> {{ functionalSituation }}</p>
              <span
                ><strong>Sede atual:</strong>
                {{ editing.sedeAtual?.unidadeNome ?? 'Sem sede' }}</span
              >
              <div>
                <strong>Exercícios temporários atuais:</strong>
                <span v-if="currentExercises.length === 0" class="relationship-inline-value">
                  {{ currentExerciseEmptyMessage }}
                </span>
                <ul v-else class="q-my-xs">
                  <li v-for="exercise in currentExercises" :key="exercise.postoId">
                    {{ exercise.unidadeNome }} ({{ exercise.tipo }})
                  </li>
                </ul>
              </div>
              <QBanner v-if="relationshipsError" class="bg-amber-1 text-warning q-mt-md">
                {{ relationshipsError }} Os dados cadastrais continuam disponíveis para edição.
              </QBanner>
              <div>
                <div class="row items-center justify-between">
                  <strong>Afastamentos ativos:</strong>
                  <QBtn
                    v-if="canManageAbsences"
                    flat
                    dense
                    icon="add"
                    label="Registrar afastamento"
                    data-testid="register-absence"
                    @click="openAbsenceCreate"
                  />
                </div>
                <span v-if="!relationships?.afastamentosAtivos.length"> Nenhum</span>
                <ul v-else class="q-my-xs">
                  <li v-for="absence in relationships.afastamentosAtivos" :key="absence.id">
                    {{ absence.tipo }} — desde
                    {{ new Date(absence.dataInicio).toLocaleDateString() }}
                    <span v-if="absence.observacoes"> — {{ absence.observacoes }}</span>
                    <QBtn
                      v-if="canManageAbsences"
                      flat
                      dense
                      color="primary"
                      label="Encerrar"
                      data-testid="end-absence"
                      @click="openAbsenceEnd(absence)"
                    />
                  </li>
                </ul>
              </div>
              <details v-if="relationships" data-testid="professional-history">
                <summary>Consultar históricos</summary>
                <p><strong>Histórico de sede</strong></p>
                <ul>
                  <li v-for="placement in relationships.historicoSedes" :key="placement.id">
                    {{ placement.unidadeNome }} —
                    {{ new Date(placement.dataInicio).toLocaleDateString() }}
                    até
                    {{
                      placement.dataFim ? new Date(placement.dataFim).toLocaleDateString() : 'atual'
                    }}
                  </li>
                </ul>
                <p><strong>Histórico de exercícios</strong></p>
                <ul>
                  <li v-for="exercise in relationships.historicoExercicios" :key="exercise.id">
                    {{ exercise.unidadeNome }} ({{ exercise.tipo }}) —
                    {{ new Date(exercise.dataInicio).toLocaleDateString() }} até
                    {{
                      exercise.dataFim ? new Date(exercise.dataFim).toLocaleDateString() : 'atual'
                    }}
                  </li>
                </ul>
                <p><strong>Histórico de afastamentos</strong></p>
                <ul>
                  <li v-for="absence in relationships.afastamentos" :key="absence.id">
                    {{ absence.tipo }} — {{ new Date(absence.dataInicio).toLocaleDateString() }} até
                    {{ absence.dataFim ? new Date(absence.dataFim).toLocaleDateString() : 'atual' }}
                  </li>
                </ul>
              </details>
              <small
                >Sede e exercício são históricos oficiais e não podem ser alterados neste
                cadastro.</small
              >
            </div>
          </QCardSection>
          <QCardSection v-if="canEdit" class="form-grid">
            <QBanner
              v-if="dialogError"
              class="bg-red-1 text-negative full-span"
              data-testid="professional-dialog-error"
              >{{ dialogError }}</QBanner
            >
            <QInput
              v-model="form.matricula"
              outlined
              label="Matrícula *"
              :error="Boolean(issue('matricula'))"
              :error-message="issue('matricula')"
            /><QInput
              v-model="form.nomeCompleto"
              outlined
              label="Nome completo *"
              :error="Boolean(issue('nomeCompleto'))"
              :error-message="issue('nomeCompleto')"
            />
            <QInput
              v-model="form.cpf"
              outlined
              label="CPF *"
              :error="Boolean(issue('cpf'))"
              :error-message="issue('cpf')"
            /><QSelect
              v-model="form.cargoFuncaoId"
              outlined
              emit-value
              map-options
              option-label="nome"
              option-value="id"
              :options="cargos"
              label="Cargo/função *"
            />
            <QInput
              v-model="form.dataEntradaPrefeitura"
              outlined
              type="date"
              label="Entrada na Prefeitura *"
              stack-label
            /><QInput
              v-model="form.dataNascimento"
              outlined
              type="date"
              label="Nascimento *"
              stack-label
            />
            <QInput v-model="form.email" outlined type="email" label="E-mail" /><QInput
              v-model="form.dataDesligamento"
              outlined
              type="date"
              label="Data de desligamento"
              stack-label
              clearable
            />
            <QInput
              v-model.number="form.numeroFilhos"
              outlined
              type="number"
              min="0"
              label="Número de filhos"
            /><QSelect
              v-model="form.ativo"
              outlined
              emit-value
              map-options
              :options="[
                { label: 'Ativo', value: true },
                { label: 'Inativo', value: false },
              ]"
              label="Status"
            />
            <CepLookupInput v-model="form.cep" @address-found="applyCepAddress" />
            <QInput v-model="form.endereco" outlined label="Endereço" /><QInput
              ref="numberInput"
              v-model="form.numero"
              outlined
              label="Número"
            /><QInput v-model="form.complemento" outlined label="Complemento" />
            <QInput v-model="form.bairro" outlined label="Bairro" /><QInput
              v-model="form.cidade"
              outlined
              label="Cidade"
            />
            <div class="manifestations full-span">
              <QCheckbox v-model="form.remocao" label="Manifestação prévia de Remoção" /><QCheckbox
                v-model="form.permuta"
                label="Manifestação prévia de Permuta"
              />
            </div>
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
                /><QBtn
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
        </div>
        <QCardActions align="right">
          <QBtn v-close-popup flat :label="canEdit ? 'Cancelar' : 'Fechar'" /><QBtn
            v-if="canEdit"
            data-testid="save-professional"
            color="primary"
            label="Salvar"
            :loading="saving"
            :disable="saving || !formValid"
            @click="save"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog v-model="absenceCreateOpen" persistent>
      <QCard class="registry-dialog compact" data-testid="absence-create-dialog">
        <ModalHeader
          title="Registrar afastamento"
          :close-disabled="saving"
          @close="absenceCreateOpen = false"
        />
        <QCardSection class="modal-scroll-body form-grid">
          <QInput v-model="absenceForm.tipo" outlined label="Tipo *" maxlength="120" />
          <QInput
            v-model="absenceForm.dataInicio"
            outlined
            type="date"
            label="Data de início *"
            stack-label
          />
          <QInput
            v-model="absenceForm.observacoes"
            outlined
            type="textarea"
            label="Observações"
            class="full-span"
          />
          <QBanner v-if="absenceError" class="bg-red-1 text-negative full-span">{{
            absenceError
          }}</QBanner>
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Cancelar" @click="absenceCreateOpen = false" />
          <QBtn
            color="primary"
            label="Registrar"
            :loading="saving"
            :disable="saving || !absenceForm.tipo.trim() || !absenceForm.dataInicio"
            @click="createAbsence"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog :model-value="Boolean(absenceEndTarget)" persistent>
      <QCard class="registry-dialog compact" data-testid="absence-end-dialog">
        <ModalHeader
          title="Encerrar afastamento"
          :close-disabled="saving"
          @close="absenceEndTarget = null"
        />
        <QCardSection class="modal-scroll-body">
          <p>{{ absenceEndTarget?.tipo }}</p>
          <QInput
            v-model="absenceEndDate"
            outlined
            type="date"
            label="Data de término *"
            stack-label
          />
          <QBanner v-if="absenceError" class="bg-red-1 text-negative q-mt-md">{{
            absenceError
          }}</QBanner>
        </QCardSection>
        <QCardActions align="right">
          <QBtn flat label="Cancelar" @click="absenceEndTarget = null" />
          <QBtn
            color="primary"
            label="Encerrar afastamento"
            :loading="saving"
            :disable="saving || !absenceEndDate"
            @click="endAbsence"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <DeleteConfirmationDialog
      :open="Boolean(deleting)"
      title="Excluir profissional"
      :description="`Confirme a exclusão de ${deleting?.nomeCompleto ?? 'este profissional'} com sua senha atual.`"
      :error="deleteError"
      :loading="saving"
      @cancel="deleting = null"
      @confirm="confirmDelete"
    />
  </QPage>
</template>
