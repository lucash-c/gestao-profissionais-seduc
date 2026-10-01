import type { DatabaseConnection } from '@seduc/database';
import type { AuthenticatedUser, UserProfile } from '@seduc/contracts';

import type { AuthRepository, AuthUserRecord } from './auth.types.js';

function mapUser(user: {
  ativo: boolean;
  email: string | null;
  id: string;
  login: string;
  nome: string;
  perfil: string;
  senhaHash: string;
  unidade: { id: string; nome: string } | null;
}): AuthUserRecord {
  return {
    ativo: user.ativo,
    email: user.email,
    id: user.id,
    login: user.login,
    nome: user.nome,
    perfil: user.perfil as UserProfile,
    senhaHash: user.senhaHash,
    unidade: user.unidade satisfies AuthenticatedUser['unidade'],
  };
}

const userSelection = {
  ativo: true,
  email: true,
  id: true,
  login: true,
  nome: true,
  perfil: true,
  senhaHash: true,
  unidade: {
    select: {
      id: true,
      nome: true,
    },
  },
} as const;

export function createPrismaAuthRepository(database: DatabaseConnection): AuthRepository {
  return {
    async createSession({ expiraEm, tokenHash, usuarioId }) {
      await database.client.sessaoUsuario.create({
        data: {
          expiraEm,
          tokenHash,
          usuarioId,
        },
      });
    },

    async deleteSessionByTokenHash(tokenHash) {
      await database.client.sessaoUsuario.deleteMany({ where: { tokenHash } });
    },

    async findSessionByTokenHash(tokenHash) {
      const session = await database.client.sessaoUsuario.findUnique({
        include: {
          usuario: {
            select: userSelection,
          },
        },
        where: { tokenHash },
      });

      if (!session) {
        return null;
      }

      return {
        expiraEm: session.expiraEm,
        usuario: mapUser(session.usuario),
      };
    },

    async findUserByIdentifier(identifier) {
      const users = await database.client.usuario.findMany({
        select: userSelection,
        take: 2,
        where: {
          OR: [{ login: identifier }, { email: identifier }],
        },
      });

      return users.length === 1 && users[0] ? mapUser(users[0]) : null;
    },
  };
}
