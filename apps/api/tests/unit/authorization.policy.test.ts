import type { AuthenticatedUser, UserProfile } from '@seduc/contracts';
import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_ACTIONS as ACTION,
  assertAuthorized,
  isAuthorized,
} from '../../src/modules/authorization/authorization.policy.js';

function createUser(perfil: UserProfile, unidadeId: string | null = null): AuthenticatedUser {
  return {
    email: `${perfil.toLowerCase()}@seduc.test`,
    id: `usuario-${perfil}`,
    login: perfil.toLowerCase(),
    nome: perfil,
    perfil,
    unidade: unidadeId ? { id: unidadeId, nome: `Unidade ${unidadeId}` } : null,
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
      ACTION.ACCESS_ADMIN_CORRECTION,
      ACTION.MANAGE_USERS,
    ]) {
      expect(isAuthorized({ action, resourceUnitId: 'qualquer-unidade', user })).toBe(true);
    }
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
  });

  it('nega ao OPERADOR cadastro comum, pontuação e manifestação prévia', () => {
    const user = createUser('OPERADOR');

    expect(isAuthorized({ action: ACTION.EDIT_UNIT, resourceUnitId: 'a', user })).toBe(false);
    expect(isAuthorized({ action: ACTION.EDIT_PROFESSIONAL, resourceUnitId: 'a', user })).toBe(
      false,
    );
    expect(isAuthorized({ action: ACTION.EDIT_PROFESSIONAL_SCORE, user })).toBe(false);
    expect(
      isAuthorized({
        action: ACTION.EDIT_PROFESSIONAL_PARTICIPATION,
        resourceUnitId: 'a',
        user,
      }),
    ).toBe(false);
  });

  it.each(['DIRETOR', 'SECRETARIO'] as const)('%s atua somente na própria unidade', (perfil) => {
    const user = createUser(perfil, 'unidade-a');

    for (const action of [
      ACTION.EDIT_UNIT,
      ACTION.EDIT_PROFESSIONAL,
      ACTION.EDIT_PROFESSIONAL_PARTICIPATION,
    ]) {
      expect(isAuthorized({ action, resourceUnitId: 'unidade-a', user })).toBe(true);
      expect(isAuthorized({ action, resourceUnitId: 'unidade-b', user })).toBe(false);
    }
  });

  it.each(['DIRETOR', 'SECRETARIO'] as const)(
    '%s não altera pontuação nem opera evento',
    (perfil) => {
      const user = createUser(perfil, 'unidade-a');

      expect(isAuthorized({ action: ACTION.EDIT_PROFESSIONAL_SCORE, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.MANAGE_EVENT, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.OPERATE_EVENT, user })).toBe(false);
    },
  );

  it('reserva Correção Administrativa e gerenciamento de usuários ao ADMINISTRADOR', () => {
    for (const perfil of ['OPERADOR', 'DIRETOR', 'SECRETARIO'] as const) {
      const user = createUser(perfil, perfil === 'OPERADOR' ? null : 'unidade-a');
      expect(isAuthorized({ action: ACTION.ACCESS_ADMIN_CORRECTION, user })).toBe(false);
      expect(isAuthorized({ action: ACTION.MANAGE_USERS, user })).toBe(false);
    }

    expect(
      isAuthorized({ action: ACTION.ACCESS_ADMIN_CORRECTION, user: createUser('ADMINISTRADOR') }),
    ).toBe(true);
    expect(isAuthorized({ action: ACTION.MANAGE_USERS, user: createUser('ADMINISTRADOR') })).toBe(
      true,
    );
  });

  it('nega por padrão e lança 403 no helper reutilizável', () => {
    const user = createUser('DIRETOR', 'unidade-a');

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
