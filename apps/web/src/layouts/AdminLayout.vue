<script setup lang="ts">
import {
  QBadge,
  QBtn,
  QDrawer,
  QHeader,
  QItem,
  QItemSection,
  QLayout,
  QList,
  QPageContainer,
  QToolbar,
  QToolbarTitle,
} from 'quasar';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { sessionStore } from '@/stores/session.store';

const drawerOpen = ref(true);
const router = useRouter();
const user = computed(() => sessionStore.state.user);
const isAdmin = computed(() => user.value?.perfil === 'ADMINISTRADOR');
const isOperator = computed(() => user.value?.perfil === 'OPERADOR');
const canReadStaffing = computed(
  () => user.value?.perfil === 'ADMINISTRADOR' || user.value?.perfil === 'OPERADOR',
);

const profileLabels = {
  ADMINISTRADOR: 'Administrador',
  DIRETOR: 'Diretor de Unidade',
  OPERADOR: 'Operador',
  SECRETARIO: 'Secretário Escolar',
} as const;

async function logout(): Promise<void> {
  try {
    await sessionStore.logout();
  } finally {
    await router.replace({ name: 'login' });
  }
}
</script>

<template>
  <QLayout view="hHh Lpr fFf" class="admin-layout">
    <QHeader class="institutional-header">
      <QToolbar class="foundation-toolbar">
        <QBtn
          aria-label="Alternar menu"
          flat
          round
          dense
          icon="menu"
          @click="drawerOpen = !drawerOpen"
        />
        <div class="brand-mark" aria-hidden="true">A</div>
        <QToolbarTitle>
          <span class="brand-title">SEDUC AMERICANA</span>
          <span class="brand-subtitle">Gestão de Profissionais</span>
        </QToolbarTitle>
        <div v-if="user" class="session-summary">
          <span>{{ user.nome }}</span>
          <small
            >{{ profileLabels[user.perfil]
            }}<span v-if="user.unidades.length">
              · {{ user.unidades.map((unit) => unit.nome).join(', ') }}</span
            ></small
          >
        </div>
        <QBadge color="blue-2" text-color="blue-10" label="ETAPA 6" />
        <QBtn
          aria-label="Sair do sistema"
          data-testid="logout-button"
          flat
          round
          icon="logout"
          @click="logout"
        />
      </QToolbar>
    </QHeader>

    <QDrawer v-model="drawerOpen" bordered :width="240" class="admin-drawer">
      <QList padding>
        <QItem clickable :to="{ name: 'units' }" active-class="nav-active">
          <QItemSection avatar><span class="material-icons">apartment</span></QItemSection>
          <QItemSection>Unidades</QItemSection>
        </QItem>
        <QItem clickable :to="{ name: 'professionals' }" active-class="nav-active">
          <QItemSection avatar><span class="material-icons">groups</span></QItemSection>
          <QItemSection>Profissionais</QItemSection>
        </QItem>
        <QItem
          v-if="isOperator"
          data-testid="events-menu"
          clickable
          :to="{ name: 'events' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">event</span></QItemSection>
          <QItemSection>Eventos</QItemSection>
        </QItem>
        <QItem
          v-if="canReadStaffing"
          data-testid="staffing-plans-menu"
          clickable
          :to="{ name: 'staffing-plans' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">table_view</span></QItemSection>
          <QItemSection>Quadro de Necessidades</QItemSection>
        </QItem>
        <QItem
          v-if="canReadStaffing"
          data-testid="work-positions-menu"
          clickable
          :to="{ name: 'work-positions' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">work</span></QItemSection>
          <QItemSection>Postos de Trabalho</QItemSection>
        </QItem>
        <QItem
          v-if="isAdmin"
          data-testid="scores-menu"
          clickable
          :to="{ name: 'scores' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">score</span></QItemSection>
          <QItemSection>Pontuações</QItemSection>
        </QItem>
        <QItem
          v-if="isAdmin"
          data-testid="users-menu"
          clickable
          :to="{ name: 'users' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">manage_accounts</span></QItemSection>
          <QItemSection>Usuários</QItemSection>
        </QItem>
      </QList>
    </QDrawer>

    <QPageContainer>
      <RouterView />
    </QPageContainer>
  </QLayout>
</template>
