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
import { computed, onMounted, reactive, ref, watch } from 'vue';

import StatusChip from '@/components/StatusChip.vue';
import ModalHeader from '@/components/ModalHeader.vue';
import { fieldError, formError } from '@/services/form-errors';
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
const resetPasswordConfirmation = ref('');
const showResetPassword = ref(false);
const resetError = ref('');
const deleteTarget = ref<UserRecord | null>(null);
const deletePassword = ref('');
const deleteError = ref('');
const dialogError = ref('');
const saveFailure = ref<unknown>(null);
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
const resetPasswordValidation = computed(() => {
  if (!resetPassword.value) return '';
  if (resetPassword.value.length < 12) return 'A senha deve possuir ao menos 12 caracteres.';
  if (resetPassword.value.length > 72) return 'A senha deve possuir no máximo 72 caracteres.';
  return '';
});
const resetConfirmationValidation = computed(() =>
  resetPasswordConfirmation.value && resetPasswordConfirmation.value !== resetPassword.value
    ? 'A confirmação deve ser igual à nova senha.'
    : '',
);
const resetValid = computed(
  () =>
    !resetPasswordValidation.value &&
    resetPasswordConfirmation.value === resetPassword.value &&
    resetPasswordConfirmation.value.length > 0,
);
const userFormValid = computed(() => {
  if (!form.nome.trim() || !form.login.trim()) return false;
  if (!editing.value && (form.senha.length < 12 || form.senha.length > 72)) return false;
  if (form.perfil === 'DIRETOR') return form.unidadeIds.length >= 1;
  if (form.perfil === 'SECRETARIO') return form.unidadeIds.length === 1;
  return form.unidadeIds.length === 0;
});
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
  dialogError.value = '';
  saveFailure.value = null;
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
  dialogError.value = '';
  saveFailure.value = null;
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
  dialogError.value = '';
  saveFailure.value = null;
  try {
    const { senha, ...fields } = form;
    if (editing.value) await registryApi.updateUser(editing.value.id, fields);
    else await registryApi.createUser({ ...fields, senha });
    dialogOpen.value = false;
    await load();
  } catch (saveError) {
    saveFailure.value = saveError;
    dialogError.value = formError(saveError, 'Falha ao salvar usuário.');
  } finally {
    saving.value = false;
  }
}
function openReset(row: UserRecord): void {
  resetTarget.value = row;
  resetPassword.value = '';
  resetPasswordConfirmation.value = '';
  resetError.value = '';
  showResetPassword.value = false;
}
function closeReset(): void {
  resetTarget.value = null;
  resetPassword.value = '';
  resetPasswordConfirmation.value = '';
  resetError.value = '';
  showResetPassword.value = false;
}
async function confirmReset(): Promise<void> {
  if (!resetTarget.value || saving.value || !resetValid.value) return;
  saving.value = true;
  resetError.value = '';
  try {
    await registryApi.resetPassword(resetTarget.value.id, resetPassword.value);
    closeReset();
  } catch (saveError) {
    resetError.value = formError(saveError, 'Falha ao redefinir senha.');
  } finally {
    saving.value = false;
  }
}
function openDelete(row: UserRecord): void {
  deleteTarget.value = row;
  deletePassword.value = '';
  deleteError.value = '';
}
function closeDelete(): void {
  deleteTarget.value = null;
  deletePassword.value = '';
  deleteError.value = '';
}
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value || !deletePassword.value || saving.value) return;
  saving.value = true;
  deleteError.value = '';
  try {
    await registryApi.deleteUser(deleteTarget.value.id, deletePassword.value);
    closeDelete();
    await load();
  } catch (deleteFailure) {
    deleteError.value = formError(deleteFailure, 'Falha ao excluir usuário.');
  } finally {
    saving.value = false;
  }
}

function issue(path: string): string | undefined {
  return fieldError(saveFailure.value, path);
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
      <QTable
        v-else
        flat
        :rows="rows"
        :columns="columns"
        row-key="id"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template #body-cell-ativo="props">
          <td class="text-center">
            <StatusChip :status="props.row.ativo ? 'ATIVO' : 'INATIVO'" />
          </td>
        </template>
        <template #body-cell-actions="props">
          <td class="text-right">
            <QBtn
              flat
              round
              dense
              color="primary"
              icon="edit"
              aria-label="Editar usuário"
              @click="openEdit(props.row)"
            /><QBtn
              flat
              round
              dense
              color="primary"
              icon="key"
              aria-label="Redefinir senha"
              @click="openReset(props.row)"
            /><QBtn
              flat
              round
              dense
              color="negative"
              icon="delete"
              aria-label="Excluir usuário"
              @click="openDelete(props.row)"
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
        <ModalHeader
          :title="editing ? 'Editar usuário' : 'Novo usuário'"
          :close-disabled="saving"
          @close="dialogOpen = false"
        />
        <QCardSection class="form-grid single-column">
          <QBanner
            v-if="dialogError"
            class="bg-red-1 text-negative"
            data-testid="user-dialog-error"
            >{{ dialogError }}</QBanner
          >
          <QInput
            v-model="form.nome"
            outlined
            label="Nome *"
            :error="Boolean(issue('nome'))"
            :error-message="issue('nome')"
          /><QInput
            v-model="form.login"
            outlined
            label="Login *"
            :error="Boolean(issue('login'))"
            :error-message="issue('login')"
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
            :error="Boolean(issue('senha'))"
            :error-message="issue('senha')"
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
            :disable="saving || !userFormValid"
            @click="save"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog
      :model-value="Boolean(resetTarget)"
      @update:model-value="
        (open) => {
          if (!open) closeReset();
        }
      "
    >
      <QCard class="registry-dialog compact" data-testid="password-dialog">
        <ModalHeader title="Redefinir senha" :close-disabled="saving" @close="closeReset" />
        <QCardSection class="modal-scroll-body">
          <p>{{ resetTarget?.nome }}</p>
          <QBanner class="password-guidance q-mb-md">
            Use uma senha entre 12 e 72 caracteres. Ao confirmar, as sessões ativas deste usuário
            serão revogadas.
          </QBanner>
          <QBanner
            v-if="resetError"
            class="bg-red-1 text-negative q-mb-md"
            data-testid="password-error"
          >
            {{ resetError }}
          </QBanner>
          <QInput
            v-model="resetPassword"
            autocomplete="new-password"
            outlined
            :type="showResetPassword ? 'text' : 'password'"
            label="Nova senha"
            :error="Boolean(resetPasswordValidation)"
            :error-message="resetPasswordValidation"
          >
            <template #append
              ><QBtn
                flat
                round
                dense
                :icon="showResetPassword ? 'visibility_off' : 'visibility'"
                aria-label="Mostrar ou ocultar senha"
                @click="showResetPassword = !showResetPassword"
            /></template>
          </QInput>
          <QInput
            v-model="resetPasswordConfirmation"
            autocomplete="new-password"
            outlined
            :type="showResetPassword ? 'text' : 'password'"
            label="Confirmar nova senha"
            :error="Boolean(resetConfirmationValidation)"
            :error-message="resetConfirmationValidation"
          /> </QCardSection
        ><QCardActions align="right">
          <QBtn flat label="Cancelar" :disable="saving" @click="closeReset" /><QBtn
            data-testid="save-password"
            color="primary"
            label="Redefinir e revogar sessões"
            :loading="saving"
            :disable="saving || !resetValid"
            @click="confirmReset"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog
      :model-value="Boolean(deleteTarget)"
      persistent
      @update:model-value="
        (open) => {
          if (!open) closeDelete();
        }
      "
    >
      <QCard class="registry-dialog compact" data-testid="delete-user-dialog">
        <ModalHeader title="Excluir usuário" :close-disabled="saving" @close="closeDelete" />
        <QCardSection class="modal-scroll-body"
          ><p>Confirme a exclusão de {{ deleteTarget?.nome }} com sua senha atual.</p>
          <QInput
            v-model="deletePassword"
            outlined
            type="password"
            autocomplete="current-password"
            label="Senha atual *"
            @keyup.enter="confirmDelete"
          /><QBanner v-if="deleteError" class="bg-red-1 text-negative q-mt-md">{{
            deleteError
          }}</QBanner></QCardSection
        >
        <QCardActions align="right"
          ><QBtn flat label="Cancelar" :disable="saving" @click="closeDelete" /><QBtn
            color="negative"
            label="Excluir"
            :loading="saving"
            :disable="saving || !deletePassword"
            @click="confirmDelete"
        /></QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>
