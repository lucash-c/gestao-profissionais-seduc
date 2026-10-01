import type { RequestHandler } from 'express';

import { HttpError } from '../../http/http-error.js';
import { readCookie, SESSION_COOKIE_NAME } from './auth.crypto.js';
import type { AuthService } from './auth.service.js';

export function createRequireAuthentication(authService: AuthService): RequestHandler {
  return async (request, _response, next) => {
    const cookieValue = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    const user = await authService.getCurrentUser(cookieValue);

    if (!user) {
      next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.'));
      return;
    }

    request.authenticatedUser = user;
    next();
  };
}
