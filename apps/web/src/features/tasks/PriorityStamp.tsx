import type { Priority } from '@ownsprint/shared';
import { cn } from '@/lib/utils';

// ▲ ■ ▼ drawn as tiny SVGs: as text characters they sit at different heights
// in most fonts, as shapes they center exactly.
const shapes: Record<Priority, React.ReactElement> = {
  high: <polygon points="5,1 9.5,9 0.5,9" />,
  medium: <rect x="1.5" y="1.5" width="7" height="7" />,
  low: <polygon points="0.5,1 9.5,1 5,9" />,
};

const colors: Record<Priority, string> = {
  low: 'text-muted-foreground',
  medium: 'text-primary',
  high: 'text-destructive',
};

// Just the shape. `colored` gives it the priority's color; otherwise it takes
// the text color around it.
export function PriorityMark({ priority, colored }: { priority: Priority; colored?: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden
      className={cn('size-2.5 shrink-0 fill-current', colored && colors[priority])}
    >
      {shapes[priority]}
    </svg>
  );
}

// The <option>s of a priority <Select>. Plain text: native options can't hold
// icons, so the select shows the chosen one's mark next to it instead.
export function PriorityOptions() {
  return (
    <>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
    </>
  );
}

const stampLook: Record<Priority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'border-muted-foreground text-muted-foreground' },
  medium: { label: 'Med', className: 'border-primary text-primary' },
  high: { label: 'High', className: 'border-destructive bg-destructive text-primary-foreground' },
};

// A rubber-stamp label: "▲ HIGH". Screen readers hear "Priority: High".
export function PriorityStamp({ priority }: { priority: Priority }) {
  const { label, className } = stampLook[priority];
  return (
    <span
      title={`Priority: ${priority}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 border-2 px-1.5 font-mono text-[11px] font-bold tracking-wider uppercase',
        className,
      )}
    >
      <PriorityMark priority={priority} />
      <span className="sr-only">Priority: </span>
      {label}
    </span>
  );
}
