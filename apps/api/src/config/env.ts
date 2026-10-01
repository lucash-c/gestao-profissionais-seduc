import { z } from 'zod';

const databaseUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
    message: 'DATABASE_URL deve usar o protocolo postgresql:// ou postgres://',
  });

const sessionSecretSchema = z
  .string()
  .min(32, 'SESSION_SECRET deve possuir ao menos 32 caracteres')
  .max(256)
  .refine((value) => !/(change-me|replace-me)/i.test(value), {
    message: 'SESSION_SECRET deve ser substituído por um segredo aleatório',
  });

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:9000'),
  DATABASE_URL: databaseUrlSchema,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_SECRET: sessionSecretSchema,
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
});

export type Environment = z.infer<typeof environmentSchema> & {
  corsOrigins: string[];
};

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = environmentSchema.parse(source);

  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
