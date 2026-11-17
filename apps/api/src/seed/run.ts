// `pnpm --filter api seed`: fills the database in DATABASE_URL with the demo data.
import { DEMO_ACCOUNT } from '@ownsprint/shared';
import { prisma } from '../lib/prisma';
import { seedDemo } from './demo-data';

try {
  await seedDemo(prisma);
  console.log(`Demo data ready. Log in as ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`);
} finally {
  await prisma.$disconnect();
}
