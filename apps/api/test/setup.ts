import { afterAll, beforeEach } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { assertTestDatabase } from './test-env';

assertTestDatabase(env.DATABASE_URL);

// Each test starts with empty tables.
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE "RefreshToken", "Task", "Sprint", "Membership", "Project", "User" CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
