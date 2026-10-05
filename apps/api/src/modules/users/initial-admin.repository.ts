import type { DatabaseConnection } from '@seduc/database';

import type { InitialAdminRepository } from './bootstrap-admin.service.js';

export function createPrismaInitialAdminRepository(
  database: DatabaseConnection,
): InitialAdminRepository {
  return {
    runExclusive(operation) {
      return database.client.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT pg_advisory_xact_lock(2026100504::bigint)::text
        `;
        return operation({
          countUsers() {
            return transaction.usuario.count();
          },
          async createAdmin(admin) {
            await transaction.usuario.create({
              data: {
                ativo: true,
                email: admin.email,
                login: admin.login,
                nome: admin.nome,
                perfil: 'ADMINISTRADOR',
                senhaHash: admin.senhaHash,
              },
            });
          },
        });
      });
    },
  };
}
