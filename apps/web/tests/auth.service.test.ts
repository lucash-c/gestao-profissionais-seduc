import type { AuthenticatedUser } from '@seduc/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '@/services/auth.service';

const user: AuthenticatedUser = {
  email: 'admin@seduc.test',
  id: '00000000-0000-4000-8000-000000000001',
  login: 'admin',
  nome: 'Administrador',
  perfil: 'ADMINISTRADOR',
  unidade: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authApi', () => {
  it('envia login e senha à rota de autenticação com credenciais de cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.login({ identifier: 'admin', password: 'senha-segura' })).resolves.toEqual(
      user,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        body: JSON.stringify({ identifier: 'admin', password: 'senha-segura' }),
        credentials: 'include',
        method: 'POST',
      }),
    );
  });

  it('restaura a identidade pela rota /auth/me', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.getCurrentUser()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('encerra a sessão usando cookie e sem armazenamento local', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      credentials: 'include',
      method: 'POST',
    });
  });
});
