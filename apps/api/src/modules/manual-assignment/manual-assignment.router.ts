import type { AuthenticatedUser } from '@seduc/contracts';
import { Router, type Request } from 'express';

import { HttpError } from '../../http/http-error.js';
import {
  manualAssignmentConfigurationSchema,
  manualAssignmentInputSchema,
  manualAssignmentPositionQuerySchema,
  manualAssignmentProfessionalQuerySchema,
} from './manual-assignment.schemas.js';
import type { ManualAssignmentServices } from './manual-assignment.service.js';

function currentUser(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  return request.authenticatedUser;
}

export function createManualAssignmentRouter(service: ManualAssignmentServices): Router {
  const router = Router();
  router.get('/configuracao', async (request, response) => {
    response.json(await service.configuration.get(currentUser(request)));
  });
  router.patch('/configuracao', async (request, response) => {
    const input = manualAssignmentConfigurationSchema.parse(request.body);
    response.json(await service.configuration.update(input.habilitada, currentUser(request)));
  });
  router.get('/profissionais', async (request, response) => {
    response.json(
      await service.listProfessionals(
        manualAssignmentProfessionalQuerySchema.parse(request.query),
        currentUser(request),
      ),
    );
  });
  router.get('/postos', async (request, response) => {
    response.json(
      await service.listPositions(
        manualAssignmentPositionQuerySchema.parse(request.query),
        currentUser(request),
      ),
    );
  });
  router.post('/simular', async (request, response) => {
    response.json(
      await service.simulate(manualAssignmentInputSchema.parse(request.body), currentUser(request)),
    );
  });
  router.post('/confirmar', async (request, response) => {
    response.json(
      await service.confirm(manualAssignmentInputSchema.parse(request.body), currentUser(request)),
    );
  });
  return router;
}
