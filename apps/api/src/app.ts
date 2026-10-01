import type { DatabaseConnection } from '@seduc/database';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';

import type { Environment } from './config/env.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { createPrismaAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { AuthService } from './modules/auth/auth.service.js';
import type { AuthRepository } from './modules/auth/auth.types.js';
import { createHealthRouter } from './modules/health/health.router.js';

export interface AppDependencies {
  authRepository?: AuthRepository;
  clock?: () => Date;
  database: DatabaseConnection;
  environment: Environment;
}

export function createApp({
  authRepository,
  clock,
  database,
  environment,
}: AppDependencies): Express {
  const app = express();
  const logger = pino({
    enabled: environment.LOG_LEVEL !== 'silent',
    level: environment.LOG_LEVEL === 'silent' ? 'info' : environment.LOG_LEVEL,
    redact: ['req.body.password', 'req.headers.authorization', 'req.headers.cookie'],
  });

  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      redact: ['req.body.password', 'req.headers.authorization', 'req.headers.cookie'],
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

  const authService = new AuthService({
    ...(clock ? { clock } : {}),
    repository: authRepository ?? createPrismaAuthRepository(database),
    sessionSecret: environment.SESSION_SECRET,
    sessionTtlHours: environment.SESSION_TTL_HOURS,
  });

  app.get('/', (_request, response) => {
    response.json({
      service: 'seduc-api',
      stage: 2,
      status: 'ok',
    });
  });
  app.use('/health', createHealthRouter({ database, ...(clock ? { clock } : {}) }));
  app.use('/auth', createAuthRouter({ authService, environment }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
