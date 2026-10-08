import { describe, expect, it } from 'vitest';

import {
  LOG_REDACTION_PATHS,
  safeErrorContext,
  serializeRequestForLog,
} from '../../src/observability/logging.js';

describe('logging seguro', () => {
  it('remove a query string que pode conter dados pessoais', () => {
    expect(
      serializeRequestForLog({
        method: 'GET',
        url: '/profissionais?search=12345678900&telefone=19999999999',
      }),
    ).toEqual({ method: 'GET', path: '/profissionais' });
  });

  it('não propaga message ou stack de erros internos', () => {
    const error = new Error('postgresql://usuario:senha@db/seduc com CPF 12345678900');
    expect(safeErrorContext(error)).toEqual({ errorType: 'Error' });
    expect(JSON.stringify(safeErrorContext(error))).not.toContain('senha');
  });

  it('mantém redaction explícita para payload, sessão e credenciais', () => {
    expect(LOG_REDACTION_PATHS).toEqual(
      expect.arrayContaining([
        'req.body',
        'req.headers',
        'senha',
        'senhaHash',
        'token',
        'SESSION_SECRET',
        'DATABASE_URL',
      ]),
    );
  });
});
