import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

// Short-lived JWT with only the user id inside.
export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

// Returns the user id, or throws if the token is invalid or expired.
export async function verifyAccessToken(token: string): Promise<string> {
  try {
    // Only accept HS256, so "alg: none" tricks don't work.
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.sub) return payload.sub;
  } catch {
    // Fall through to the error below.
  }
  throw new UnauthorizedError('Invalid or expired access token');
}

// Refresh tokens are random strings; the database decides if they're valid.
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

// SHA-256 is enough here: the token is already random, unlike a password.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
