import type { RequestHandler } from 'express';

import type { Environment } from '../config/env.js';
import { HttpError } from './http-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protege mutações autenticadas por cookie contra CSRF. Em produção a origem é
 * obrigatória; em desenvolvimento/teste clientes não-browser podem omiti-la.
 */
export function createRequireAllowedOrigin(environment: Environment): RequestHandler {
  return (request, _response, next) => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.headers.origin;
    const missingOriginAllowed = !origin && environment.NODE_ENV !== 'production';
    if (missingOriginAllowed || (origin && environment.corsOrigins.includes(origin))) {
      next();
      return;
    }

    next(new HttpError(403, 'INVALID_ORIGIN', 'Origem da solicitação não autorizada.'));
  };
}
