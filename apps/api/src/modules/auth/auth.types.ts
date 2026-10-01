import type { AuthenticatedUser } from '@seduc/contracts';

export interface AuthUserRecord extends AuthenticatedUser {
  ativo: boolean;
  senhaHash: string;
}

export interface AuthSessionRecord {
  expiraEm: Date;
  usuario: AuthUserRecord;
}

export interface AuthRepository {
  createSession(input: { expiraEm: Date; tokenHash: string; usuarioId: string }): Promise<void>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null>;
}
