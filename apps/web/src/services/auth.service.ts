import type { AuthenticatedUser, AuthResponse, LoginRequest } from '@seduc/contracts';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
const AUTH_BASE_PATH = `${apiBaseUrl}/auth`;

export class AuthHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AuthHttpError';
  }
}

async function readError(response: Response): Promise<AuthHttpError> {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    retryAfterSeconds?: unknown;
  } | null;
  const message =
    typeof body?.message === 'string' ? body.message : 'Não foi possível concluir a solicitação.';

  return new AuthHttpError(
    response.status,
    message,
    typeof body?.retryAfterSeconds === 'number' ? body.retryAfterSeconds : undefined,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AUTH_BASE_PATH}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...init?.headers,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return (await response.json()) as T;
}

export interface AuthApi {
  getCurrentUser(): Promise<AuthenticatedUser>;
  login(credentials: LoginRequest): Promise<AuthenticatedUser>;
  logout(): Promise<void>;
}

export const authApi: AuthApi = {
  async getCurrentUser() {
    const response = await request<AuthResponse>('/me');
    return response.user;
  },

  async login(credentials) {
    const response = await request<AuthResponse>('/login', {
      body: JSON.stringify(credentials),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    return response.user;
  },

  async logout() {
    const response = await fetch(`${AUTH_BASE_PATH}/logout`, {
      credentials: 'include',
      method: 'POST',
    });

    if (!response.ok) {
      throw await readError(response);
    }
  },
};
