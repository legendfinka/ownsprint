import {
  fullName,
  type ChangeEmailInput,
  type ChangePasswordInput,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  type UpdateProfileInput,
} from '@ownsprint/shared';
import { env } from '../../config/env';
import type { User } from '../../generated/prisma/client';
import { ConflictError, UnauthorizedError, ValidationError } from '../../lib/errors';
import { hashPassword, verifyPassword } from '../../lib/password';
import { isUniqueConstraintError } from '../../lib/prisma';
import { generateRefreshToken, hashToken, signAccessToken } from '../../lib/tokens';
import { createUser, findUserByEmail, findUserById, updateUser } from '../users/users.repository';
import {
  createRefreshToken,
  findRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
} from './auth.repository';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Session extends Tokens {
  user: PublicUser;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Checked when the email doesn't exist, so the response takes the same time
// and doesn't reveal which emails are registered.
const dummyHash = hashPassword('dummy-password');

export async function register(input: RegisterInput): Promise<Session> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await createUser({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
    });
    return await startSession(user);
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new ConflictError('Email is already registered');
    throw err;
  }
}

export async function login(input: LoginInput): Promise<Session> {
  const user = await findUserByEmail(input.email);
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password);
  if (!user || !valid) throw new UnauthorizedError('Invalid email or password');
  return startSession(user);
}

// Swaps a refresh token for new tokens. Each refresh token works only once.
export async function refresh(refreshToken: string | undefined): Promise<Tokens> {
  const stored = refreshToken ? await findRefreshToken(hashToken(refreshToken)) : null;
  if (!stored || stored.expiresAt <= new Date()) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // An already-used token came back, so it was probably stolen.
  // Log the user out everywhere to be safe.
  const revoked = !stored.revokedAt && (await revokeRefreshToken(stored.id));
  if (!revoked) {
    await revokeAllRefreshTokens(stored.userId);
    throw new UnauthorizedError('Invalid refresh token');
  }

  return issueTokens(stored.userId);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const stored = await findRefreshToken(hashToken(refreshToken));
  if (stored) await revokeRefreshToken(stored.id);
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedError();
  return toPublicUser(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  return toPublicUser(await updateUser(userId, input));
}

export async function changeEmail(userId: string, input: ChangeEmailInput): Promise<PublicUser> {
  await requireCurrentPassword(userId, input.currentPassword);
  try {
    return toPublicUser(await updateUser(userId, { email: input.email }));
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new ConflictError('Email is already registered');
    throw err;
  }
}

// Signs out every other device. The current session (its refresh token) stays.
export async function changePassword(
  userId: string,
  refreshToken: string | undefined,
  input: ChangePasswordInput,
): Promise<void> {
  await requireCurrentPassword(userId, input.currentPassword);
  await updateUser(userId, { passwordHash: await hashPassword(input.newPassword) });

  const current = refreshToken ? await findRefreshToken(hashToken(refreshToken)) : null;
  await revokeAllRefreshTokens(userId, current?.userId === userId ? current.id : undefined);
}

// A wrong password is a 400 on that field, not a 401: the user is still logged in.
async function requireCurrentPassword(userId: string, password: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedError();
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw ValidationError.fields({ currentPassword: 'Wrong password' });
  }
}

async function startSession(user: User): Promise<Session> {
  return { user: toPublicUser(user), ...(await issueTokens(user.id)) };
}

async function issueTokens(userId: string): Promise<Tokens> {
  const refreshToken = generateRefreshToken();
  await createRefreshToken({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
  });
  return { accessToken: await signAccessToken(userId), refreshToken };
}

// Only these fields go to the client (never the password hash).
function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: fullName(user.firstName, user.lastName),
    // Only values from the shared lists are ever saved, so the cast is safe.
    avatarColor: user.avatarColor as PublicUser['avatarColor'],
    avatarEmoji: user.avatarEmoji as PublicUser['avatarEmoji'],
    createdAt: user.createdAt.toISOString(),
  };
}
