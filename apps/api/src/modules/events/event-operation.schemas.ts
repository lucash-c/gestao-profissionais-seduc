import { z } from 'zod';

const uuid = z.string().uuid();

export const eventVacancyQuerySchema = z
  .object({
    periodoId: uuid.optional(),
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

export type EventVacancyQuery = z.infer<typeof eventVacancyQuerySchema>;
export type EventChoiceInput = z.infer<typeof eventChoiceSchema>;
export type EventMovementQuery = z.infer<typeof eventMovementQuerySchema>;
