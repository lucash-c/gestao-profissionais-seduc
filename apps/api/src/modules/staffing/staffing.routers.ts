import type { AuthenticatedUser } from '@seduc/contracts';
import { Router, type Request } from 'express';

import { HttpError } from '../../http/http-error.js';
import { databaseIdSchema } from '../../validation/database-id.js';
import { adminDeletionSchema } from '../authorization/admin-deletion.js';
import { assertAuthorized, AUTHORIZATION_ACTIONS } from '../authorization/authorization.policy.js';
import {
  staffingPlanCreateSchema,
  staffingPlanQuerySchema,
  staffingPlanUpdateSchema,
  workPositionQuerySchema,
  workPositionStatusSchema,
} from './staffing.schemas.js';
import type { StaffingServices } from './staffing.service.js';

const idSchema = databaseIdSchema;

function currentUser(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  return request.authenticatedUser;
}

function routeId(request: Request): string {
  return idSchema.parse(request.params.id);
}

export function createStaffingPlanRouter(service: StaffingServices['staffingPlans']): Router {
  const router = Router();
  router.get('/', async (request, response) => {
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.READ_STAFFING, user: currentUser(request) });
    response.json(await service.list(staffingPlanQuerySchema.parse(request.query)));
  });
  router.post('/', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.MANAGE_STAFFING, user });
    response
      .status(201)
      .json(await service.create(staffingPlanCreateSchema.parse(request.body), user));
  });
  router.get('/:id', async (request, response) => {
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.READ_STAFFING, user: currentUser(request) });
    response.json(await service.get(routeId(request)));
  });
  router.patch('/:id', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.MANAGE_STAFFING, user });
    response.json(
      await service.update(routeId(request), staffingPlanUpdateSchema.parse(request.body), user),
    );
  });
  router.delete('/:id', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.DELETE_RECORD, user });
    const input = adminDeletionSchema.parse(request.body);
    await service.delete(routeId(request), input.senhaAtual, user);
    response.status(204).send();
  });
  return router;
}

export function createWorkPositionRouter(service: StaffingServices['workPositions']): Router {
  const router = Router();
  router.get('/', async (request, response) => {
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.READ_STAFFING, user: currentUser(request) });
    response.json(await service.list(workPositionQuerySchema.parse(request.query)));
  });
  router.get('/:id', async (request, response) => {
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.READ_STAFFING, user: currentUser(request) });
    response.json(await service.get(routeId(request)));
  });
  router.patch('/:id/status', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.MANAGE_STAFFING, user });
    const input = workPositionStatusSchema.parse(request.body);
    response.json(await service.updateStatus(routeId(request), input.ativo, user));
  });
  router.delete('/:id', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.DELETE_RECORD, user });
    const input = adminDeletionSchema.parse(request.body);
    await service.delete(routeId(request), input.senhaAtual, user);
    response.status(204).send();
  });
  return router;
}
