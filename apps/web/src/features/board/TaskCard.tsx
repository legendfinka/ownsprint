import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Priority, Task } from '@ownsprint/shared';
import { cn } from '@/lib/utils';

const priorityColor: Record<Priority, string> = {
  low: 'text-muted-foreground',
  medium: 'text-primary',
  high: 'bg-destructive text-primary-foreground border-destructive',
};

export function TaskCard({ task, lifted }: { task: Task; lifted?: boolean }) {
  return (
    <div
      className={cn(
        'grid cursor-grab gap-2.5 rounded-sm border-2 bg-card p-3 text-sm shadow-hard-sm',
        lifted && 'rotate-2 cursor-grabbing shadow-hard',
      )}
    >
      <p className={cn('font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>
        {task.title}
      </p>
      {/* Little rubber-stamp labels. */}
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase">
        <span className={cn('border-2 border-current px-1.5 font-bold', priorityColor[task.priority])}>
          {task.priority}
        </span>
        {task.estimate !== null && (
          <span className="ml-auto text-muted-foreground">{task.estimate} pts</span>
        )}
      </div>
    </div>
  );
}

// The card in its column. dnd-kit adds mouse, touch and keyboard handlers
// (focus a card, Space to lift, arrows to move, Space to drop).
export function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dotted focus-visible:outline-ring',
        isDragging && 'opacity-30',
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} />
    </li>
  );
}
