import { USER_PROFILES } from '@seduc/contracts';
import { z } from 'zod';

import { databaseIdSchema } from '../../validation/database-id.js';

const nullableText = (maximum: number) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .transform((value) => (value === '' ? null : value));

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use uma data no formato AAAA-MM-DD.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Informe uma data civil válida.');
const identifier = z.string().trim().min(1).max(254);
const password = z
  .string()
  .min(12, 'A senha deve possuir ao menos 12 caracteres.')
  .max(72, 'A senha deve possuir no máximo 72 caracteres.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'A senha excede o limite seguro de 72 bytes.',
  });

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

const nullableCep = z
  .union([z.string(), z.null()])
  .transform((value) => (value ? normalizeDigits(value) : null))
  .refine((value) => value === null || value.length === 8, 'CEP deve possuir 8 dígitos.');

const cpf = z
  .string()
  .regex(/^[\d.\-\s]+$/, 'CPF deve conter apenas dígitos e sinais de máscara.')
  .transform(normalizeDigits)
  .refine((value) => value.length === 11, 'CPF deve possuir 11 dígitos.');

export const phoneInputSchema = z
  .object({
    numero: z
      .string()
      .transform(normalizeDigits)
      .refine((value) => value.length >= 8 && value.length <= 15, 'Telefone inválido.'),
    tipo: z.string().trim().min(1).max(40),
  })
  .strict();

export const phoneCollectionInputSchema = phoneInputSchema.extend({
  id: databaseIdSchema.optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const activeQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const unitQuerySchema = paginationSchema.extend({
  ativo: activeQuery,
  nome: z.string().trim().max(200).optional(),
  tipoUnidadeId: databaseIdSchema.optional(),
});

export const unitCreateSchema = z
  .object({
    ativo: z.boolean().default(true),
    bairro: nullableText(120).default(null),
    cep: nullableCep.default(null),
    cidade: nullableText(120).default(null),
    codigoInep: nullableText(20).default(null),
    complemento: nullableText(120).default(null),
    endereco: nullableText(200).default(null),
    nome: z.string().trim().min(1).max(200),
    numero: nullableText(20).default(null),
    observacoes: nullableText(10_000).default(null),
    poloRegiao: nullableText(120).default(null),
    telefones: z.array(phoneInputSchema).max(20).default([]),
    tipoUnidadeId: databaseIdSchema,
  })
  .strict();

export const unitUpdateSchema = unitCreateSchema
  .omit({ telefones: true })
  .partial()
  .extend({ telefones: z.array(phoneCollectionInputSchema).max(20).optional() })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const professionalQuerySchema = paginationSchema.extend({
  ativo: activeQuery,
  cargoFuncaoId: databaseIdSchema.optional(),
  matricula: z.string().trim().max(50).optional(),
  nome: z.string().trim().max(200).optional(),
  permuta: activeQuery,
  remocao: activeQuery,
  unidadeId: databaseIdSchema.optional(),
  usaPontuacao: activeQuery,
});

const professionalFields = {
  ativo: z.boolean().default(true),
  bairro: nullableText(120).default(null),
  cargoFuncaoId: databaseIdSchema,
  cep: nullableCep.default(null),
  cidade: nullableText(120).default(null),
  complemento: nullableText(120).default(null),
  cpf,
  dataDesligamento: z.union([dateString, z.null()]).default(null),
  dataEntradaPrefeitura: dateString,
  dataNascimento: dateString,
  email: z.union([z.string().trim().email().max(254), z.null()]).default(null),
  endereco: nullableText(200).default(null),
  matricula: z.string().trim().min(1).max(50),
  nomeCompleto: z.string().trim().min(1).max(200),
  numero: nullableText(20).default(null),
  numeroFilhos: z.number().int().min(0).default(0),
  observacoes: nullableText(10_000).default(null),
  permuta: z.boolean().default(false),
  remocao: z.boolean().default(false),
};

export const professionalCreateSchema = z
  .object({
    ...professionalFields,
    telefones: z.array(phoneInputSchema).max(20).default([]),
  })
  .strict();

export const professionalUpdateSchema = z
  .object(professionalFields)
  .partial()
  .extend({ telefones: z.array(phoneCollectionInputSchema).max(20).optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const scoreUpdateSchema = z
  .object({
    pontuacao: z.coerce.number().finite().min(0).max(9_999_999_999.99),
  })
  .strict();

const userBaseSchema = z
  .object({
    ativo: z.boolean().default(true),
    email: z.union([z.string().trim().email().max(254), z.null()]).default(null),
    login: identifier,
    nome: z.string().trim().min(1).max(200),
    perfil: z.enum(USER_PROFILES),
    senha: password,
    unidadeIds: z
      .array(databaseIdSchema)
      .default([])
      .refine((value) => new Set(value).size === value.length, 'Não repita unidades.'),
  })
  .strict();

export const userCreateSchema = userBaseSchema.superRefine((value, context) => {
  const count = value.unidadeIds.length;
  if (value.perfil === 'DIRETOR' && count < 1) {
    context.addIssue({
      code: 'custom',
      message: 'Diretor exige ao menos uma unidade.',
      path: ['unidadeIds'],
    });
  } else if (value.perfil === 'SECRETARIO' && count !== 1) {
    context.addIssue({
      code: 'custom',
      message: 'Secretário exige exatamente uma unidade.',
      path: ['unidadeIds'],
    });
  } else if ((value.perfil === 'ADMINISTRADOR' || value.perfil === 'OPERADOR') && count !== 0) {
    context.addIssue({
      code: 'custom',
      message: 'Este perfil não utiliza vínculo de unidade.',
      path: ['unidadeIds'],
    });
  }
});

export const userUpdateSchema = userBaseSchema
  .omit({ senha: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const passwordResetSchema = z.object({ senha: password }).strict();

export const userQuerySchema = paginationSchema.extend({
  ativo: activeQuery,
  nome: z.string().trim().max(200).optional(),
  perfil: z.enum(USER_PROFILES).optional(),
});

export type UnitQuery = z.infer<typeof unitQuerySchema>;
export type UnitCreateInput = z.infer<typeof unitCreateSchema>;
export type UnitUpdateInput = z.infer<typeof unitUpdateSchema>;
export type ProfessionalQuery = z.infer<typeof professionalQuerySchema>;
export type ProfessionalCreateInput = z.infer<typeof professionalCreateSchema>;
export type ProfessionalUpdateInput = z.infer<typeof professionalUpdateSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PhoneInput = z.infer<typeof phoneInputSchema>;
export type PhoneCollectionInput = z.infer<typeof phoneCollectionInputSchema>;
