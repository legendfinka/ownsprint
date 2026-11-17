// "Try demo account" gives each visitor a fresh, private account under this
// domain, with its own sample project. The API deletes them after a day.
export const DEMO_EMAIL_DOMAIN = 'demo.ownsprint.dev';

export function isDemoEmail(email: string): boolean {
  return email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
