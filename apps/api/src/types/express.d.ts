import type { AuthenticatedUser } from '@seduc/contracts';

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}

export {};
