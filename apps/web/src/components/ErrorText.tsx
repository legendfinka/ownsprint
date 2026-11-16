import type { ReactNode } from 'react';

// A red error line. Renders nothing when there's no error.
export function ErrorText({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {children}
    </p>
  );
}
