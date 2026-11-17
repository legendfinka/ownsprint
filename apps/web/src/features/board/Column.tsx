import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable';
import { CircleCheck, Hourglass, ListTodo, type LucideIcon } from 'lucide-react';
import type { BoardTask, TaskStatus } from '@ownsprint/shared';
import { Window } from '@/components/Window';
import { cn } from '@/lib/utils';
import { SortableTaskCard } from './TaskCard';

// Mustard → navy → sage: "waiting, moving, done".
const look: Record<TaskStatus, { bar: string; icon: LucideIcon }> = {
  todo: { bar: 'bg-accent text-accent-foreground', icon: ListTodo },
  in_progress: { bar: 'bg-primary text-primary-foreground', icon: Hourglass },
  done: { bar: 'bg-success text-success-foreground', icon: CircleCheck },
};

// Cards stay still while dragging; the drop line shows where the card lands.
const keepInPlace: SortingStrategy = () => null;

interface Props {
  status: TaskStatus;
  title: string;
  tasks: BoardTask[];
  points: number; // story points of these tasks
  // Set while a card is dragged over this column: it lands below `afterId`.
  dropTarget?: { afterId: string | null };
  children?: ReactNode;
}

export function Column({ status, title, tasks, points, dropTarget, children }: Props) {
  // The column's own drop target (id = status, meaning "the bottom") is a strip
  // below the last card. If it were the whole list, the last card would always
  // win the collision check, and nothing could land below it once the column
  // is full. It also gives keyboard dragging a stop after the last card.
  const { setNodeRef: setBottomRef } = useDroppable({ id: status });

  return (
    <Window
      aria-label={title}
      {...look[status]}
      title={
        <>
          {title}
          <span className="ml-auto font-mono text-xs font-normal">
            [{tasks.length}] · {points} pts
          </span>
        </>
      }
    >
      <div className={cn('flex flex-1 flex-col gap-3 bg-muted p-3', dropTarget && 'bg-accent/25')}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={keepInPlace}>
          <ul
            className={cn(
              'flex min-h-24 flex-1 flex-col gap-3 rounded-sm',
              tasks.length === 0 && 'border-2 border-dashed border-foreground/30',
              tasks.length === 0 && dropTarget && 'border-primary bg-primary/10',
            )}
          >
            {tasks.map((task, index) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                dropLine={
                  dropTarget?.afterId === task.id
                    ? 'below'
                    : dropTarget?.afterId === null && index === 0
                      ? 'above'
                      : undefined
                }
              />
            ))}
            {/* The "bottom" drop target, right under the last card. It fills an
                empty column; -mt-3 cancels the list gap above it. */}
            <li ref={setBottomRef} aria-hidden className="-mt-3 min-h-6 flex-1" />
          </ul>
        </SortableContext>
        {children}
      </div>
    </Window>
  );
}
