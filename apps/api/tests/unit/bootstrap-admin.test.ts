import { describe, expect, it, vi } from 'vitest';

import {
  bootstrapFirstAdministrator,
  type BootstrapAdminInput,
  type BootstrapAdminRepository,
} from '../../src/modules/users/bootstrap-admin.service.js';
import type { UserIdentifierOwner } from '../../src/modules/users/user-identifier.service.js';

type AdminOwner = UserIdentifierOwner & { perfil: 'ADMINISTRADOR' | 'OPERADOR' };

function createRepository(owners: AdminOwner[]) {
  const createAdmin = vi.fn<BootstrapAdminRepository['createAdmin']>().mockResolvedValue(undefined);
  const repository: BootstrapAdminRepository = {
    createAdmin,
    async findByIdentifiers(identifiers) {
      return owners.filter(
        ({ email, login }) => identifiers.includes(login) || (email && identifiers.includes(email)),
      );
    },
  };

  return { createAdmin, repository };
}

const baseInput: BootstrapAdminInput = {
  email: 'novo.email@seduc.test',
  login: 'novo.login',
  nome: 'Nova Administradora',
  password: 'Senha administrativa 2026!',
};

describe('bootstrapFirstAdministrator', () => {
  it.each([
    {
      existing: { email: 'outro@seduc.test', login: baseInput.login },
      label: 'login já existente',
    },
    {
      existing: { email: baseInput.email, login: 'outro.login' },
      label: 'e-mail já existente',
    },
    {
      existing: { email: baseInput.login, login: 'outro.login' },
      label: 'novo login igual ao e-mail de outra conta',
    },
    {
      existing: { email: 'outro@seduc.test', login: baseInput.email! },
      label: 'novo e-mail igual ao login de outra conta',
    },
  ])('rejeita $label', async ({ existing }) => {
    const { createAdmin, repository } = createRepository([
      {
        ...existing,
        id: 'usuario-existente',
        perfil: 'OPERADOR',
      },
    ]);
    const passwordHasher = vi.fn().mockResolvedValue('hash');

    await expect(
      bootstrapFirstAdministrator(repository, baseInput, passwordHasher),
    ).rejects.toMatchObject({ name: 'UserIdentifierConflictError' });
    expect(passwordHasher).not.toHaveBeenCalled();
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it('mantém a mesma identidade administrativa de forma idempotente', async () => {
    const { createAdmin, repository } = createRepository([
      {
        email: baseInput.email,
        id: 'administrador-existente',
        login: baseInput.login,
        perfil: 'ADMINISTRADOR',
      },
    ]);
    const passwordHasher = vi.fn().mockResolvedValue('hash');

    await expect(bootstrapFirstAdministrator(repository, baseInput, passwordHasher)).resolves.toBe(
      'unchanged',
    );
    expect(passwordHasher).not.toHaveBeenCalled();
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it('cria o primeiro administrador com a senha transformada em hash', async () => {
    const { createAdmin, repository } = createRepository([]);
    const passwordHasher = vi.fn().mockResolvedValue('hash-bcrypt');

    await expect(bootstrapFirstAdministrator(repository, baseInput, passwordHasher)).resolves.toBe(
      'created',
    );
    expect(createAdmin).toHaveBeenCalledWith({
      email: baseInput.email,
      login: baseInput.login,
      nome: baseInput.nome,
      senhaHash: 'hash-bcrypt',
    });
  });
});
