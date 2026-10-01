import type { AuthenticatedUser, LoginRequest } from '@seduc/contracts';
import { reactive, readonly } from 'vue';

import { AuthHttpError, authApi, type AuthApi } from '@/services/auth.service';

export type SessionStatus = 'authenticated' | 'guest' | 'loading' | 'unknown';

interface SessionState {
  status: SessionStatus;
  user: AuthenticatedUser | null;
}

export interface SessionStore {
  readonly state: Readonly<SessionState>;
  login(credentials: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  restore(): Promise<void>;
}

export function createSessionStore(api: AuthApi = authApi): SessionStore {
  const state = reactive<SessionState>({
    status: 'unknown',
    user: null,
  });

  return {
    state: readonly(state),

    async login(credentials) {
      state.status = 'loading';

      try {
        state.user = await api.login(credentials);
        state.status = 'authenticated';
      } catch (error) {
        state.user = null;
        state.status = 'guest';
        throw error;
      }
    },

    async logout() {
      try {
        await api.logout();
      } finally {
        state.user = null;
        state.status = 'guest';
      }
    },

    async restore() {
      if (state.status !== 'unknown') {
        return;
      }

      state.status = 'loading';

      try {
        state.user = await api.getCurrentUser();
        state.status = 'authenticated';
      } catch (error) {
        state.user = null;
        state.status = 'guest';

        if (!(error instanceof AuthHttpError && error.status === 401)) {
          throw error;
        }
      }
    },
  };
}

export const sessionStore = createSessionStore();
