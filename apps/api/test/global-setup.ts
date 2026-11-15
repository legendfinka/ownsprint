import { execFileSync } from 'node:child_process';
import { assertTestDatabase, TEST_DATABASE_URL } from './test-env';

// Runs once before all tests: applies migrations to the test database.
export default function setup(): void {
  assertTestDatabase(TEST_DATABASE_URL);
  execFileSync('prisma', ['migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
