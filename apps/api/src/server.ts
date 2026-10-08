import { createDatabaseConnection } from '@seduc/database';

import { createApp } from './app.js';
import { loadEnvironment } from './config/env.js';
import { hashPassword } from './modules/auth/auth.crypto.js';
import { bootstrapInitialSeducAdministrator } from './modules/users/bootstrap-admin.service.js';
import { createPrismaInitialAdminRepository } from './modules/users/initial-admin.repository.js';

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const database = createDatabaseConnection(environment.DATABASE_URL);

  try {
    const bootstrapResult = await bootstrapInitialSeducAdministrator(
      createPrismaInitialAdminRepository(database),
      hashPassword,
      environment.NODE_ENV,
    );
    if (bootstrapResult === 'created') {
      console.info('Administrador inicial SEDUC criado.');
    }

    const app = createApp({ database, environment });
    const server = app.listen(environment.API_PORT, '0.0.0.0', () => {
      console.info(`SEDUC API disponível na porta ${environment.API_PORT}.`);
    });

    async function shutdown(signal: string): Promise<void> {
      console.info(`Recebido ${signal}; encerrando a API com segurança.`);
      server.close(async (error) => {
        await database.disconnect();
        if (error) {
          console.error('Falha ao encerrar o servidor HTTP.');
          process.exitCode = 1;
        }
      });
    }

    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    await database.disconnect();
    throw error;
  }
}

void main().catch(() => {
  console.error('Não foi possível inicializar a API. Consulte os indicadores de infraestrutura.');
  process.exitCode = 1;
});
