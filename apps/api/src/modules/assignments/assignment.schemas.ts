import { z } from 'zod';

const timestampSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const nullableText = z
  .union([z.string().trim().max(10_000), z.null()])
  .transform((value) => (value === '' ? null : value));

export const absenceCreateSchema = z
  .object({
    dataInicio: timestampSchema.optional(),
    observacoes: nullableText.default(null),
    tipo: z.string().trim().min(1).max(120),
  })
  .strict();

export const absenceEndSchema = z.object({ dataFim: timestampSchema.optional() }).strict();

export const absenceQuerySchema = z.object({
  ativo: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type AbsenceCreateInput = z.infer<typeof absenceCreateSchema>;
export type AbsenceEndInput = z.infer<typeof absenceEndSchema>;
export type AbsenceQuery = z.infer<typeof absenceQuerySchema>;
