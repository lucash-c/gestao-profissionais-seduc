export const LOG_REDACTION_PATHS = [
  'req.body',
  'req.headers',
  'req.query',
  'request.body',
  'request.headers',
  'request.query',
  'password',
  'senha',
  'senhaHash',
  'token',
  'tokenHash',
  'cookie',
  'SESSION_SECRET',
  'DATABASE_URL',
] as const;

interface RequestLogInput {
  method?: string | undefined;
  url?: string | undefined;
}

/** Mantém somente método e caminho; a query pode conter identificadores pessoais. */
export function serializeRequestForLog(request: RequestLogInput): {
  method: string | undefined;
  path: string | undefined;
} {
  return {
    method: request.method,
    path: request.url?.split('?', 1)[0],
  };
}

/** Erros internos podem incluir SQL, valores ou credenciais em message/stack. */
export function safeErrorContext(error: unknown): { errorType: string } {
  return {
    errorType: error instanceof Error ? error.name : 'UnknownError',
  };
}
