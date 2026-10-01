import type { AuthenticatedUser, UserProfile } from '@seduc/contracts';

import { HttpError } from '../../http/http-error.js';

export const AUTHORIZATION_ACTIONS = {
  ACCESS_ADMIN_CORRECTION: 'correcao-administrativa:acessar',
  EDIT_PROFESSIONAL: 'profissional:editar',
  EDIT_PROFESSIONAL_PARTICIPATION: 'profissional:manifestacao:editar',
  EDIT_PROFESSIONAL_SCORE: 'profissional:pontuacao:editar',
  EDIT_UNIT: 'unidade:editar',
  MANAGE_EVENT: 'evento:gerenciar',
  MANAGE_USERS: 'usuario:gerenciar',
  OPERATE_EVENT: 'evento:operar',
  READ_REGISTRIES: 'cadastro:consultar',
} as const;

export type AuthorizationAction =
  (typeof AUTHORIZATION_ACTIONS)[keyof typeof AUTHORIZATION_ACTIONS];

type AuthorizationScope = 'GLOBAL' | 'OWN_UNIT';

const grants: Record<UserProfile, Partial<Record<AuthorizationAction, AuthorizationScope>>> = {
  ADMINISTRADOR: {
    [AUTHORIZATION_ACTIONS.ACCESS_ADMIN_CORRECTION]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_PARTICIPATION]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_SCORE]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_UNIT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.MANAGE_USERS]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'GLOBAL',
  },
  DIRETOR: {
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_PARTICIPATION]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_UNIT]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'OWN_UNIT',
  },
  OPERADOR: {
    [AUTHORIZATION_ACTIONS.MANAGE_EVENT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.OPERATE_EVENT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'GLOBAL',
  },
  SECRETARIO: {
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_PARTICIPATION]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_UNIT]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'OWN_UNIT',
  },
};

export function isAuthorized(input: {
  action: AuthorizationAction;
  resourceUnitId?: string;
  user: AuthenticatedUser;
}): boolean {
  const scope = grants[input.user.perfil][input.action];
  if (scope === 'GLOBAL') {
    return true;
  }

  if (scope === 'OWN_UNIT') {
    return Boolean(
      input.resourceUnitId &&
      input.user.unidade?.id &&
      input.resourceUnitId === input.user.unidade.id,
    );
  }

  return false;
}

export function assertAuthorized(input: {
  action: AuthorizationAction;
  resourceUnitId?: string;
  user: AuthenticatedUser;
}): void {
  if (!isAuthorized(input)) {
    throw new HttpError(403, 'FORBIDDEN', 'Acesso não autorizado.');
  }
}
