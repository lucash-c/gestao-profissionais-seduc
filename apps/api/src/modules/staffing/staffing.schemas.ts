import { z } from 'zod';

const activeQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const nullableText = z
  .union([z.string().trim().max(10_000), z.null()])
  .transform((value) => (value === '' ? null : value));

const scopeFields = {
  anoLetivo: z.number().int().positive(),
  cargoFuncaoId: z.string().uuid(),
  periodoId: z.string().uuid(),
  segmentoEnsinoId: z.union([z.string().uuid(), z.null()]),
  unidadeId: z.string().uuid(),
};

export const staffingPlanQuerySchema = paginationSchema.extend({
  anoLetivo: z.coerce.number().int().positive().optional(),
  cargoFuncaoId: z.string().uuid().optional(),
  periodoId: z.string().uuid().optional(),
  segmentoEnsinoId: z.string().uuid().optional(),
  unidadeId: z.string().uuid().optional(),
});

export const staffingPlanCreateSchema = z
  .object({
    ...scopeFields,
    observacoes: nullableText.default(null),
    quantidade: z.number().int().positive(),
  })
  .strict();

export const staffingPlanUpdateSchema = z
  .object({
    anoLetivo: scopeFields.anoLetivo.optional(),
    cargoFuncaoId: scopeFields.cargoFuncaoId.optional(),
    observacoes: nullableText.optional(),
    periodoId: scopeFields.periodoId.optional(),
    quantidade: z.number().int().positive().optional(),
    segmentoEnsinoId: scopeFields.segmentoEnsinoId.optional(),
    unidadeId: scopeFields.unidadeId.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const workPositionQuerySchema = paginationSchema.extend({
  anoLetivo: z.coerce.number().int().positive().optional(),
  ativo: activeQuery,
  cargoFuncaoId: z.string().uuid().optional(),
  periodoId: z.string().uuid().optional(),
  unidadeId: z.string().uuid().optional(),
});

export const workPositionStatusSchema = z.object({ ativo: z.boolean() }).strict();

export type StaffingPlanQuery = z.infer<typeof staffingPlanQuerySchema>;
export type StaffingPlanCreateInput = z.infer<typeof staffingPlanCreateSchema>;
export type StaffingPlanUpdateInput = z.infer<typeof staffingPlanUpdateSchema>;
export type WorkPositionQuery = z.infer<typeof workPositionQuerySchema>;
export type WorkPositionStatusInput = z.infer<typeof workPositionStatusSchema>;
