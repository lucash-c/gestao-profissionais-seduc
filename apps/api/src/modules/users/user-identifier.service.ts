export interface UserIdentifierInput {
  email: string | null;
  login: string;
}

export interface UserIdentifierOwner extends UserIdentifierInput {
  id: string;
}

export interface UserIdentifierLookup<T extends UserIdentifierOwner = UserIdentifierOwner> {
  findByIdentifiers(identifiers: readonly string[]): Promise<T[]>;
}

export class UserIdentifierConflictError extends Error {
  constructor() {
    super('Login ou e-mail já pertence a outra conta; operação cancelada.');
    this.name = 'UserIdentifierConflictError';
  }
}

export function getLogicalUserIdentifiers(input: UserIdentifierInput): string[] {
  return [...new Set([input.login, ...(input.email ? [input.email] : [])])];
}

export async function findUserIdentifierOwners<T extends UserIdentifierOwner>(
  lookup: UserIdentifierLookup<T>,
  input: UserIdentifierInput,
): Promise<T[]> {
  return lookup.findByIdentifiers(getLogicalUserIdentifiers(input));
}

export async function assertUserIdentifiersAvailable(
  lookup: UserIdentifierLookup,
  input: UserIdentifierInput,
  allowedOwnerId?: string,
): Promise<void> {
  const owners = await findUserIdentifierOwners(lookup, input);
  if (owners.some(({ id }) => id !== allowedOwnerId)) {
    throw new UserIdentifierConflictError();
  }
}
