import { z } from 'zod';

const eventFields = {
  ano: z.number().int().min(1).max(9999),
  cargoFuncaoId: z.string().uuid(),
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(['REMOCAO', 'PERMUTA', 'LISTAO']),
};

export const eventCreateSchema = z.object(eventFields).strict();

export const eventUpdateSchema = z
  .object({
    ano: eventFields.ano.optional(),
    cargoFuncaoId: eventFields.cargoFuncaoId.optional(),
    nome: eventFields.nome.optional(),
    tipo: eventFields.tipo.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const eventQuerySchema = z.object({
  ano: z.coerce.number().int().min(1).max(9999).optional(),
  cargoFuncaoId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['RASCUNHO', 'ATIVO', 'ENCERRADO', 'CANCELADO']).optional(),
  tipo: eventFields.tipo.optional(),
});

export const eventPreparationSchema = z
  .object({ profissionalIds: z.array(z.string().uuid()).max(10_000) })
  .strict();

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
