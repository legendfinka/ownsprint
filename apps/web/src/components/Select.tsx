import type { ComponentProps, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props extends ComponentProps<'select'> {
  icon?: ReactNode; // shown on the left, e.g. the chosen priority's mark
}

// A native <select> in the app's style: works with keyboard, mobile and
// screen readers for free. The browser's own arrow can't be spaced from the
// border, so it's hidden and our chevron is drawn instead.
// `className` sizes the whole control (e.g. "w-24").
export function Select({ className, icon, ...props }: Props) {
  return (
    <div className={cn('relative', className)}>
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
          {icon}
        </span>
      )}
      <select
        className={cn(
          'h-8 w-full min-w-0 appearance-none rounded-sm border-2 bg-card pr-8 pl-2.5 text-sm shadow-hard-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-dotted disabled:opacity-50',
          icon && 'pl-7',
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        strokeWidth={2.5}
      />
    </div>
  );
}
