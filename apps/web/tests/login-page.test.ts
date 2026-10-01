import { Quasar } from 'quasar';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthHttpError } from '@/services/auth.service';
import LoginPage from '@/pages/LoginPage.vue';

const sessionMock = vi.hoisted(() => ({
  login: vi.fn(),
  state: { status: 'guest' },
}));

vi.mock('@/stores/session.store', () => ({
  sessionStore: sessionMock,
}));

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: { template: '<div>protegida</div>' }, name: 'foundation', path: '/' },
      { component: LoginPage, name: 'login', path: '/login' },
    ],
  });
  await router.push('/login');
  await router.isReady();

  const wrapper = mount(LoginPage, {
    global: { plugins: [Quasar, router] },
  });

  return { router, wrapper };
}

describe('LoginPage', () => {
  beforeEach(() => {
    sessionMock.login.mockReset();
    sessionMock.login.mockResolvedValue(undefined);
  });

  it('monta o formulário administrativo sem cadastro público', async () => {
    const { wrapper } = await mountPage();

    expect(wrapper.get('[data-testid="login-form"]').element).toBeInstanceOf(HTMLFormElement);
    expect(wrapper.text()).toContain('Login ou e-mail');
    expect(wrapper.text()).not.toMatch(/criar conta|cadastre-se/i);
  });

  it('envia as credenciais informadas e navega para a área protegida', async () => {
    const { router, wrapper } = await mountPage();
    await wrapper.get('[data-testid="login-identifier"]').setValue('diretora');
    await wrapper.get('[data-testid="login-password"]').setValue('senha-segura');
    await wrapper.get('[data-testid="login-form"]').trigger('submit');
    await flushPromises();

    expect(sessionMock.login).toHaveBeenCalledWith({
      identifier: 'diretora',
      password: 'senha-segura',
    });
    expect(router.currentRoute.value.name).toBe('foundation');
  });

  it('exibe a mensagem segura devolvida em falha de autenticação', async () => {
    sessionMock.login.mockRejectedValue(new AuthHttpError(401, 'Login/e-mail ou senha inválidos.'));
    const { wrapper } = await mountPage();
    await wrapper.get('[data-testid="login-identifier"]').setValue('inexistente');
    await wrapper.get('[data-testid="login-password"]').setValue('incorreta');
    await wrapper.get('[data-testid="login-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-testid="login-error"]').text()).toBe(
      'Login/e-mail ou senha inválidos.',
    );
  });
});
