import { Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

import FoundationPage from '@/pages/FoundationPage.vue';

describe('FoundationPage', () => {
  it('exibe a área administrativa sem badges de desenvolvimento e informa a prontidão', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            checks: { database: 'up' },
            service: 'seduc-api',
            status: 'ready',
            timestamp: '2026-09-30T15:00:00.000Z',
          }),
          { status: 200 },
        ),
      ),
    );

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ component: FoundationPage, path: '/' }],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(FoundationPage, {
      global: {
        plugins: [Quasar, router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Área autenticada');
    expect(wrapper.text()).toContain('módulos operacionais estão protegidos conforme o perfil');
    expect(wrapper.text()).toContain('API e PostgreSQL disponíveis');
    expect(wrapper.text()).not.toMatch(/ETAPA \d+/i);
  });
});
