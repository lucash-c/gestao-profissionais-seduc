import { createRouter, createWebHistory, type Router, type RouterHistory } from 'vue-router';

import FoundationPage from '@/pages/FoundationPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
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
        component: FoundationPage,
        name: 'foundation',
        path: '/',
      },
    ],
  });

  appRouter.beforeEach(async (to) => {
    if (to.meta.public === true) {
      return session.state.status === 'authenticated' ? { name: 'foundation' } : true;
    }

    try {
      await session.restore();
    } catch {
      // Falhas de rede também não liberam rotas protegidas.
    }

    if (session.state.status !== 'authenticated') {
      return { name: 'login', query: { redirect: to.fullPath } };
    }

    return true;
  });

  return appRouter;
}

export const router = createAppRouter();
