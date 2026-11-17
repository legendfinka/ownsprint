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
  firstName: string;
  lastName: string;
  passwordHash: string;
}): Promise<User> {
  return prisma.user.create({ data });
}

export function updateUser(
  id: string,
  data: Partial<
    Pick<User, 'email' | 'passwordHash' | 'firstName' | 'lastName' | 'avatarColor' | 'avatarEmoji'>
  >,
): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}
