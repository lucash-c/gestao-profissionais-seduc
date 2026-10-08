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

export type BootstrapAdminResult = 'created' | 'disabled' | 'unchanged';

export const INITIAL_SEDUC_ADMINISTRATOR = {
  email: null,
  login: 'seduc',
  nome: 'SEDUC',
  password: '12345678',
} as const;

export interface LockedInitialAdminRepository {
  countUsers(): Promise<number>;
  createAdmin(input: {
    email: null;
    login: string;
    nome: string;
    senhaHash: string;
  }): Promise<void>;
}

export interface InitialAdminRepository {
  runExclusive<T>(operation: (repository: LockedInitialAdminRepository) => Promise<T>): Promise<T>;
}

export function bootstrapInitialSeducAdministrator(
  repository: InitialAdminRepository,
  passwordHasher: (password: string) => Promise<string>,
  nodeEnvironment: 'development' | 'production' | 'test',
): Promise<BootstrapAdminResult> {
  if (nodeEnvironment === 'production') {
    return Promise.resolve('disabled');
  }

  return repository.runExclusive(async (lockedRepository) => {
    if ((await lockedRepository.countUsers()) > 0) {
      return 'unchanged';
    }

    await lockedRepository.createAdmin({
      email: INITIAL_SEDUC_ADMINISTRATOR.email,
      login: INITIAL_SEDUC_ADMINISTRATOR.login,
      nome: INITIAL_SEDUC_ADMINISTRATOR.nome,
      senhaHash: await passwordHasher(INITIAL_SEDUC_ADMINISTRATOR.password),
    });
    return 'created';
  });
}

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
