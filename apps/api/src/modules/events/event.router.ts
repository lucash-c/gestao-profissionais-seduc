import type { AuthenticatedUser } from '@seduc/contracts';
import { Router, type Request } from 'express';

import { HttpError } from '../../http/http-error.js';
import { databaseIdSchema } from '../../validation/database-id.js';
import { adminDeletionSchema } from '../authorization/admin-deletion.js';
import {
  assertAuthorized,
  AUTHORIZATION_ACTIONS,
  type AuthorizationAction,
} from '../authorization/authorization.policy.js';
import {
  eventChoiceSchema,
  eventChoiceSimulationQuerySchema,
  eventExchangeConfirmationSchema,
  eventExchangeSimulationQuerySchema,
  eventMovementQuerySchema,
  eventVacancyQuerySchema,
} from './event-operation.schemas.js';
import type { EventOperationServices } from './event-operation.service.js';
import type { EventExchangeServices } from './event-exchange.service.js';
import {
  eventCreateSchema,
  eventPreparationSchema,
  eventQuerySchema,
  eventUpdateSchema,
} from './event.schemas.js';
import type { EventServices } from './event.service.js';

const idSchema = databaseIdSchema;

function operator(
  request: Request,
  action: AuthorizationAction = AUTHORIZATION_ACTIONS.MANAGE_EVENT,
): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  assertAuthorized({
    action,
    user: request.authenticatedUser,
  });
  return request.authenticatedUser;
}

function eventId(request: Request): string {
  return idSchema.parse(request.params.id);
}

function eventReader(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  assertAuthorized({ action: AUTHORIZATION_ACTIONS.READ_EVENTS, user: request.authenticatedUser });
  return request.authenticatedUser;
}

function administrator(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }
  assertAuthorized({
    action: AUTHORIZATION_ACTIONS.DELETE_RECORD,
    user: request.authenticatedUser,
  });
  return request.authenticatedUser;
}

export function createEventRouter(
  service: EventServices,
  operations?: EventOperationServices,
  exchanges?: EventExchangeServices,
): Router {
  const router = Router();
  router.get('/', async (request, response) => {
    eventReader(request);
    response.json(await service.list(eventQuerySchema.parse(request.query)));
  });
  router.post('/', async (request, response) => {
    const user = operator(request);
    response.status(201).json(await service.create(eventCreateSchema.parse(request.body), user));
  });
  router.get('/:id', async (request, response) => {
    eventReader(request);
    response.json(await service.get(eventId(request)));
  });
  router.patch('/:id', async (request, response) => {
    const user = operator(request);
    response.json(
      await service.update(eventId(request), eventUpdateSchema.parse(request.body), user),
    );
  });
  router.delete('/:id', async (request, response) => {
    const user = administrator(request);
    const input = adminDeletionSchema.parse(request.body);
    await service.delete(eventId(request), input.senhaAtual, user);
    response.status(204).send();
  });
  router.get('/:id/preparacao', async (request, response) => {
    operator(request);
    response.json(await service.preparation(eventId(request)));
  });
  router.put('/:id/preparacao', async (request, response) => {
    const user = operator(request);
    const input = eventPreparationSchema.parse(request.body);
    response.json(await service.savePreparation(eventId(request), input.profissionalIds, user));
  });
  router.post('/:id/iniciar', async (request, response) => {
    const user = operator(request);
    response.json(await service.start(eventId(request), user.id));
  });
  if (operations) {
    router.get('/:id/central', async (request, response) => {
      operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      response.json(await operations.central(eventId(request)));
    });
    router.get('/:id/vagas', async (request, response) => {
      operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      response.json(
        await operations.vacancies(eventId(request), eventVacancyQuerySchema.parse(request.query)),
      );
    });
    router.get('/:id/simular-escolha', async (request, response) => {
      operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      const input = eventChoiceSimulationQuerySchema.parse(request.query);
      response.json(await operations.simulate(eventId(request), input.postoTrabalhoId));
    });
    router.post('/:id/escolha', async (request, response) => {
      const user = operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      response.json(
        await operations.choose(eventId(request), user.id, eventChoiceSchema.parse(request.body)),
      );
    });
    router.get('/:id/movimentacoes', async (request, response) => {
      operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      response.json(
        await operations.movements(eventId(request), eventMovementQuerySchema.parse(request.query)),
      );
    });
    router.post('/:id/encerrar', async (request, response) => {
      const user = operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      response.json(await operations.close(eventId(request), user.id));
    });
  }
  if (exchanges) {
    router.get('/:id/permuta', async (request, response) => {
      operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      response.json(await exchanges.central(eventId(request)));
    });
    router.get('/:id/simular-permuta', async (request, response) => {
      operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      const input = eventExchangeSimulationQuerySchema.parse(request.query);
      response.json(await exchanges.simulate(eventId(request), input.segundoParticipanteId));
    });
    router.post('/:id/confirmar-permuta', async (request, response) => {
      const user = operator(request, AUTHORIZATION_ACTIONS.OPERATE_EVENT);
      response.json(
        await exchanges.confirm(
          eventId(request),
          user.id,
          eventExchangeConfirmationSchema.parse(request.body),
        ),
      );
    });
  }
  return router;
}

export function createPublicEventRouter(operations: EventOperationServices): Router {
  const router = Router();
  router.get('/:id/telao', async (request, response) => {
    response.json(await operations.publicDisplay(eventId(request)));
  });
  router.get('/:id/escolhas', async (request, response) => {
    response.json(
      await operations.publicChoices(
        eventId(request),
        eventMovementQuerySchema.parse(request.query),
      ),
    );
  });
  return router;
}
