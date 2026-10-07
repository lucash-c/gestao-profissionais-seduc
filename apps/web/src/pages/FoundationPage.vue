<script setup lang="ts">
import {
  QAvatar,
  QBtn,
  QCard,
  QCardSection,
  QChip,
  QHeader,
  QLayout,
  QPage,
  QPageContainer,
  QSeparator,
  QToolbar,
  QToolbarTitle,
} from 'quasar';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getApiReadiness } from '@/services/health.service';
import { sessionStore } from '@/stores/session.store';

type ApiState = 'checking' | 'ready' | 'unavailable';

const apiState = ref<ApiState>('checking');
const controller = new AbortController();
const router = useRouter();
const authenticatedUser = computed(() => sessionStore.state.user);

const profileLabels = {
  ADMINISTRADOR: 'Administrador',
  DIRETOR: 'Diretor de Unidade',
  OPERADOR: 'Operador',
  SECRETARIO: 'Secretário Escolar',
} as const;

onMounted(async () => {
  try {
    await getApiReadiness(controller.signal);
    apiState.value = 'ready';
  } catch {
    apiState.value = 'unavailable';
  }
});

onBeforeUnmount(() => controller.abort());

async function logout(): Promise<void> {
  try {
    await sessionStore.logout();
  } finally {
    await router.replace({ name: 'login' });
  }
}
</script>

<template>
  <QLayout view="hHh lpR fFf" class="foundation-layout">
    <QHeader class="institutional-header">
      <QToolbar class="foundation-toolbar">
        <div class="brand-mark" aria-hidden="true">S</div>
        <QToolbarTitle>
          <span class="brand-title">SEDUC AMERICANA</span>
          <span class="brand-subtitle">Gestão de Remoção e Vagas</span>
        </QToolbarTitle>
        <div v-if="authenticatedUser" class="session-summary">
          <span>{{ authenticatedUser.nome }}</span>
          <small>
            {{ profileLabels[authenticatedUser.perfil] }}
            <span v-if="authenticatedUser.unidades.length">
              · {{ authenticatedUser.unidades.map((unit) => unit.nome).join(', ') }}
            </span>
          </small>
        </div>
        <QBtn
          v-if="authenticatedUser"
          aria-label="Sair do sistema"
          class="q-ml-sm"
          color="white"
          data-testid="logout-button"
          flat
          icon="logout"
          round
          @click="logout"
        />
      </QToolbar>
    </QHeader>

    <QPageContainer>
      <QPage class="foundation-page">
        <main class="foundation-content">
          <QCard flat bordered class="foundation-card">
            <QCardSection class="row items-start no-wrap q-gutter-md">
              <QAvatar color="primary" text-color="white" icon="foundation" size="52px" />
              <div>
                <div class="text-overline text-primary">Área autenticada</div>
                <h1 class="text-h5 q-my-xs">Sistema administrativo disponível</h1>
                <p class="text-body2 text-grey-8 q-mb-none">
                  Autenticação, controle de acesso e módulos operacionais estão protegidos conforme
                  o perfil da conta.
                </p>
              </div>
            </QCardSection>

            <QSeparator />

            <QCardSection>
              <div class="text-subtitle2 q-mb-sm">Estado da API e do banco</div>
              <QChip
                v-if="apiState === 'checking'"
                color="blue-1"
                text-color="primary"
                icon="sync"
                label="Verificando prontidão"
              />
              <QChip
                v-else-if="apiState === 'ready'"
                color="green-1"
                text-color="green-9"
                icon="check_circle"
                label="API e PostgreSQL disponíveis"
              />
              <QChip
                v-else
                color="orange-1"
                text-color="orange-10"
                icon="warning"
                label="API ou PostgreSQL indisponível"
              />
            </QCardSection>
          </QCard>
        </main>
      </QPage>
    </QPageContainer>
  </QLayout>
</template>
