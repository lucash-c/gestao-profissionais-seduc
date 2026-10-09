import type { AuthenticatedUser, UserProfile } from '@seduc/contracts';
import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_ACTIONS as ACTION,
  assertAuthorized,
  isAuthorized,
} from '../../src/modules/authorization/authorization.policy.js';

function createUser(perfil: UserProfile, unidadeIds: string[] = []): AuthenticatedUser {
  return {
    email: `${perfil.toLowerCase()}@seduc.test`,
    id: `usuario-${perfil}`,
    login: perfil.toLowerCase(),
    nome: perfil,
    perfil,
    unidades: unidadeIds.map((id) => ({ id, nome: `Unidade ${id}` })),
  };
}

describe('central authorization policy', () => {
  it('concede ao ADMINISTRADOR as permissões administrativas previstas', () => {
    const user = createUser('ADMINISTRADOR');

    for (const action of [
      ACTION.EDIT_UNIT,
      ACTION.EDIT_PROFESSIONAL,
      ACTION.EDIT_PROFESSIONAL_PARTICIPATION,
      ACTION.EDIT_PROFESSIONAL_SCORE,
      ACTION.READ_AUDIT,
      ACTION.READ_EVENTS,
      ACTION.DELETE_RECORD,
      ACTION.MANAGE_USERS,
      ACTION.MANAGE_STAFFING,
      ACTION.MANAGE_MANUAL_ASSIGNMENT_ADMINISTRATION,
      ACTION.MANAGE_MANUAL_ASSIGNMENT_CONFIG,
      ACTION.READ_STAFFING,
      ACTION.USE_MANUAL_ASSIGNMENT,
    ]) {
      expect(isAuthorized({ action, resourceUnitIds: ['qualquer-unidade'], user })).toBe(true);
      expect(isAuthorized({ action, resourceUnitIds: [], user })).toBe(true);
    }
  });

  it('autoriza Diretor quando qualquer unidade vinculada intersecta o conjunto administrativo', () => {
    const user = createUser('DIRETOR', ['unidade-a', 'unidade-b']);

    expect(
      isAuthorized({
        action: ACTION.EDIT_PROFESSIONAL,
        resourceUnitIds: ['unidade-b', 'unidade-c'],
        user,
      }),
    ).toBe(true);
    expect(
      isAuthorized({
        action: ACTION.EDIT_PROFESSIONAL,
        resourceUnitIds: ['unidade-c'],
        user,
      }),
    ).toBe(false);
    expect(
      isAuthorized({
        action: ACTION.USE_MANUAL_ASSIGNMENT,
        resourceUnitIds: ['unidade-b'],
        user,
      }),
    ).toBe(true);
    expect(
      isAuthorized({
        action: ACTION.USE_MANUAL_ASSIGNMENT,
        resourceUnitIds: ['unidade-c'],
        user,
      }),
    ).toBe(false);
  });

  it('nega ao ADMINISTRADOR a operação normal de evento', () => {
    const user = createUser('ADMINISTRADOR');

    expect(isAuthorized({ action: ACTION.MANAGE_EVENT, user })).toBe(false);
    expect(isAuthorized({ action: ACTION.OPERATE_EVENT, user })).toBe(false);
  });

  it('concede ao OPERADOR as permissões de evento', () => {
    const user = createUser('OPERADOR');

    expect(isAuthorized({ action: ACTION.MANAGE_EVENT, user })).toBe(true);
    expect(isAuthorized({ action: ACTION.OPERATE_EVENT, user })).toBe(true);
    expect(isAuthorized({ action: ACTION.READ_STAFFING, user })).toBe(true);
    expect(isAuthorized({ action: ACTION.READ_EVENTS, user })).toBe(true);
    expect(isAuthorized({ action: ACTION.MANAGE_STAFFING, user })).toBe(false);
  });

  it('nega ao OPERADOR cadastro comum, pontuação e manifestação prévia', () => {
    const user = createUser('OPERADOR');

    expect(isAuthorized({ action: ACTION.EDIT_UNIT, resourceUnitIds: ['a'], user })).toBe(false);
    expect(isAuthorized({ action: ACTION.EDIT_PROFESSIONAL, resourceUnitIds: ['a'], user })).toBe(
      false,
    );
    expect(isAuthorized({ action: ACTION.EDIT_PROFESSIONAL_SCORE, user })).toBe(false);
    expect(
      isAuthorized({
        action: ACTION.EDIT_PROFESSIONAL_PARTICIPATION,
        resourceUnitIds: ['a'],
        user,
      }),
    ).toBe(false);
  });

  it.each(['DIRETOR', 'SECRETARIO'] as const)('%s atua somente na própria unidade', (perfil) => {
    const user = createUser(perfil, ['unidade-a']);

    for (const action of [
      ACTION.EDIT_UNIT,
      ACTION.EDIT_PROFESSIONAL,
      ACTION.EDIT_PROFESSIONAL_PARTICIPATION,
    ]) {
      expect(isAuthorized({ action, resourceUnitIds: ['unidade-a'], user })).toBe(true);
      expect(isAuthorized({ action, resourceUnitIds: ['unidade-b'], user })).toBe(false);
    }
  });

  it.each(['DIRETOR', 'SECRETARIO'] as const)(
    '%s não altera pontuação nem opera evento',
    (perfil) => {
      const user = createUser(perfil, ['unidade-a']);

      expect(isAuthorized({ action: ACTION.EDIT_PROFESSIONAL_SCORE, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.MANAGE_EVENT, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.OPERATE_EVENT, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.READ_STAFFING, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.MANAGE_STAFFING, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.USE_MANUAL_ASSIGNMENT, user })).toBe(false);
    },
  );

  it('reserva auditoria, exclusão e gerenciamento de usuários ao ADMINISTRADOR', () => {
    for (const perfil of ['OPERADOR', 'DIRETOR', 'SECRETARIO'] as const) {
      const user = createUser(perfil, perfil === 'OPERADOR' ? [] : ['unidade-a']);
      expect(isAuthorized({ action: ACTION.READ_AUDIT, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.READ_EVENT_MINUTES, user })).toBe(perfil === 'OPERADOR');
      expect(isAuthorized({ action: ACTION.DELETE_RECORD, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.MANAGE_USERS, user })).toBe(false);
    }

    expect(isAuthorized({ action: ACTION.READ_AUDIT, user: createUser('ADMINISTRADOR') })).toBe(
      true,
    );
    expect(
      isAuthorized({ action: ACTION.READ_EVENT_MINUTES, user: createUser('ADMINISTRADOR') }),
    ).toBe(true);
    expect(isAuthorized({ action: ACTION.MANAGE_USERS, user: createUser('ADMINISTRADOR') })).toBe(
      true,
    );
  });

  it('nega por padrão e lança 403 no helper reutilizável', () => {
    const user = createUser('DIRETOR', ['unidade-a', 'unidade-b']);

    try {
      assertAuthorized({ action: ACTION.MANAGE_USERS, user });
      throw new Error('Expected authorization to be denied.');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Acesso não autorizado.',
        status: 403,
      });
    }
  });
});
