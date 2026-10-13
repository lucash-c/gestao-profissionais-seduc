<script setup lang="ts">
import {
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
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import logoSeduc from '@/assets/branding/logo-seduc-americana.png';
import { manualAssignmentApi } from '@/services/manual-assignment.service';
import { sessionStore } from '@/stores/session.store';

const drawerOpen = ref(true);
const router = useRouter();
const user = computed(() => sessionStore.state.user);
const isAdmin = computed(() => user.value?.perfil === 'ADMINISTRADOR');
const isOperator = computed(() => user.value?.perfil === 'OPERADOR');
const canReadEvents = computed(() => isAdmin.value || isOperator.value);
const canReadStaffing = computed(
  () => user.value?.perfil === 'ADMINISTRADOR' || user.value?.perfil === 'OPERADOR',
);
const manualAssignmentEnabled = ref(false);
const canSeeManualAssignment = computed(
  () => isAdmin.value || (user.value?.perfil === 'DIRETOR' && manualAssignmentEnabled.value),
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

onMounted(async () => {
  if (!['ADMINISTRADOR', 'DIRETOR'].includes(user.value?.perfil ?? '')) return;
  try {
    manualAssignmentEnabled.value = (await manualAssignmentApi.configuration()).habilitada;
  } catch {
    manualAssignmentEnabled.value = false;
  }
});
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
        <img
          class="header-logo"
          :src="logoSeduc"
          alt="Prefeitura de Americana — Secretaria de Educação"
        />
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

    <QDrawer
      v-model="drawerOpen"
      bordered
      show-if-above
      :breakpoint="1024"
      :width="276"
      class="admin-drawer"
    >
      <QList padding aria-label="Navegação principal">
        <div class="nav-section-label">Cadastros</div>
        <QItem clickable :to="{ name: 'units' }" active-class="nav-active">
          <QItemSection avatar><span class="material-icons">apartment</span></QItemSection>
          <QItemSection>Unidades</QItemSection>
        </QItem>
        <QItem clickable :to="{ name: 'professionals' }" active-class="nav-active">
          <QItemSection avatar><span class="material-icons">groups</span></QItemSection>
          <QItemSection>Profissionais</QItemSection>
        </QItem>
        <div v-if="canReadStaffing" class="nav-section-label">Quadro</div>
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
        <div v-if="canReadEvents" class="nav-section-label">Eventos</div>
        <QItem
          v-if="canReadEvents"
          data-testid="events-menu"
          clickable
          :to="{ name: 'events' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">event</span></QItemSection>
          <QItemSection>Eventos</QItemSection>
        </QItem>
        <div v-if="canSeeManualAssignment" class="nav-section-label">Implantação</div>
        <QItem
          v-if="canSeeManualAssignment"
          data-testid="manual-assignment-menu"
          clickable
          :to="{ name: 'manual-assignment' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">assignment_ind</span></QItemSection>
          <QItemSection>Atribuição manual</QItemSection>
        </QItem>
        <div v-if="isAdmin" class="nav-section-label">Administração</div>
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
        <QItem
          v-if="isAdmin"
          data-testid="audit-menu"
          clickable
          :to="{ name: 'audit-history' }"
          active-class="nav-active"
        >
          <QItemSection avatar><span class="material-icons">history</span></QItemSection>
          <QItemSection>Auditoria / Histórico</QItemSection>
        </QItem>
      </QList>
    </QDrawer>

    <QPageContainer>
      <RouterView />
    </QPageContainer>
  </QLayout>
</template>
