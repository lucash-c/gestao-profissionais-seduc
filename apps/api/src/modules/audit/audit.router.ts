import { Router, type Request } from 'express';

import { HttpError } from '../../http/http-error.js';
import { assertAuthorized, AUTHORIZATION_ACTIONS } from '../authorization/authorization.policy.js';
import { auditQuerySchema } from './audit.schemas.js';
import type { AuditServices } from './audit.service.js';

function admin(request: Request): void {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  assertAuthorized({
    action: AUTHORIZATION_ACTIONS.READ_AUDIT,
    user: request.authenticatedUser,
  });
}

export function createAuditRouter(service: AuditServices['history']): Router {
  const router = Router();
  router.use((request, _response, next) => {
    admin(request);
    next();
  });
  router.get('/', async (request, response) =>
    response.json(await service.list(auditQuerySchema.parse(request.query))),
  );
  return router;
}
