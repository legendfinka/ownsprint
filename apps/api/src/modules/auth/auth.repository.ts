import type { RefreshToken } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

export function createRefreshToken(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<RefreshToken> {
  return prisma.refreshToken.create({ data });
}

export function findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
  return prisma.refreshToken.findUnique({ where: { tokenHash } });
}

// One atomic query: if two requests race with the same token, only one gets `true`.
export async function revokeRefreshToken(id: string): Promise<boolean> {
  const { count } = await prisma.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count === 1;
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
