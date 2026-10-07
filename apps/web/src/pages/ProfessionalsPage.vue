<script setup lang="ts">
import type {
  LookupRecord,
  PhoneRecord,
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
const relationships = ref<ProfessionalRelationshipsRecord | null>(null);
const page = ref(1);
const totalPages = ref(1);
const nameFilter = ref('');
const registrationFilter = ref('');
const cargoFilter = ref<string | null>(null);
const activeFilter = ref<'all' | 'active' | 'inactive'>('active');
const removalFilter = ref<'all' | 'yes' | 'no'>('all');
const exchangeFilter = ref<'all' | 'yes' | 'no'>('all');
const profile = computed(() => sessionStore.state.user?.perfil);
const canCreate = computed(() => profile.value === 'ADMINISTRADOR');
const canEdit = computed(() =>
  ['ADMINISTRADOR', 'DIRETOR', 'SECRETARIO'].includes(profile.value ?? ''),
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

function openCreate(): void {
  editing.value = null;
  relationships.value = null;
  resetForm();
  dialogOpen.value = true;
}
async function openEdit(row: ProfessionalRecord): Promise<void> {
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
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar vínculos.';
  }
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
      await registryApi.createProfessional(form);
    } else {
      await registryApi.updateProfessional(editing.value.id, form);
    }
    dialogOpen.value = false;
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao salvar profissional.';
  } finally {
    saving.value = false;
  }
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
      <QTable v-else flat :rows="rows" :columns="columns" row-key="id" hide-pagination>
        <template #body="props">
          <QTr :props="props">
            <QTd key="matricula" :props="props">{{ props.row.matricula }}</QTd
            ><QTd key="nome" :props="props">{{ props.row.nomeCompleto }}</QTd>
            <QTd key="cargo" :props="props">{{ props.row.cargoFuncao.nome }}</QTd
            ><QTd key="sede" :props="props">
              <StatusChip :status="props.row.sedeAtual ? 'COM_SEDE' : 'SEM_SEDE'" />
              <span class="block text-caption">{{ props.row.sedeAtual?.unidadeNome ?? '—' }}</span>
            </QTd>
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
        <QCardSection>
          <h2>
            {{
              editing
                ? canEdit
                  ? 'Editar profissional'
                  : 'Detalhes do profissional'
                : 'Novo profissional'
            }}
          </h2>
          <div v-if="editing" class="readonly-history" data-testid="readonly-placement">
            <span
              ><strong>Sede atual:</strong> {{ editing.sedeAtual?.unidadeNome ?? 'Sem sede' }}</span
            >
            <div>
              <strong>Exercícios atuais:</strong>
              <span v-if="editing.exerciciosAtuais.length === 0"> Sem exercício</span>
              <ul v-else class="q-my-xs">
                <li v-for="exercise in editing.exerciciosAtuais" :key="exercise.postoId">
                  {{ exercise.unidadeNome }} ({{ exercise.tipo }})
                </li>
              </ul>
            </div>
            <div>
              <strong>Afastamentos ativos:</strong>
              <span v-if="!relationships?.afastamentosAtivos.length"> Nenhum</span>
              <ul v-else class="q-my-xs">
                <li v-for="absence in relationships.afastamentosAtivos" :key="absence.id">
                  {{ absence.tipo }} — desde {{ new Date(absence.dataInicio).toLocaleDateString() }}
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
                  {{ exercise.dataFim ? new Date(exercise.dataFim).toLocaleDateString() : 'atual' }}
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
          <QInput v-model="form.matricula" outlined label="Matrícula *" /><QInput
            v-model="form.nomeCompleto"
            outlined
            label="Nome completo *"
          />
          <QInput v-model="form.cpf" outlined label="CPF *" /><QSelect
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
          <QInput v-model="form.endereco" outlined label="Endereço" /><QInput
            v-model="form.numero"
            outlined
            label="Número"
          /><QInput v-model="form.complemento" outlined label="Complemento" />
          <QInput v-model="form.bairro" outlined label="Bairro" /><QInput
            v-model="form.cidade"
            outlined
            label="Cidade"
          /><QInput v-model="form.cep" outlined label="CEP" />
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
        <QCardActions align="right">
          <QBtn v-close-popup flat :label="canEdit ? 'Cancelar' : 'Fechar'" /><QBtn
            v-if="canEdit"
            data-testid="save-professional"
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
