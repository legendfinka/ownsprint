import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { percentDone, type SprintPoints } from './points';

// Same colors as the columns: mustard waiting, navy moving, sage done.
const parts = [
  { status: 'done', label: 'done', color: 'bg-success' },
  { status: 'in_progress', label: 'in progress', color: 'bg-primary' },
  { status: 'todo', label: 'to do', color: 'bg-accent' },
] as const;

interface Props {
  points: SprintPoints;
  action?: ReactNode; // shown next to the "no estimate" note, e.g. a button to fix it
}

// The sprint's story points at a glance: one bar split by column.
export function SprintProgress({ points, action }: Props) {
  const { byStatus, total, unestimated } = points;
  const percent = percentDone(points);

  return (
    <section
      aria-label="Sprint progress"
      className="grid gap-2 rounded-sm border-2 border-foreground bg-card px-3 py-2.5 shadow-hard-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
        <h3 className="font-heading font-semibold">Sprint progress</h3>
        <p className="font-mono text-xs">
          {total === 0
            ? 'no points yet'
            : `${String(byStatus.done)} of ${String(total)} pts done · ${String(percent)}%`}
        </p>
      </div>

      <div
        role="img"
        aria-label={`${String(percent)}% of ${String(total)} points done`}
        className="flex h-3.5 overflow-hidden rounded-sm border-2 border-foreground bg-muted"
      >
        {/* Only the parts that have points, so no empty slice is drawn. */}
        {parts
          .filter(({ status }) => byStatus[status] > 0)
          .map(({ status, color }) => (
            <div
              key={status}
              className={cn('border-foreground not-first:border-l-2', color)}
              style={{ width: `${String((byStatus[status] / total) * 100)}%` }}
            />
          ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
        {parts.map(({ status, label, color }) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-2.5 border-2 border-foreground', color)} />
            {byStatus[status]} {label}
          </li>
        ))}
        {unestimated > 0 && (
          <li className="ml-auto flex items-center gap-3 text-foreground">
            {unestimated} {unestimated === 1 ? 'task has' : 'tasks have'} no estimate
            {action}
          </li>
        )}
      </ul>
    </section>
  );
}
