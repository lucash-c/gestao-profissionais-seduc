import type { DatabaseConnection } from '@seduc/database';
import { Router } from 'express';

export interface HealthRouterDependencies {
  clock?: () => Date;
  database: DatabaseConnection;
}

export function createHealthRouter({
  clock = () => new Date(),
  database,
}: HealthRouterDependencies): Router {
  const router = Router();

  router.get('/live', (_request, response) => {
    response.json({
      service: 'seduc-api',
      status: 'ok',
      timestamp: clock().toISOString(),
    });
  });

  router.get('/ready', async (request, response) => {
    try {
      await database.ping();
      response.json({
        checks: { database: 'up' },
        service: 'seduc-api',
        status: 'ready',
        timestamp: clock().toISOString(),
      });
    } catch (error) {
      request.log.warn({ error }, 'PostgreSQL indisponível no healthcheck de prontidão');
      response.status(503).json({
        checks: { database: 'down' },
        service: 'seduc-api',
        status: 'unavailable',
        timestamp: clock().toISOString(),
      });
    }
  });

  return router;
}
