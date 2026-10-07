import { createMemoryHistory } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@seduc/contracts';

import { createAppRouter } from '@/router';
import type { SessionStore } from '@/stores/session.store';

function createSession(
  status: SessionStore['state']['status'],
  profile: UserProfile = 'OPERADOR',
): SessionStore {
  return {
    state: {
      status,
      user:
        status === 'authenticated'
          ? {
              email: null,
              id: 'usuario-1',
              login: profile.toLowerCase(),
              nome: profile,
              perfil: profile,
              unidades:
                profile === 'DIRETOR' || profile === 'SECRETARIO'
                  ? [{ id: 'unidade-a', nome: 'Unidade A' }]
                  : [],
            }
          : null,
    },
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
}

describe('proteção de rotas', () => {
  it('libera o telão público sem autenticação administrativa', async () => {
    const session = createSession('guest');
    const router = createAppRouter(session, createMemoryHistory());

    await router.push('/publico/eventos/11111111-1111-4111-8111-111111111111');

    expect(router.currentRoute.value.name).toBe('public-event-display');
    expect(session.restore).not.toHaveBeenCalled();
  });

  it('redireciona visitante da rota protegida para o login', async () => {
    const session = createSession('guest');
    const router = createAppRouter(session, createMemoryHistory());

    await router.push('/');

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/unidades');
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
    expect(router.currentRoute.value.name).toBe('units');
  });

  it('redireciona Operador para Unidades ao tentar acessar páginas exclusivas de Admin', async () => {
    const session = createSession('authenticated');
    const router = createAppRouter(session, createMemoryHistory());

    await router.push('/usuarios');
    expect(router.currentRoute.value.name).toBe('units');

    await router.push('/pontuacoes');
    expect(router.currentRoute.value.name).toBe('units');

    await router.push('/auditoria');
    expect(router.currentRoute.value.name).toBe('units');

    await router.push('/correcao-administrativa');
    expect(router.currentRoute.value.name).toBe('units');
  });

  it('permite Quadro/Postos ao Operador e bloqueia os perfis escolares', async () => {
    const operatorRouter = createAppRouter(createSession('authenticated'), createMemoryHistory());
    await operatorRouter.push('/quadros');
    expect(operatorRouter.currentRoute.value.name).toBe('staffing-plans');
    await operatorRouter.push('/postos');
    expect(operatorRouter.currentRoute.value.name).toBe('work-positions');

    for (const profile of ['DIRETOR', 'SECRETARIO'] as const) {
      const schoolRouter = createAppRouter(
        createSession('authenticated', profile),
        createMemoryHistory(),
      );
      await schoolRouter.push('/quadros');
      expect(schoolRouter.currentRoute.value.name).toBe('units');
    }
  });
});
