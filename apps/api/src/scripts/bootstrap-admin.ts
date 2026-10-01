import bcrypt from 'bcryptjs';
import { createDatabaseConnection } from '@seduc/database';
import { z } from 'zod';

import { BCRYPT_COST, hashPassword } from '../modules/auth/auth.crypto.js';

const optionalEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().email().max(254).optional(),
);

const bootstrapSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: optionalEmail,
  BOOTSTRAP_ADMIN_LOGIN: z.string().trim().min(3).max(100),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(3).max(200),
  BOOTSTRAP_ADMIN_PASSWORD: z
    .string()
    .min(12)
    .max(128)
    .refine((password) => !bcrypt.truncates(password), 'Senha deve possuir no máximo 72 bytes.'),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://')),
});

async function main(): Promise<void> {
  const input = bootstrapSchema.parse(process.env);
  const database = createDatabaseConnection(input.DATABASE_URL);

  try {
    const matches = await database.client.usuario.findMany({
      where: {
        OR: [
          { login: input.BOOTSTRAP_ADMIN_LOGIN },
          ...(input.BOOTSTRAP_ADMIN_EMAIL ? [{ email: input.BOOTSTRAP_ADMIN_EMAIL }] : []),
        ],
      },
    });

    if (matches.length > 0) {
      const existing = matches[0];
      const sameIdentity =
        matches.length === 1 &&
        existing?.login === input.BOOTSTRAP_ADMIN_LOGIN &&
        (!input.BOOTSTRAP_ADMIN_EMAIL || existing.email === input.BOOTSTRAP_ADMIN_EMAIL) &&
        existing.perfil === 'ADMINISTRADOR';

      if (sameIdentity) {
        console.info('Administrador inicial já existe; nenhuma alteração foi realizada.');
        return;
      }

      throw new Error('Login ou e-mail já pertence a outra conta; bootstrap cancelado.');
    }

    const senhaHash = await hashPassword(input.BOOTSTRAP_ADMIN_PASSWORD);
    await database.client.usuario.create({
      data: {
        email: input.BOOTSTRAP_ADMIN_EMAIL ?? null,
        login: input.BOOTSTRAP_ADMIN_LOGIN,
        nome: input.BOOTSTRAP_ADMIN_NAME,
        perfil: 'ADMINISTRADOR',
        senhaHash,
      },
    });

    console.info(`Administrador inicial criado com bcrypt custo ${BCRYPT_COST}.`);
  } finally {
    await database.disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida.';
  console.error(`Não foi possível criar o administrador inicial: ${message}`);
  process.exitCode = 1;
});
