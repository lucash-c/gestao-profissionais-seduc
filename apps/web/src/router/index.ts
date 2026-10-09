import { createRouter, createWebHistory, type Router, type RouterHistory } from 'vue-router';

import AdminLayout from '@/layouts/AdminLayout.vue';
import PublicLayout from '@/layouts/PublicLayout.vue';
import AuditHistoryPage from '@/pages/AuditHistoryPage.vue';
import EventOperationsPage from '@/pages/EventOperationsPage.vue';
import EventMinutesPage from '@/pages/EventMinutesPage.vue';
import EventExchangePage from '@/pages/EventExchangePage.vue';
import EventPreparationPage from '@/pages/EventPreparationPage.vue';
import EventsPage from '@/pages/EventsPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import ManualAssignmentPage from '@/pages/ManualAssignmentPage.vue';
import ProfessionalsPage from '@/pages/ProfessionalsPage.vue';
import PublicEventDisplayPage from '@/pages/PublicEventDisplayPage.vue';
import ScoresPage from '@/pages/ScoresPage.vue';
import StaffingPlansPage from '@/pages/StaffingPlansPage.vue';
import UnitsPage from '@/pages/UnitsPage.vue';
import UsersPage from '@/pages/UsersPage.vue';
import WorkPositionsPage from '@/pages/WorkPositionsPage.vue';
import { sessionStore, type SessionStore } from '@/stores/session.store';

export function createAppRouter(
  session: SessionStore = sessionStore,
  history: RouterHistory = createWebHistory(),
): Router {
  const appRouter = createRouter({
    history,
    routes: [
      {
        component: LoginPage,
        meta: { public: true },
        name: 'login',
        path: '/login',
      },
      {
        children: [
          {
            component: PublicEventDisplayPage,
            meta: { publicAccess: true },
            name: 'public-event-display',
            path: 'eventos/:id',
          },
        ],
        component: PublicLayout,
        meta: { publicAccess: true },
        path: '/publico',
      },
      {
        children: [
          { path: '', redirect: { name: 'units' } },
          { component: UnitsPage, name: 'units', path: 'unidades' },
          { component: ProfessionalsPage, name: 'professionals', path: 'profissionais' },
          {
            component: EventsPage,
            meta: { profiles: ['ADMINISTRADOR', 'OPERADOR'] },
            name: 'events',
            path: 'eventos',
          },
          {
            component: EventMinutesPage,
            meta: { profiles: ['ADMINISTRADOR', 'OPERADOR'] },
            name: 'event-minutes',
            path: 'eventos/:id/ata',
          },
          {
            component: EventOperationsPage,
            meta: { profiles: ['OPERADOR'] },
            name: 'event-operations',
            path: 'eventos/:id/central',
          },
          {
            component: EventExchangePage,
            meta: { profiles: ['OPERADOR'] },
            name: 'event-exchange',
            path: 'eventos/:id/permuta',
          },
          {
            component: EventPreparationPage,
            meta: { profiles: ['OPERADOR'] },
            name: 'event-preparation',
            path: 'eventos/:id/preparacao',
          },
          {
            component: StaffingPlansPage,
            meta: { profiles: ['ADMINISTRADOR', 'OPERADOR'] },
            name: 'staffing-plans',
            path: 'quadros',
          },
          {
            component: WorkPositionsPage,
            meta: { profiles: ['ADMINISTRADOR', 'OPERADOR'] },
            name: 'work-positions',
            path: 'postos',
          },
          {
            component: ManualAssignmentPage,
            meta: { profiles: ['ADMINISTRADOR', 'DIRETOR'] },
            name: 'manual-assignment',
            path: 'atribuicao-manual',
          },
          {
            component: ScoresPage,
            meta: { profiles: ['ADMINISTRADOR'] },
            name: 'scores',
            path: 'pontuacoes',
          },
          {
            component: UsersPage,
            meta: { profiles: ['ADMINISTRADOR'] },
            name: 'users',
            path: 'usuarios',
          },
          {
            component: AuditHistoryPage,
            meta: { profiles: ['ADMINISTRADOR'] },
            name: 'audit-history',
            path: 'auditoria',
          },
        ],
        component: AdminLayout,
        path: '/',
      },
    ],
  });

  appRouter.beforeEach(async (to) => {
    if (to.meta.publicAccess === true) return true;
    if (to.meta.public === true) {
      return session.state.status === 'authenticated' ? { name: 'units' } : true;
    }

    try {
      await session.restore();
    } catch {
      // Falhas de rede também não liberam rotas protegidas.
    }

    if (session.state.status !== 'authenticated') {
      return { name: 'login', query: { redirect: to.fullPath } };
    }

    const profiles = to.meta.profiles as string[] | undefined;
    if (profiles && session.state.user && !profiles.includes(session.state.user.perfil)) {
      return { name: 'units' };
    }

    return true;
  });

  return appRouter;
}

export const router = createAppRouter();
