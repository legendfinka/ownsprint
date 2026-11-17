import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// A native <select> in the app's style: works with keyboard, mobile and
// screen readers for free.
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 w-full min-w-0 rounded-sm border-2 bg-card px-2 text-sm shadow-hard-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-dotted disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
