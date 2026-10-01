import type { UserProfile } from '@seduc/contracts';

import type {
  UserIdentifierInput,
  UserIdentifierLookup,
  UserIdentifierOwner,
} from './user-identifier.service.js';
import {
  findUserIdentifierOwners,
  UserIdentifierConflictError,
} from './user-identifier.service.js';

export interface BootstrapAdminInput extends UserIdentifierInput {
  nome: string;
  password: string;
}

interface BootstrapAdminOwner extends UserIdentifierOwner {
  perfil: UserProfile;
}

export interface BootstrapAdminRepository extends UserIdentifierLookup<BootstrapAdminOwner> {
  createAdmin(input: {
    email: string | null;
    login: string;
    nome: string;
    senhaHash: string;
  }): Promise<void>;
}

export type BootstrapAdminResult = 'created' | 'unchanged';

export async function bootstrapFirstAdministrator(
  repository: BootstrapAdminRepository,
  input: BootstrapAdminInput,
  passwordHasher: (password: string) => Promise<string>,
): Promise<BootstrapAdminResult> {
  const owners = await findUserIdentifierOwners(repository, input);

  if (owners.length > 0) {
    const existing = owners[0];
    const sameIdentity =
      owners.length === 1 &&
      existing?.login === input.login &&
      (input.email === null || existing.email === input.email) &&
      existing.perfil === 'ADMINISTRADOR';

    if (sameIdentity) {
      return 'unchanged';
    }

    throw new UserIdentifierConflictError();
  }

  await repository.createAdmin({
    email: input.email,
    login: input.login,
    nome: input.nome,
    senhaHash: await passwordHasher(input.password),
  });

  return 'created';
}
