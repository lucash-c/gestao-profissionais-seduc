<script setup lang="ts">
import {
  USER_PROFILES,
  type LookupRecord,
  type UserProfile,
  type UserRecord,
} from '@seduc/contracts';
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
import { onMounted, reactive, ref, watch } from 'vue';

import { registryApi } from '@/services/registry.service';

const rows = ref<UserRecord[]>([]);
const units = ref<LookupRecord[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const profileFilter = ref<UserProfile | null>(null);
const dialogOpen = ref(false);
const editing = ref<UserRecord | null>(null);
const resetTarget = ref<UserRecord | null>(null);
const resetPassword = ref('');
const form = reactive({
  ativo: true,
  email: '' as string | null,
  login: '',
  nome: '',
  perfil: 'OPERADOR' as UserProfile,
  senha: '',
  unidadeIds: [] as string[],
});
const profileOptions = USER_PROFILES.map((value) => ({ label: value, value }));
const columns = [
  { align: 'left' as const, field: 'nome', label: 'Nome', name: 'nome' },
  { align: 'left' as const, field: 'login', label: 'Login', name: 'login' },
  { align: 'left' as const, field: 'email', label: 'E-mail', name: 'email' },
  { align: 'left' as const, field: 'perfil', label: 'Perfil', name: 'perfil' },
  {
    align: 'left' as const,
    field: (row: UserRecord) => row.unidades.map((unit) => unit.nome).join(', ') || '—',
    label: 'Unidades',
    name: 'unidades',
  },
  { align: 'center' as const, field: 'ativo', label: 'Status', name: 'ativo' },
  { align: 'right' as const, field: 'id', label: 'Ações', name: 'actions' },
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [result, unitOptions] = await Promise.all([
      registryApi.listUsers({
        nome: search.value,
        page: page.value,
        pageSize: 10,
        ...(profileFilter.value ? { perfil: profileFilter.value } : {}),
      }),
      registryApi.listUnitOptions(),
    ]);
    rows.value = result.items;
    totalPages.value = Math.max(result.totalPages, 1);
    units.value = unitOptions;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Falha ao carregar usuários.';
  } finally {
    loading.value = false;
  }
}
function openCreate(): void {
  editing.value = null;
  Object.assign(form, {
    ativo: true,
    email: null,
    login: '',
    nome: '',
    perfil: 'OPERADOR',
    senha: '',
    unidadeIds: [],
  });
  dialogOpen.value = true;
}
function openEdit(row: UserRecord): void {
  editing.value = row;
  Object.assign(form, {
    ativo: row.ativo,
    email: row.email,
    login: row.login,
    nome: row.nome,
    perfil: row.perfil,
    senha: '',
    unidadeIds: [...row.unidadeIds],
  });
  dialogOpen.value = true;
}
async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const { senha, ...fields } = form;
    if (editing.value) await registryApi.updateUser(editing.value.id, fields);
    else await registryApi.createUser({ ...fields, senha });
    dialogOpen.value = false;
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao salvar usuário.';
  } finally {
    saving.value = false;
  }
}
async function confirmReset(): Promise<void> {
  if (!resetTarget.value || saving.value) return;
  saving.value = true;
  try {
    await registryApi.resetPassword(resetTarget.value.id, resetPassword.value);
    resetTarget.value = null;
    resetPassword.value = '';
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'Falha ao redefinir senha.';
  } finally {
    saving.value = false;
  }
}
onMounted(load);

watch(
  () => form.perfil,
  (profile) => {
    if (profile === 'ADMINISTRADOR' || profile === 'OPERADOR') form.unidadeIds = [];
    else if (profile === 'SECRETARIO' && form.unidadeIds.length > 1) {
      form.unidadeIds = form.unidadeIds.slice(0, 1);
    }
  },
);
</script>

<template>
  <QPage class="registry-page" data-testid="users-page">
    <div class="registry-heading">
      <div>
        <p class="eyebrow">Administração</p>
        <h1>Usuários do sistema</h1>
      </div>
      <QBtn
        data-testid="new-user"
        color="primary"
        icon="person_add"
        label="Novo usuário"
        @click="openCreate"
      />
    </div>
    <QCard flat bordered>
      <QCardSection class="filter-grid">
        <QInput
          v-model="search"
          dense
          outlined
          label="Nome ou login"
          data-testid="user-search"
        /><QSelect
          v-model="profileFilter"
          dense
          outlined
          clearable
          emit-value
          map-options
          :options="profileOptions"
          label="Perfil"
        /><QBtn
          outline
          color="primary"
          label="Filtrar"
          @click="
            page = 1;
            load();
          "
        />
      </QCardSection>
      <QBanner v-if="error" class="bg-red-1 text-negative" data-testid="users-error">
        {{ error }}
      </QBanner>
      <div v-if="loading" class="registry-state" data-testid="users-loading">
        <QSpinner color="primary" size="36px" /> Carregando usuários…
      </div>
      <div v-else-if="rows.length === 0" class="registry-state" data-testid="users-empty">
        Nenhum usuário encontrado.
      </div>
      <QTable v-else flat :rows="rows" :columns="columns" row-key="id" hide-pagination>
        <template #body-cell-ativo="props">
          <td class="text-center">{{ props.row.ativo ? 'Ativo' : 'Inativo' }}</td>
        </template>
        <template #body-cell-actions="props">
          <td class="text-right">
            <QBtn flat dense color="primary" label="Editar" @click="openEdit(props.row)" /><QBtn
              flat
              dense
              color="primary"
              label="Redefinir senha"
              @click="resetTarget = props.row"
            />
          </td>
        </template>
      </QTable>
      <QCardActions v-if="!loading && rows.length" align="center">
        <QPagination v-model="page" :max="totalPages" @update:model-value="load" />
      </QCardActions>
    </QCard>
    <QDialog v-model="dialogOpen" persistent>
      <QCard class="registry-dialog compact" data-testid="user-dialog">
        <QCardSection>
          <h2>{{ editing ? 'Editar usuário' : 'Novo usuário' }}</h2> </QCardSection
        ><QCardSection class="form-grid single-column">
          <QInput v-model="form.nome" outlined label="Nome *" /><QInput
            v-model="form.login"
            outlined
            label="Login *"
          /><QInput v-model="form.email" outlined type="email" label="E-mail" />
          <QSelect
            v-model="form.perfil"
            outlined
            emit-value
            map-options
            :options="profileOptions"
            label="Perfil *"
          /><QSelect
            v-if="form.perfil === 'DIRETOR'"
            data-testid="user-units-multiple"
            v-model="form.unidadeIds"
            outlined
            multiple
            use-chips
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="units"
            label="Unidades administradas *"
          /><QSelect
            v-else-if="form.perfil === 'SECRETARIO'"
            data-testid="user-unit-single"
            :model-value="form.unidadeIds[0] ?? null"
            outlined
            emit-value
            map-options
            option-label="nome"
            option-value="id"
            :options="units"
            label="Unidade administrada *"
            @update:model-value="(value) => (form.unidadeIds = value ? [value] : [])"
          />
          <QInput
            v-if="!editing"
            v-model="form.senha"
            outlined
            type="password"
            label="Senha inicial *"
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
          /> </QCardSection
        ><QCardActions align="right">
          <QBtn v-close-popup flat label="Cancelar" /><QBtn
            data-testid="save-user"
            color="primary"
            label="Salvar"
            :loading="saving"
            :disable="saving"
            @click="save"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog
      :model-value="Boolean(resetTarget)"
      @update:model-value="
        (open) => {
          if (!open) resetTarget = null;
        }
      "
    >
      <QCard class="registry-dialog compact" data-testid="password-dialog">
        <QCardSection>
          <h2>Redefinir senha</h2>
          <p>{{ resetTarget?.nome }}</p>
          <QInput
            v-model="resetPassword"
            outlined
            type="password"
            label="Nova senha"
          /> </QCardSection
        ><QCardActions align="right">
          <QBtn flat label="Cancelar" @click="resetTarget = null" /><QBtn
            data-testid="save-password"
            color="primary"
            label="Redefinir e revogar sessões"
            :loading="saving"
            :disable="saving"
            @click="confirmReset"
          />
        </QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>
