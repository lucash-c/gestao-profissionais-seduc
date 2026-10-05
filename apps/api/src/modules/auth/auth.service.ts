import type { AuthenticatedUser } from '@seduc/contracts';

import { HttpError } from '../../http/http-error.js';
import {
  createSignedSessionToken,
  verifyPassword,
  verifySignedSessionToken,
} from './auth.crypto.js';
import type { AuthRepository, AuthUserRecord } from './auth.types.js';

const DUMMY_PASSWORD_HASH = '$2b$12$GNNkaQAG2Q0rJWSZA7DqHuTX6sUgX/QqIdIj0voJ6gvxosDZ2BsFC';

function toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
  return {
    email: user.email,
    id: user.id,
    login: user.login,
    nome: user.nome,
    perfil: user.perfil,
    unidades: user.unidades,
  };
}

export interface AuthServiceOptions {
  clock?: () => Date;
  repository: AuthRepository;
  sessionSecret: string;
  sessionTtlHours: number;
}

export class AuthService {
  private readonly clock: () => Date;
  private readonly repository: AuthRepository;
  private readonly sessionSecret: string;
  private readonly sessionTtlMilliseconds: number;

  constructor({
    clock = () => new Date(),
    repository,
    sessionSecret,
    sessionTtlHours,
  }: AuthServiceOptions) {
    this.clock = clock;
    this.repository = repository;
    this.sessionSecret = sessionSecret;
    this.sessionTtlMilliseconds = sessionTtlHours * 60 * 60 * 1000;
  }

  async login(
    identifier: string,
    password: string,
  ): Promise<{
    cookieValue: string;
    expiresAt: Date;
    user: AuthenticatedUser;
  }> {
    const user = await this.repository.findUserByIdentifier(identifier);
    const validPassword = await verifyPassword(password, user?.senhaHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !user.ativo || !validPassword) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.');
    }

    const { cookieValue, tokenHash } = createSignedSessionToken(this.sessionSecret);
    const expiresAt = new Date(this.clock().getTime() + this.sessionTtlMilliseconds);
    await this.repository.createSession({
      expiraEm: expiresAt,
      tokenHash,
      usuarioId: user.id,
    });

    return {
      cookieValue,
      expiresAt,
      user: toAuthenticatedUser(user),
    };
  }

  async getCurrentUser(cookieValue: string | null): Promise<AuthenticatedUser | null> {
    if (!cookieValue) {
      return null;
    }

    const tokenHash = verifySignedSessionToken(cookieValue, this.sessionSecret);
    if (!tokenHash) {
      return null;
    }

    const session = await this.repository.findSessionByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    if (session.expiraEm.getTime() <= this.clock().getTime() || !session.usuario.ativo) {
      await this.repository.deleteSessionByTokenHash(tokenHash);
      return null;
    }

    return toAuthenticatedUser(session.usuario);
  }

  async logout(cookieValue: string | null): Promise<void> {
    if (!cookieValue) {
      return;
    }

    const tokenHash = verifySignedSessionToken(cookieValue, this.sessionSecret);
    if (tokenHash) {
      await this.repository.deleteSessionByTokenHash(tokenHash);
    }
  }
}
