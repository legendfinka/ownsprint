// `pnpm --filter api seed`: creates the fixed demo login in DATABASE_URL.
import { prisma } from '../lib/prisma';
import { SEED_ACCOUNT, seedDemo } from './demo-data';

try {
  await seedDemo();
  console.log(`Demo data ready. Log in as ${SEED_ACCOUNT.email} / ${SEED_ACCOUNT.password}`);
} finally {
  await prisma.$disconnect();
}
