import { z } from 'zod';

import { databaseIdSchema } from '../../validation/database-id.js';

export const auditQuerySchema = z
  .object({
    acao: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
    dataFim: z.coerce.date().optional(),
    dataInicio: z.coerce.date().optional(),
    entidade: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    profissionalId: databaseIdSchema.optional(),
    registroId: z.string().trim().min(1).max(120).optional(),
    unidadeId: databaseIdSchema.optional(),
    usuarioId: databaseIdSchema.optional(),
  })
  .strict()
  .refine((value) => !value.dataInicio || !value.dataFim || value.dataInicio <= value.dataFim, {
    message: 'O período informado é inválido.',
  });

export type AuditQuery = z.infer<typeof auditQuerySchema>;
