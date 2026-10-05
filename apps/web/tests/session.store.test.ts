import type { AuthenticatedUser } from '@seduc/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { AuthApi } from '@/services/auth.service';
import { createSessionStore } from '@/stores/session.store';

const user: AuthenticatedUser = {
  email: null,
  id: '00000000-0000-4000-8000-000000000002',
  login: 'operador',
  nome: 'Operador',
  perfil: 'OPERADOR',
  unidades: [],
};

function createApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    login: vi.fn().mockResolvedValue(user),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createSessionStore', () => {
  it('restaura a sessão pelo backend uma única vez', async () => {
    const api = createApi();
    const store = createSessionStore(api);

    await store.restore();
    await store.restore();

    expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(store.state.status).toBe('authenticated');
    expect(store.state.user).toEqual(user);
  });

  it('limpa a identidade local mesmo quando o logout remoto falha', async () => {
    const api = createApi({ logout: vi.fn().mockRejectedValue(new Error('offline')) });
    const store = createSessionStore(api);
    await store.login({ identifier: 'operador', password: 'senha' });

    await expect(store.logout()).rejects.toThrow('offline');
    expect(store.state.status).toBe('guest');
    expect(store.state.user).toBeNull();
  });
});
