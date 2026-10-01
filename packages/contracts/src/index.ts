export interface LiveHealthResponse {
  service: 'seduc-api';
  status: 'ok';
  timestamp: string;
}

export interface ReadyHealthResponse {
  checks: {
    database: 'up';
  };
  service: 'seduc-api';
  status: 'ready';
  timestamp: string;
}

export interface UnreadyHealthResponse {
  checks: {
    database: 'down';
  };
  service: 'seduc-api';
  status: 'unavailable';
  timestamp: string;
}

export type HealthResponse = ReadyHealthResponse | UnreadyHealthResponse;

export const USER_PROFILES = ['ADMINISTRADOR', 'OPERADOR', 'DIRETOR', 'SECRETARIO'] as const;

export type UserProfile = (typeof USER_PROFILES)[number];

export interface AuthenticatedUnit {
  id: string;
  nome: string;
}

export interface AuthenticatedUser {
  email: string | null;
  id: string;
  login: string;
  nome: string;
  perfil: UserProfile;
  unidade: AuthenticatedUnit | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
}
