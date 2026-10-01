import { createMemoryHistory } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

import { createAppRouter } from '@/router';
import type { SessionStore } from '@/stores/session.store';

function createSession(status: SessionStore['state']['status']): SessionStore {
  return {
    state: { status, user: null },
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
}

describe('proteção de rotas', () => {
  it('redireciona visitante da rota protegida para o login', async () => {
    const session = createSession('guest');
    const router = createAppRouter(session, createMemoryHistory());

    await router.push('/');

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/');
  });

  it('restaura a sessão antes de liberar uma rota protegida', async () => {
    const session = createSession('unknown');
    vi.mocked(session.restore).mockImplementation(() => {
      Object.assign(session.state, { status: 'authenticated' });
      return Promise.resolve();
    });
    const router = createAppRouter(session, createMemoryHistory());

    await router.push('/');

    expect(session.restore).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.name).toBe('foundation');
  });
});
