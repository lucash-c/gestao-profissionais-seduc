import { QLayout, QPageContainer, QSelect, Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdministrativeCorrectionPage from '@/pages/AdministrativeCorrectionPage.vue';
import AuditHistoryPage from '@/pages/AuditHistoryPage.vue';

const mocks = vi.hoisted(() => ({
  applyCorrection: vi.fn(),
  list: vi.fn(),
  previewCorrection: vi.fn(),
}));
vi.mock('@/services/audit.service', () => ({ auditApi: mocks }));

const RECORD_ID = '11111111-1111-4111-8111-111111111111';
const preview = {
  antes: { id: RECORD_ID, nomeCompleto: 'Nome anterior' },
  depois: { id: RECORD_ID, nomeCompleto: 'Nome corrigido' },
  entidade: 'PROFISSIONAL' as const,
  registroId: RECORD_ID,
};
const audit = {
  acao: 'UPDATE' as const,
  dadosAnteriores: preview.antes,
  dadosNovos: preview.depois,
  dataHora: '2026-10-08T15:00:00.000Z',
  entidade: 'PROFISSIONAL',
  id: '22222222-2222-4222-8222-222222222222',
  profissionalId: RECORD_ID,
  registroId: RECORD_ID,
  unidadeId: null,
  usuario: { id: '33333333-3333-4333-8333-333333333333', login: 'admin', nome: 'Admin' },
  usuarioId: '33333333-3333-4333-8333-333333333333',
};

async function mountPage(component: object) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ component: { template: '<div />' }, path: '/:pathMatch(.*)*' }],
  });
  const wrapper = mount(
    {
      components: { QLayout, QPageContainer, TargetPage: component },
      template: '<QLayout><QPageContainer><TargetPage /></QPageContainer></QLayout>',
    },
    { attachTo: document.body, global: { plugins: [Quasar, router], stubs: { teleport: true } } },
  );
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ items: [audit], page: 1, pageSize: 20, total: 1, totalPages: 1 });
  mocks.previewCorrection.mockResolvedValue(preview);
  mocks.applyCorrection.mockResolvedValue(preview);
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('Etapa 9 frontend administrativo', () => {
  it('lista, filtra, pagina no servidor e abre detalhes ANTES/DEPOIS', async () => {
    const wrapper = await mountPage(AuditHistoryPage);
    expect(wrapper.get('[data-testid="audit-table"]').text()).toContain('PROFISSIONAL');
    await wrapper.get('[data-testid="audit-filter"]').trigger('click');
    await flushPromises();
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }));
    await wrapper
      .findAll('button')
      .find((item) => item.text().includes('Detalhes'))!
      .trigger('click');
    await flushPromises();
    const details = wrapper.get('[data-testid="audit-details"]');
    expect(details.text()).toContain('ANTES');
    expect(details.text()).toContain('DEPOIS');
    wrapper.unmount();
  });

  it('mantém aviso permanente e exige prévia explícita antes da correção', async () => {
    const wrapper = await mountPage(AdministrativeCorrectionPage);
    expect(wrapper.get('[data-testid="correction-warning"]').text()).toContain(
      'não geram auditoria técnica nem movimentação de evento',
    );
    await wrapper.get('[data-testid="correction-record"]').setValue(RECORD_ID);
    await wrapper.get('[data-testid="correction-value"]').setValue('Nome corrigido');
    await wrapper.get('[data-testid="review-correction"]').trigger('click');
    await flushPromises();
    expect(mocks.applyCorrection).not.toHaveBeenCalled();
    const dialog = wrapper.get('[data-testid="correction-dialog"]');
    expect(dialog.text()).toContain('ANTES');
    expect(dialog.text()).toContain('DEPOIS');
    wrapper.unmount();
  });

  it('bloqueia dupla submissão na confirmação excepcional', async () => {
    let finish!: (value: typeof preview) => void;
    mocks.applyCorrection.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = await mountPage(AdministrativeCorrectionPage);
    const selects = wrapper.findAllComponents(QSelect);
    await selects[0]!.setValue('PROFISSIONAL');
    await wrapper.get('[data-testid="correction-record"]').setValue(RECORD_ID);
    await wrapper.get('[data-testid="correction-value"]').setValue('Nome corrigido');
    await wrapper.get('[data-testid="review-correction"]').trigger('click');
    await flushPromises();
    const confirm = wrapper.get('[data-testid="confirm-correction"]');
    await confirm.trigger('click');
    await confirm.trigger('click');
    expect(mocks.applyCorrection).toHaveBeenCalledTimes(1);
    finish(preview);
    await flushPromises();
    expect(wrapper.text()).toContain('Correção administrativa aplicada');
    wrapper.unmount();
  });
});
