import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;
export const SESSION_COOKIE_NAME = 'seduc_session';

export async function hashPassword(password: string): Promise<string> {
  if (bcrypt.truncates(password)) {
    throw new Error('A senha excede o limite seguro de 72 bytes do bcrypt.');
  }

  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (bcrypt.truncates(password)) {
    return Promise.resolve(false);
  }

  return bcrypt.compare(password, passwordHash);
}

function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

function signSessionId(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

export function createSignedSessionToken(secret: string): {
  cookieValue: string;
  tokenHash: string;
} {
  const sessionId = randomBytes(32).toString('base64url');
  const signature = signSessionId(sessionId, secret);

  return {
    cookieValue: `${sessionId}.${signature}`,
    tokenHash: hashSessionId(sessionId),
  };
}

export function verifySignedSessionToken(cookieValue: string, secret: string): string | null {
  const parts = cookieValue.split('.');
  const sessionId = parts[0];
  const signature = parts[1];

  if (parts.length !== 2 || !sessionId || !signature) {
    return null;
  }

  const expected = Buffer.from(signSessionId(sessionId, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  return hashSessionId(sessionId);
}

export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}
