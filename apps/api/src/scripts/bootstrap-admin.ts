import bcrypt from 'bcryptjs';
import { createDatabaseConnection } from '@seduc/database';
import { z } from 'zod';

import { BCRYPT_COST, hashPassword } from '../modules/auth/auth.crypto.js';
import {
  bootstrapFirstAdministrator,
  type BootstrapAdminRepository,
} from '../modules/users/bootstrap-admin.service.js';

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
    const repository: BootstrapAdminRepository = {
      async createAdmin(admin) {
        await database.client.usuario.create({
          data: {
            email: admin.email,
            login: admin.login,
            nome: admin.nome,
            perfil: 'ADMINISTRADOR',
            senhaHash: admin.senhaHash,
          },
        });
      },
      async findByIdentifiers(identifiers) {
        return database.client.usuario.findMany({
          select: { email: true, id: true, login: true, perfil: true },
          where: {
            OR: [{ login: { in: [...identifiers] } }, { email: { in: [...identifiers] } }],
          },
        });
      },
    };
    const result = await bootstrapFirstAdministrator(
      repository,
      {
        email: input.BOOTSTRAP_ADMIN_EMAIL ?? null,
        login: input.BOOTSTRAP_ADMIN_LOGIN,
        nome: input.BOOTSTRAP_ADMIN_NAME,
        password: input.BOOTSTRAP_ADMIN_PASSWORD,
      },
      hashPassword,
    );

    console.info(
      result === 'created'
        ? `Administrador inicial criado com bcrypt custo ${BCRYPT_COST}.`
        : 'Administrador inicial já existe; nenhuma alteração foi realizada.',
    );
  } finally {
    await database.disconnect();
  }
}

main().catch(() => {
  console.error('Não foi possível criar o administrador inicial. Verifique a configuração segura.');
  process.exitCode = 1;
});
