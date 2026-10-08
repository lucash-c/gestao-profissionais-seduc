import type { AuthenticatedUser } from '@seduc/contracts';
import { Router, type Request } from 'express';

import { HttpError } from '../../http/http-error.js';
import { databaseIdSchema } from '../../validation/database-id.js';
import { assertAuthorized, AUTHORIZATION_ACTIONS } from '../authorization/authorization.policy.js';
import { absenceCreateSchema, absenceEndSchema, absenceQuerySchema } from './assignment.schemas.js';
import type { AssignmentServices } from './assignment.service.js';

const idSchema = databaseIdSchema;

function currentUser(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  return request.authenticatedUser;
}

function routeId(request: Request, field = 'id'): string {
  return idSchema.parse(request.params[field]);
}

async function authorizeProfessional(
  request: Request,
  service: AssignmentServices,
  action: (typeof AUTHORIZATION_ACTIONS)[keyof typeof AUTHORIZATION_ACTIONS],
): Promise<{ profissionalId: string; user: AuthenticatedUser }> {
  const profissionalId = routeId(request);
  const user = currentUser(request);
  assertAuthorized({
    action,
    resourceUnitIds: await service.professionals.administrativeUnitIds(profissionalId),
    user,
  });
  return { profissionalId, user };
}

export function createAssignmentRouter(service: AssignmentServices): Router {
  const router = Router();

  router.get('/:id/vinculos', async (request, response) => {
    const { profissionalId } = await authorizeProfessional(
      request,
      service,
      AUTHORIZATION_ACTIONS.READ_REGISTRIES,
    );
    response.json(await service.professionals.relationships(profissionalId));
  });

  router.get('/:id/afastamentos', async (request, response) => {
    const { profissionalId } = await authorizeProfessional(
      request,
      service,
      AUTHORIZATION_ACTIONS.READ_REGISTRIES,
    );
    response.json(
      await service.absences.list(profissionalId, absenceQuerySchema.parse(request.query)),
    );
  });

  router.post('/:id/afastamentos', async (request, response) => {
    const { profissionalId, user } = await authorizeProfessional(
      request,
      service,
      AUTHORIZATION_ACTIONS.MANAGE_ABSENCES,
    );
    response
      .status(201)
      .json(
        await service.absences.create(
          profissionalId,
          absenceCreateSchema.parse(request.body),
          user,
        ),
      );
  });

  router.patch('/:id/afastamentos/:absenceId/encerrar', async (request, response) => {
    const { profissionalId, user } = await authorizeProfessional(
      request,
      service,
      AUTHORIZATION_ACTIONS.MANAGE_ABSENCES,
    );
    const input = absenceEndSchema.parse(request.body);
    response.json(
      await service.absences.end(
        profissionalId,
        routeId(request, 'absenceId'),
        input.dataFim,
        user,
      ),
    );
  });

  return router;
}
