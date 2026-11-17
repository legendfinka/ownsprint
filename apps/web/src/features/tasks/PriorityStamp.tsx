import type { Priority } from '@ownsprint/shared';
import { cn } from '@/lib/utils';

const look: Record<Priority, { mark: string; label: string; className: string }> = {
  low: { mark: '▼', label: 'Low', className: 'border-muted-foreground text-muted-foreground' },
  medium: { mark: '■', label: 'Med', className: 'border-primary text-primary' },
  high: {
    mark: '▲',
    label: 'High',
    className: 'border-destructive bg-destructive text-primary-foreground',
  },
};

// A rubber-stamp label: "▲ HIGH". Screen readers hear "Priority: High".
export function PriorityStamp({ priority }: { priority: Priority }) {
  const { mark, label, className } = look[priority];
  return (
    <span
      title={`Priority: ${priority}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 border-2 px-1.5 font-mono text-[11px] font-bold tracking-wider uppercase',
        className,
      )}
    >
      <span aria-hidden>{mark}</span>
      <span className="sr-only">Priority: </span>
      {label}
    </span>
  );
}
