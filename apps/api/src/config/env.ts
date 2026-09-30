import { z } from 'zod';

const databaseUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
    message: 'DATABASE_URL deve usar o protocolo postgresql:// ou postgres://',
  });

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:9000'),
  DATABASE_URL: databaseUrlSchema,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
