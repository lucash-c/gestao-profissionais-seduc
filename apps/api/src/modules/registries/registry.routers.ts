import type { AuthenticatedUser } from '@seduc/contracts';
import { Router, type Request } from 'express';

import { HttpError } from '../../http/http-error.js';
import { databaseIdSchema } from '../../validation/database-id.js';
import { adminDeletionSchema } from '../authorization/admin-deletion.js';
import { assertAuthorized, AUTHORIZATION_ACTIONS } from '../authorization/authorization.policy.js';
import {
  passwordResetSchema,
  phoneInputSchema,
  professionalCreateSchema,
  professionalQuerySchema,
  professionalUpdateSchema,
  scoreUpdateSchema,
  unitCreateSchema,
  unitQuerySchema,
  unitUpdateSchema,
  userCreateSchema,
  userQuerySchema,
  userUpdateSchema,
} from './registry.schemas.js';
import type { RegistryServices } from './registry.service.js';

const idSchema = databaseIdSchema;

function currentUser(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  return request.authenticatedUser;
}

function routeId(request: Request, name = 'id'): string {
  return idSchema.parse(request.params[name]);
}

export function createUnitRouter(service: RegistryServices['units']): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.READ_REGISTRIES,
      resourceUnitIds: user.unidades.map((unit) => unit.id),
      user,
    });
    response.json(await service.list(unitQuerySchema.parse(request.query), user));
  });

  router.post('/', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.CREATE_UNIT, user });
    response.status(201).json(await service.create(unitCreateSchema.parse(request.body), user));
  });

  router.get('/:id', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.READ_REGISTRIES,
      resourceUnitIds: user.unidades.map((unit) => unit.id),
      user,
    });
    response.json(await service.get(routeId(request), user));
  });

  router.patch('/:id', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.EDIT_UNIT, resourceUnitIds: [id], user });
    response.json(await service.update(id, unitUpdateSchema.parse(request.body), user));
  });

  router.delete('/:id', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.DELETE_RECORD, user });
    const input = adminDeletionSchema.parse(request.body);
    await service.delete(routeId(request), input.senhaAtual, user);
    response.status(204).send();
  });

  router.post('/:id/telefones', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.EDIT_UNIT, resourceUnitIds: [id], user });
    response
      .status(201)
      .json(await service.addPhone(id, phoneInputSchema.parse(request.body), user));
  });

  router.patch('/:id/telefones/:phoneId', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.EDIT_UNIT, resourceUnitIds: [id], user });
    response.json(
      await service.updatePhone(
        id,
        routeId(request, 'phoneId'),
        phoneInputSchema.parse(request.body),
        user,
      ),
    );
  });

  router.delete('/:id/telefones/:phoneId', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.EDIT_UNIT, resourceUnitIds: [id], user });
    await service.deletePhone(id, routeId(request, 'phoneId'), user);
    response.status(204).send();
  });

  return router;
}

export function createProfessionalRouter(service: RegistryServices['professionals']): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.READ_REGISTRIES,
      resourceUnitIds: user.unidades.map((unit) => unit.id),
      user,
    });
    response.json(await service.list(professionalQuerySchema.parse(request.query), user));
  });

  router.post('/', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.CREATE_PROFESSIONAL, user });
    response
      .status(201)
      .json(await service.create(professionalCreateSchema.parse(request.body), user));
  });

  router.patch('/:id/pontuacao', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL_SCORE, user });
    const input = scoreUpdateSchema.parse(request.body);
    response.json(await service.updateScore(routeId(request), input.pontuacao, user));
  });

  router.get('/:id', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.READ_REGISTRIES,
      resourceUnitIds: user.unidades.map((unit) => unit.id),
      user,
    });
    response.json(await service.get(routeId(request), user));
  });

  router.patch('/:id', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL,
      resourceUnitIds: await service.administrativeUnitIds(id),
      user,
    });
    response.json(await service.update(id, professionalUpdateSchema.parse(request.body), user));
  });

  router.delete('/:id', async (request, response) => {
    const user = currentUser(request);
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.DELETE_RECORD, user });
    const input = adminDeletionSchema.parse(request.body);
    await service.delete(routeId(request), input.senhaAtual, user);
    response.status(204).send();
  });

  router.post('/:id/telefones', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL,
      resourceUnitIds: await service.administrativeUnitIds(id),
      user,
    });
    response
      .status(201)
      .json(await service.addPhone(id, phoneInputSchema.parse(request.body), user));
  });

  router.patch('/:id/telefones/:phoneId', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL,
      resourceUnitIds: await service.administrativeUnitIds(id),
      user,
    });
    response.json(
      await service.updatePhone(
        id,
        routeId(request, 'phoneId'),
        phoneInputSchema.parse(request.body),
        user,
      ),
    );
  });

  router.delete('/:id/telefones/:phoneId', async (request, response) => {
    const user = currentUser(request);
    const id = routeId(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.EDIT_PROFESSIONAL,
      resourceUnitIds: await service.administrativeUnitIds(id),
      user,
    });
    await service.deletePhone(id, routeId(request, 'phoneId'), user);
    response.status(204).send();
  });

  return router;
}

export function createUserRouter(service: RegistryServices['users']): Router {
  const router = Router();

  router.use((request, _response, next) => {
    assertAuthorized({ action: AUTHORIZATION_ACTIONS.MANAGE_USERS, user: currentUser(request) });
    next();
  });

  router.get('/', async (request, response) => {
    response.json(await service.list(userQuerySchema.parse(request.query)));
  });
  router.post('/', async (request, response) => {
    response
      .status(201)
      .json(await service.create(userCreateSchema.parse(request.body), currentUser(request)));
  });
  router.patch('/:id', async (request, response) => {
    response.json(
      await service.update(
        routeId(request),
        userUpdateSchema.parse(request.body),
        currentUser(request),
      ),
    );
  });
  router.patch('/:id/senha', async (request, response) => {
    const input = passwordResetSchema.parse(request.body);
    await service.resetPassword(routeId(request), input.senha, currentUser(request));
    response.status(204).send();
  });
  router.delete('/:id', async (request, response) => {
    const input = adminDeletionSchema.parse(request.body);
    await service.delete(routeId(request), input.senhaAtual, currentUser(request));
    response.status(204).send();
  });

  return router;
}

export function createLookupRouter(service: RegistryServices['lookups']): Router {
  const router = Router();
  router.use((request, _response, next) => {
    const user = currentUser(request);
    assertAuthorized({
      action: AUTHORIZATION_ACTIONS.READ_REGISTRIES,
      resourceUnitIds: user.unidades.map((unit) => unit.id),
      user,
    });
    next();
  });
  router.get('/tipos-unidade', async (_request, response) =>
    response.json(await service.tiposUnidade()),
  );
  router.get('/cargos', async (_request, response) => response.json(await service.cargos()));
  router.get('/periodos', async (_request, response) => response.json(await service.periodos()));
  router.get('/segmentos', async (_request, response) => response.json(await service.segmentos()));
  router.get('/unidades', async (request, response) =>
    response.json(await service.unidades(currentUser(request))),
  );
  return router;
}
