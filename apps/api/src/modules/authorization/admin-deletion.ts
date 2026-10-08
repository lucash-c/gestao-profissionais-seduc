import type { AuthenticatedUser } from '@seduc/contracts';
import { Prisma } from '@seduc/database';
import { z } from 'zod';

import { HttpError } from '../../http/http-error.js';
import { verifyPassword } from '../auth/auth.crypto.js';

export const adminDeletionSchema = z
  .object({
    senhaAtual: z
      .string()
      .min(1, 'Informe sua senha atual.')
      .max(72)
      .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
        message: 'Senha excede o tamanho permitido.',
      }),
  })
  .strict();

export async function assertAdministratorPassword(
  transaction: Prisma.TransactionClient,
  actor: AuthenticatedUser,
  password: string,
): Promise<void> {
  if (actor.perfil !== 'ADMINISTRADOR') {
    throw new HttpError(403, 'FORBIDDEN', 'Acesso não autorizado.');
  }
  const current = await transaction.usuario.findUnique({
    select: { ativo: true, perfil: true, senhaHash: true },
    where: { id: actor.id },
  });
  if (
    !current ||
    !current.ativo ||
    current.perfil !== 'ADMINISTRADOR' ||
    !(await verifyPassword(password, current.senhaHash))
  ) {
    throw new HttpError(403, 'INVALID_CURRENT_PASSWORD', 'A senha atual está incorreta.');
  }
}
