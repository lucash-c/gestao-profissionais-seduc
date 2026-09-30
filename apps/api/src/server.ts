import { createDatabaseConnection } from '@seduc/database';

import { createApp } from './app.js';
import { loadEnvironment } from './config/env.js';

const environment = loadEnvironment();
const database = createDatabaseConnection(environment.DATABASE_URL);
const app = createApp({ database, environment });

const server = app.listen(environment.API_PORT, '0.0.0.0', () => {
  console.info(`SEDUC API disponível na porta ${environment.API_PORT}.`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`Recebido ${signal}; encerrando a API com segurança.`);
  server.close(async (error) => {
    await database.disconnect();
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
