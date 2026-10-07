import { z } from 'zod';

export const auditQuerySchema = z
  .object({
    acao: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
    dataFim: z.coerce.date().optional(),
    dataInicio: z.coerce.date().optional(),
    entidade: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    profissionalId: z.string().uuid().optional(),
    registroId: z.string().trim().min(1).max(120).optional(),
    unidadeId: z.string().uuid().optional(),
    usuarioId: z.string().uuid().optional(),
  })
  .strict()
  .refine((value) => !value.dataInicio || !value.dataFim || value.dataInicio <= value.dataFim, {
    message: 'O período informado é inválido.',
  });

const unitCorrectionFields = z
  .object({
    ativo: z.boolean().optional(),
    codigoInep: z.union([z.string().trim().max(20), z.null()]).optional(),
    nome: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

const professionalCorrectionFields = z
  .object({
    ativo: z.boolean().optional(),
    cpf: z
      .string()
      .regex(/^\d{11}$/)
      .optional(),
    dataEntradaPrefeitura: z.iso.date().optional(),
    dataNascimento: z.iso.date().optional(),
    matricula: z.string().trim().min(1).max(50).optional(),
    nomeCompleto: z.string().trim().min(1).max(200).optional(),
    numeroFilhos: z.number().int().min(0).optional(),
    permuta: z.boolean().optional(),
    remocao: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

const unitCorrectionSchema = z
  .object({
    entidade: z.literal('UNIDADE'),
    registroId: z.string().uuid(),
    valores: unitCorrectionFields,
  })
  .strict();
const professionalCorrectionSchema = z
  .object({
    entidade: z.literal('PROFISSIONAL'),
    registroId: z.string().uuid(),
    valores: professionalCorrectionFields,
  })
  .strict();

export const correctionPreviewSchema = z.discriminatedUnion('entidade', [
  unitCorrectionSchema,
  professionalCorrectionSchema,
]);
export const correctionApplySchema = z.discriminatedUnion('entidade', [
  unitCorrectionSchema.extend({ versaoEsperada: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  professionalCorrectionSchema
    .extend({ versaoEsperada: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict(),
]);

export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type CorrectionInput = z.infer<typeof correctionPreviewSchema>;
export type CorrectionApplyInput = z.infer<typeof correctionApplySchema>;
