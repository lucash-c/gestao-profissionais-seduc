import { z } from 'zod';

import { databaseIdSchema } from '../../validation/database-id.js';

export const manualAssignmentConfigurationSchema = z.object({ habilitada: z.boolean() }).strict();

export const manualAssignmentProfessionalQuerySchema = z
  .object({
    busca: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const manualAssignmentPositionQuerySchema = z
  .object({
    profissionalId: databaseIdSchema,
    tipoDestino: z.enum(['COM_SEDE', 'SEM_SEDE']).optional(),
  })
  .strict();

export const manualAssignmentInputSchema = z
  .object({
    postoTrabalhoId: databaseIdSchema,
    profissionalId: databaseIdSchema,
    tipoDestino: z.enum(['COM_SEDE', 'SEM_SEDE']),
  })
  .strict();

const manualAdministrativeInputSchema = z
  .object({
    profissionalId: databaseIdSchema,
  })
  .strict();

export const manualSeatRemovalInputSchema = manualAdministrativeInputSchema
  .extend({
    lotacaoSedeId: databaseIdSchema,
  })
  .strict();

export const manualExerciseEndInputSchema = manualAdministrativeInputSchema
  .extend({
    exercicioId: databaseIdSchema,
  })
  .strict();

export type ManualAssignmentInput = z.infer<typeof manualAssignmentInputSchema>;
export type ManualExerciseEndInput = z.infer<typeof manualExerciseEndInputSchema>;
export type ManualAssignmentProfessionalQuery = z.infer<
  typeof manualAssignmentProfessionalQuerySchema
>;
export type ManualAssignmentPositionQuery = z.infer<typeof manualAssignmentPositionQuerySchema>;
export type ManualSeatRemovalInput = z.infer<typeof manualSeatRemovalInputSchema>;
