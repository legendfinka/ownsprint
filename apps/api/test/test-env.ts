export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ownsprint:ownsprint@localhost:5432/ownsprint_test';

export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_ACCESS_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
  AUTH_RATE_LIMIT_MAX: '1000', // the rate-limit test sets its own low limit
};

// Tests wipe tables, so never run them against a non-test database.
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run tests on "${name}": database name must end in _test`);
  }
}
