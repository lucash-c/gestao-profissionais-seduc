import { isPeriodCode } from '@seduc/contracts';
import { z } from 'zod';

import { databaseIdSchema } from '../../validation/database-id.js';

const uuid = databaseIdSchema;
const periodCode = z
  .string()
  .refine(isPeriodCode, { message: 'Selecione um período reconhecido.' });

export const eventVacancyQuerySchema = z
  .object({
    periodoId: periodCode.optional(),
    tipo: z.enum(['SEDE', 'SEM_SEDE']).optional(),
    unidadeId: uuid.optional(),
  })
  .strict();

export const eventChoiceSimulationQuerySchema = z.object({ postoTrabalhoId: uuid }).strict();

export const eventChoiceSchema = z
  .object({
    participanteEsperadoId: uuid,
    postoTrabalhoId: uuid,
  })
  .strict();

export const eventMovementQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const eventExchangeSimulationQuerySchema = z
  .object({ segundoParticipanteId: uuid })
  .strict();

export const eventExchangeConfirmationSchema = z
  .object({
    participanteEsperadoId: uuid,
    postoOrigemAtualEsperadoId: uuid,
    postoOrigemSegundoEsperadoId: uuid,
    segundoParticipanteId: uuid,
  })
  .strict();

export type EventVacancyQuery = z.infer<typeof eventVacancyQuerySchema>;
export type EventChoiceInput = z.infer<typeof eventChoiceSchema>;
export type EventMovementQuery = z.infer<typeof eventMovementQuerySchema>;
export type EventExchangeSimulationQuery = z.infer<typeof eventExchangeSimulationQuerySchema>;
export type EventExchangeConfirmationInput = z.infer<typeof eventExchangeConfirmationSchema>;
