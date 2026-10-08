import { Router, type CookieOptions } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import type { Environment } from '../../config/env.js';
import { readCookie, SESSION_COOKIE_NAME } from './auth.crypto.js';
import { createRequireAuthentication } from './auth.middleware.js';
import type { AuthService } from './auth.service.js';

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: z
      .string()
      .min(1)
      .max(128)
      .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
        message: 'Senha excede o tamanho permitido.',
      }),
  })
  .strict();

export interface AuthRouterDependencies {
  authService: AuthService;
  environment: Environment;
}

export function createAuthRouter({ authService, environment }: AuthRouterDependencies): Router {
  const router = Router();
  const requireAuthentication = createRequireAuthentication(authService);
  const secureCookie = environment.NODE_ENV === 'production';
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    maxAge: environment.SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: '/',
    sameSite: 'lax',
    secure: secureCookie,
  };
  const clearCookieOptions: CookieOptions = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: secureCookie,
  };
  const loginRateLimiter = rateLimit({
    identifier: 'auth-login',
    legacyHeaders: false,
    limit: 5,
    handler(request, response) {
      const rateLimitState = (
        request as typeof request & { rateLimit: { resetTime?: Date | undefined } }
      ).rateLimit;
      const resetAt = rateLimitState.resetTime?.getTime() ?? Date.now() + 15 * 60 * 1000;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      response.setHeader('Retry-After', String(retryAfterSeconds));
      response.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Muitas tentativas de autenticação. Tente novamente mais tarde.',
        retryAfterSeconds,
      });
    },
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    windowMs: 15 * 60 * 1000,
  });

  router.post('/login', loginRateLimiter, async (request, response) => {
    const payload = loginSchema.parse(request.body);
    const result = await authService.login(payload.identifier, payload.password);

    response.cookie(SESSION_COOKIE_NAME, result.cookieValue, cookieOptions);
    response.status(200).json({ user: result.user });
  });

  router.get('/me', requireAuthentication, (request, response) => {
    response.status(200).json({ user: request.authenticatedUser });
  });

  router.post('/logout', async (request, response) => {
    const cookieValue = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    await authService.logout(cookieValue);
    response.clearCookie(SESSION_COOKIE_NAME, clearCookieOptions);
    response.status(204).send();
  });

  return router;
}
