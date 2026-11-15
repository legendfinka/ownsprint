import type { User } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser(data: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<User> {
  return prisma.user.create({ data });
}
