import { Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import FoundationPage from '@/pages/FoundationPage.vue';

describe('FoundationPage', () => {
  it('explicita o limite funcional da Etapa 0 e exibe a prontidão', async () => {
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

    const wrapper = mount(FoundationPage, {
      global: {
        plugins: [Quasar],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Fundação técnica');
    expect(wrapper.text()).toContain('Nenhum fluxo de negócio foi implementado');
    expect(wrapper.text()).toContain('API e PostgreSQL disponíveis');
  });
});
