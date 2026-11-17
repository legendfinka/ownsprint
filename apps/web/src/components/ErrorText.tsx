import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  compact?: boolean; // no box: for a message right under one field
  children?: ReactNode;
}

// An error notice: ink-red border, tinted fill, warning icon. Renders nothing
// when there's no error. Screen readers announce it when it appears.
export function ErrorText({ id, compact, children }: Props) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        'flex items-start gap-2 text-sm font-medium text-destructive',
        !compact && 'rounded-sm border-2 border-destructive bg-destructive/10 px-3 py-2',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} aria-hidden />
      {children}
    </p>
  );
}
