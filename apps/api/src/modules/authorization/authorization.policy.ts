import type { AuthenticatedUser, UserProfile } from '@seduc/contracts';

import { HttpError } from '../../http/http-error.js';

export const AUTHORIZATION_ACTIONS = {
  READ_AUDIT: 'auditoria:consultar',
  CREATE_PROFESSIONAL: 'profissional:criar',
  CREATE_UNIT: 'unidade:criar',
  DELETE_RECORD: 'cadastro:excluir',
  EDIT_PROFESSIONAL: 'profissional:editar',
  EDIT_PROFESSIONAL_PARTICIPATION: 'profissional:manifestacao:editar',
  EDIT_PROFESSIONAL_SCORE: 'profissional:pontuacao:editar',
  EDIT_UNIT: 'unidade:editar',
  MANAGE_EVENT: 'evento:gerenciar',
  MANAGE_ABSENCES: 'afastamento:gerenciar',
  MANAGE_MANUAL_ASSIGNMENT_CONFIG: 'atribuicao-manual:configurar',
  MANAGE_STAFFING: 'quadro-posto:gerenciar',
  MANAGE_USERS: 'usuario:gerenciar',
  OPERATE_EVENT: 'evento:operar',
  USE_MANUAL_ASSIGNMENT: 'atribuicao-manual:usar',
  READ_REGISTRIES: 'cadastro:consultar',
  READ_EVENTS: 'evento:consultar',
  READ_STAFFING: 'quadro-posto:consultar',
} as const;

export type AuthorizationAction =
  (typeof AUTHORIZATION_ACTIONS)[keyof typeof AUTHORIZATION_ACTIONS];

type AuthorizationScope = 'GLOBAL' | 'OWN_UNIT';

const grants: Record<UserProfile, Partial<Record<AuthorizationAction, AuthorizationScope>>> = {
  ADMINISTRADOR: {
    [AUTHORIZATION_ACTIONS.READ_AUDIT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.CREATE_PROFESSIONAL]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.CREATE_UNIT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.DELETE_RECORD]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_PARTICIPATION]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_SCORE]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.EDIT_UNIT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.MANAGE_STAFFING]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.MANAGE_ABSENCES]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.MANAGE_MANUAL_ASSIGNMENT_CONFIG]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.MANAGE_USERS]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_EVENTS]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_STAFFING]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.USE_MANUAL_ASSIGNMENT]: 'GLOBAL',
  },
  DIRETOR: {
    [AUTHORIZATION_ACTIONS.MANAGE_ABSENCES]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_PARTICIPATION]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_UNIT]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.USE_MANUAL_ASSIGNMENT]: 'OWN_UNIT',
  },
  OPERADOR: {
    [AUTHORIZATION_ACTIONS.MANAGE_EVENT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.OPERATE_EVENT]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_EVENTS]: 'GLOBAL',
    [AUTHORIZATION_ACTIONS.READ_STAFFING]: 'GLOBAL',
  },
  SECRETARIO: {
    [AUTHORIZATION_ACTIONS.MANAGE_ABSENCES]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_PARTICIPATION]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.EDIT_UNIT]: 'OWN_UNIT',
    [AUTHORIZATION_ACTIONS.READ_REGISTRIES]: 'OWN_UNIT',
  },
};

export function isAuthorized(input: {
  action: AuthorizationAction;
  resourceUnitIds?: string[] | undefined;
  user: AuthenticatedUser;
}): boolean {
  const scope = grants[input.user.perfil][input.action];
  if (scope === 'GLOBAL') {
    return true;
  }

  if (scope === 'OWN_UNIT') {
    const authorizedUnitIds = new Set(input.user.unidades.map((unit) => unit.id));
    return Boolean(input.resourceUnitIds?.some((unitId) => authorizedUnitIds.has(unitId)));
  }

  return false;
}

export function assertAuthorized(input: {
  action: AuthorizationAction;
  resourceUnitIds?: string[] | undefined;
  user: AuthenticatedUser;
}): void {
  if (!isAuthorized(input)) {
    throw new HttpError(403, 'FORBIDDEN', 'Acesso não autorizado.');
  }
}
