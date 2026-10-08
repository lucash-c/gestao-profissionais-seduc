import { z } from 'zod';

const POSTGRES_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts PostgreSQL UUID text without imposing RFC version or variant bits. */
export const databaseIdSchema = z
  .string()
  .regex(POSTGRES_UUID_PATTERN, 'Informe um identificador válido.');
