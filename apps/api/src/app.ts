import type { DatabaseConnection } from '@seduc/database';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';

import type { Environment } from './config/env.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { createHealthRouter } from './modules/health/health.router.js';

export interface AppDependencies {
  clock?: () => Date;
  database: DatabaseConnection;
  environment: Environment;
}

export function createApp({ clock, database, environment }: AppDependencies): Express {
  const app = express();
  const logger = pino({
    enabled: environment.LOG_LEVEL !== 'silent',
    level: environment.LOG_LEVEL === 'silent' ? 'info' : environment.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });

  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || environment.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origem não autorizada pelo CORS.'));
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_request, response) => {
    response.json({
      service: 'seduc-api',
      stage: 0,
      status: 'ok',
    });
  });
  app.use('/health', createHealthRouter({ database, ...(clock ? { clock } : {}) }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
