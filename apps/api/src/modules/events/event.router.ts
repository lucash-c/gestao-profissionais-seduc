import type { AuthenticatedUser } from '@seduc/contracts';
import { Router, type Request } from 'express';
import { z } from 'zod';

import { HttpError } from '../../http/http-error.js';
import { assertAuthorized, AUTHORIZATION_ACTIONS } from '../authorization/authorization.policy.js';
import {
  eventCreateSchema,
  eventPreparationSchema,
  eventQuerySchema,
  eventUpdateSchema,
} from './event.schemas.js';
import type { EventServices } from './event.service.js';

const idSchema = z.string().uuid();

function operator(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  assertAuthorized({
    action: AUTHORIZATION_ACTIONS.MANAGE_EVENT,
    user: request.authenticatedUser,
  });
  return request.authenticatedUser;
}

function eventId(request: Request): string {
  return idSchema.parse(request.params.id);
}

export function createEventRouter(service: EventServices): Router {
  const router = Router();
  router.get('/', async (request, response) => {
    operator(request);
    response.json(await service.list(eventQuerySchema.parse(request.query)));
  });
  router.post('/', async (request, response) => {
    operator(request);
    response.status(201).json(await service.create(eventCreateSchema.parse(request.body)));
  });
  router.get('/:id', async (request, response) => {
    operator(request);
    response.json(await service.get(eventId(request)));
  });
  router.patch('/:id', async (request, response) => {
    operator(request);
    response.json(await service.update(eventId(request), eventUpdateSchema.parse(request.body)));
  });
  router.get('/:id/preparacao', async (request, response) => {
    operator(request);
    response.json(await service.preparation(eventId(request)));
  });
  router.put('/:id/preparacao', async (request, response) => {
    operator(request);
    const input = eventPreparationSchema.parse(request.body);
    response.json(await service.savePreparation(eventId(request), input.profissionalIds));
  });
  router.post('/:id/iniciar', async (request, response) => {
    const user = operator(request);
    response.json(await service.start(eventId(request), user.id));
  });
  return router;
}
