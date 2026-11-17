// The public demo account. The seed script creates it and the login page's
// "Try demo account" button signs in with it, so both read it from here.
export const DEMO_ACCOUNT = {
  email: 'demo@ownsprint.dev',
  password: 'demo-password-123',
  firstName: 'Demo',
  lastName: 'User',
} as const;
