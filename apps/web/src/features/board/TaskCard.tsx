import { useSortable } from '@dnd-kit/sortable';
import { ListChecks } from 'lucide-react';
import type { BoardTask } from '@ownsprint/shared';
import { PriorityStamp } from '@/features/tasks/PriorityStamp';
import { useTaskParam } from '@/features/tasks/queries';
import { cn } from '@/lib/utils';

export function TaskCard({ task, lifted }: { task: BoardTask; lifted?: boolean }) {
  const { done, total } = task.subtaskCount;

  return (
    <div
      className={cn(
        'grid cursor-grab gap-2.5 rounded-sm border-2 bg-card p-3 text-sm shadow-hard-sm',
        lifted && 'rotate-2 cursor-grabbing shadow-hard',
      )}
    >
      <p
        className={cn(
          'font-medium',
          task.status === 'done' && 'text-muted-foreground line-through',
        )}
      >
        {task.title}
      </p>
      <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
        <PriorityStamp priority={task.priority} />
        {total > 0 && (
          <span className="flex items-center gap-1.5" title={`${done} of ${total} subtasks done`}>
            <ListChecks className="size-3.5" aria-hidden />
            {done}/{total}
            <span className="sr-only">subtasks done</span>
            <span aria-hidden className="h-1.5 w-10 border border-current">
              <span
                className="block h-full bg-success"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </span>
          </span>
        )}
        {task.estimate !== null && (
          <span className="ml-auto tracking-wider uppercase">{task.estimate} pts</span>
        )}
      </div>
    </div>
  );
}

// A thick line in the gap above or below a card: "the card lands here".
const dropLineClass = {
  above:
    "before:absolute before:inset-x-0 before:-top-2 before:h-1 before:bg-primary before:content-['']",
  below:
    "after:absolute after:inset-x-0 after:-bottom-2 after:h-1 after:bg-primary after:content-['']",
};

interface Props {
  task: BoardTask;
  dropLine?: 'above' | 'below';
}

// The card in its column. dnd-kit adds mouse, touch and keyboard dragging
// (focus a card, Space to lift, arrows to move, Space to drop). A click or
// Enter opens the task. dnd-kit swallows the click that ends a drag.
// Cards don't slide out of the way while dragging; the drop line shows the spot.
export function SortableTaskCard({ task, dropLine }: Props) {
  const [, openTask] = useTaskParam();
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        // select-none and no callout: a long press lifts the card instead of
        // selecting its text or opening the phone's menu.
        'relative rounded-sm outline-none select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dotted focus-visible:outline-ring',
        isDragging && 'opacity-30',
        dropLine && dropLineClass[dropLine],
      )}
      {...attributes}
      {...listeners}
      onClick={() => openTask(task.id)}
      // keyUp, not keyDown: dnd-kit owns onKeyDown for dragging.
      onKeyUp={(e) => e.key === 'Enter' && openTask(task.id)}
    >
      <TaskCard task={task} />
    </li>
  );
}
