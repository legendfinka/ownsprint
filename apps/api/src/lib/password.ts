import { hash, verify } from '@node-rs/argon2';

// argon2id with OWASP's recommended settings: 19 MiB memory, 2 passes.
const options = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
