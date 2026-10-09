import { QLayout, QPageContainer, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuditHistoryPage from '@/pages/AuditHistoryPage.vue';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/audit.service', () => ({ auditApi: mocks }));

const audit = {
  acao: 'UPDATE' as const,
  dadosAnteriores: { nomeCompleto: 'Nome anterior' },
  dadosNovos: { nomeCompleto: 'Nome alterado' },
  dataHora: '2026-10-08T15:00:00.000Z',
  entidade: 'PROFISSIONAL',
  id: '22222222-2222-4222-8222-222222222222',
  profissionalId: '11111111-1111-4111-8111-111111111111',
  registroId: '11111111-1111-4111-8111-111111111111',
  unidadeId: null,
  usuario: { id: '33333333-3333-4333-8333-333333333333', login: 'diretor', nome: 'Diretor' },
  usuarioId: '33333333-3333-4333-8333-333333333333',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ items: [audit], page: 1, pageSize: 20, total: 1, totalPages: 1 });
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('histórico de auditoria', () => {
  it('lista o resumo administrativo e preserva os detalhes técnicos no mesmo registro', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ component: { template: '<div />' }, path: '/:pathMatch(.*)*' }],
    });
    const wrapper = mount(
      {
        components: { AuditHistoryPage, QLayout, QPageContainer },
        template: '<QLayout><QPageContainer><AuditHistoryPage /></QPageContainer></QLayout>',
      },
      { attachTo: document.body, global: { plugins: [Quasar, router], stubs: { teleport: true } } },
    );
    await flushPromises();
    const table = wrapper.get('[data-testid="audit-table"]');
    expect(table.text()).toContain('Cadastro de profissional atualizado');
    expect(table.text()).toContain('Nome alterado');
    expect(table.text()).toContain('Responsável');
    expect(table.text()).toContain('Diretor');
    expect(table.text()).toContain('Ver detalhes técnicos (JSON)');
    await wrapper.get('[data-testid="audit-filter"]').trigger('click');
    await flushPromises();
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }));
    wrapper.unmount();
  });

  it('exibe estado vazio sem renderizar Página 1 de 0', async () => {
    mocks.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ component: { template: '<div />' }, path: '/:pathMatch(.*)*' }],
    });
    const wrapper = mount(
      {
        components: { AuditHistoryPage, QLayout, QPageContainer },
        template: '<QLayout><QPageContainer><AuditHistoryPage /></QPageContainer></QLayout>',
      },
      { attachTo: document.body, global: { plugins: [Quasar, router] } },
    );
    await flushPromises();

    expect(wrapper.get('[data-testid="audit-empty"]').text()).toBe(
      'Nenhum registro de auditoria encontrado.',
    );
    expect(wrapper.find('[data-testid="audit-table"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Página 1 de 0');
    wrapper.unmount();
  });
});
