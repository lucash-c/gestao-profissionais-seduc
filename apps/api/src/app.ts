import type { DatabaseConnection } from '@seduc/database';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';

import type { Environment } from './config/env.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { HttpError } from './http/http-error.js';
import { createRequireAllowedOrigin } from './http/origin-protection.js';
import { createAssignmentRouter } from './modules/assignments/assignment.router.js';
import {
  createPrismaAssignmentServices,
  type AssignmentServices,
} from './modules/assignments/assignment.service.js';
import { createRequireAuthentication } from './modules/auth/auth.middleware.js';
import { createPrismaAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { AuthService } from './modules/auth/auth.service.js';
import type { AuthRepository } from './modules/auth/auth.types.js';
import { createHealthRouter } from './modules/health/health.router.js';
import {
  createLookupRouter,
  createProfessionalRouter,
  createUnitRouter,
  createUserRouter,
} from './modules/registries/registry.routers.js';
import {
  createPrismaRegistryServices,
  type RegistryServices,
} from './modules/registries/registry.service.js';
import {
  createStaffingPlanRouter,
  createWorkPositionRouter,
} from './modules/staffing/staffing.routers.js';
import {
  createPrismaStaffingServices,
  type StaffingServices,
} from './modules/staffing/staffing.service.js';

export interface AppDependencies {
  assignmentServices?: AssignmentServices;
  authRepository?: AuthRepository;
  clock?: () => Date;
  database: DatabaseConnection;
  environment: Environment;
  registryServices?: RegistryServices;
  staffingServices?: StaffingServices;
}

export function createApp({
  assignmentServices,
  authRepository,
  clock,
  database,
  environment,
  registryServices,
  staffingServices,
}: AppDependencies): Express {
  const app = express();
  const logger = pino({
    enabled: environment.LOG_LEVEL !== 'silent',
    level: environment.LOG_LEVEL === 'silent' ? 'info' : environment.LOG_LEVEL,
    redact: ['req.body', 'req.headers.authorization', 'req.headers.cookie'],
  });

  app.disable('x-powered-by');
  app.set('trust proxy', environment.TRUST_PROXY_HOPS);
  app.use(
    pinoHttp({
      logger,
      redact: ['req.body', 'req.headers.authorization', 'req.headers.cookie'],
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
        callback(new HttpError(403, 'INVALID_ORIGIN', 'Origem da solicitação não autorizada.'));
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
  const services = registryServices ?? createPrismaRegistryServices(database);
  const staffing = staffingServices ?? createPrismaStaffingServices(database);
  const assignments = assignmentServices ?? createPrismaAssignmentServices(database, clock);
  const requireAuthentication = createRequireAuthentication(authService);
  const requireAllowedOrigin = createRequireAllowedOrigin(environment);

  app.get('/', (_request, response) => {
    response.json({
      service: 'seduc-api',
      stage: 5,
      status: 'ok',
    });
  });
  app.use('/health', createHealthRouter({ database, ...(clock ? { clock } : {}) }));
  app.use('/auth', createAuthRouter({ authService, environment }));
  app.use(
    '/dominios',
    requireAuthentication,
    requireAllowedOrigin,
    createLookupRouter(services.lookups),
  );
  app.use(
    '/unidades',
    requireAuthentication,
    requireAllowedOrigin,
    createUnitRouter(services.units),
  );
  app.use(
    '/profissionais',
    requireAuthentication,
    requireAllowedOrigin,
    createAssignmentRouter(assignments),
  );
  app.use(
    '/profissionais',
    requireAuthentication,
    requireAllowedOrigin,
    createProfessionalRouter(services.professionals),
  );
  app.use(
    '/usuarios',
    requireAuthentication,
    requireAllowedOrigin,
    createUserRouter(services.users),
  );
  app.use(
    '/quadros',
    requireAuthentication,
    requireAllowedOrigin,
    createStaffingPlanRouter(staffing.staffingPlans),
  );
  app.use(
    '/postos',
    requireAuthentication,
    requireAllowedOrigin,
    createWorkPositionRouter(staffing.workPositions),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
