import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CircleCheck, Hourglass, ListTodo, type LucideIcon } from 'lucide-react';
import type { Task, TaskStatus } from '@ownsprint/shared';
import { Window } from '@/components/Window';
import { cn } from '@/lib/utils';
import { SortableTaskCard } from './TaskCard';

// Mustard → navy → sage: "waiting, moving, done".
const look: Record<TaskStatus, { bar: string; icon: LucideIcon }> = {
  todo: { bar: 'bg-accent text-accent-foreground', icon: ListTodo },
  in_progress: { bar: 'bg-primary text-primary-foreground', icon: Hourglass },
  done: { bar: 'bg-success text-success-foreground', icon: CircleCheck },
};

interface Props {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  children?: ReactNode;
}

// The column is a drop target itself (id = status), so empty columns work too.
export function Column({ status, title, tasks, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <Window
      aria-label={title}
      {...look[status]}
      title={
        <>
          {title}
          <span className="ml-auto font-mono text-xs font-normal">[{tasks.length}]</span>
        </>
      }
    >
      <div className="flex flex-col gap-3 bg-muted p-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul
            ref={setNodeRef}
            className={cn(
              'flex min-h-24 flex-col gap-3 rounded-sm transition-colors',
              tasks.length === 0 && 'border-2 border-dashed border-foreground/30',
              isOver && 'bg-accent/30',
            )}
          >
            {tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} />
            ))}
          </ul>
        </SortableContext>
        {children}
      </div>
    </Window>
  );
}
