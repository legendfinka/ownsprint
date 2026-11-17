import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props extends Omit<ComponentProps<'section'>, 'title'> {
  title: ReactNode;
  icon: LucideIcon;
  bar?: string; // title bar colors, e.g. 'bg-primary text-primary-foreground'
}

// A panel styled like an old desktop window: ink border, hard shadow and a
// title bar with an icon. Used for columns, cards and popovers.
export function Window({
  title,
  icon: Icon,
  bar = 'bg-foreground text-background',
  className,
  children,
  ...props
}: Props) {
  return (
    <section
      className={cn(
        // flex-col: the content can grow to fill a stretched window (board columns).
        'flex flex-col overflow-hidden rounded-sm border-2 border-foreground bg-card shadow-hard',
        className,
      )}
      {...props}
    >
      <header
        className={cn('flex items-center gap-2 border-b-2 border-foreground px-3 py-1.5', bar)}
      >
        <Icon className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        <h2 className="flex flex-1 items-center gap-2 text-sm font-bold">{title}</h2>
      </header>
      {children}
    </section>
  );
}
