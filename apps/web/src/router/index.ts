import { createRouter, createWebHistory } from 'vue-router';

import FoundationPage from '@/pages/FoundationPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      component: FoundationPage,
      name: 'foundation',
      path: '/',
    },
  ],
});
