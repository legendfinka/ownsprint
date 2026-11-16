import type { MoveTaskInput, Task, TaskStatus } from '@ownsprint/shared';

export const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'done', title: 'Done' },
];

export type Move = MoveTaskInput & { taskId: string };

const isStatus = (id: string): id is TaskStatus => COLUMNS.some((c) => c.status === id);

// Turns a drop into a move. `overId` is the card under the pointer, or a
// column id when dropped on its empty space. Null means "nothing changed".
export function dropToMove(tasks: Task[], activeId: string, overId: string): Move | null {
  const active = tasks.find((t) => t.id === activeId);
  const over = tasks.find((t) => t.id === overId);
  const status = over?.status ?? (isStatus(overId) ? overId : undefined);
  if (!active || !status) return null;

  const column = tasks.filter((t) => t.status === status);
  const others = column.filter((t) => t.id !== activeId);
  // Over a card: take its place. Over empty space: go to the bottom.
  const index = over ? column.indexOf(over) : others.length;
  const afterId = others[index - 1]?.id ?? null;

  const before = column[column.indexOf(active) - 1]?.id ?? null;
  if (status === active.status && afterId === before) return null;
  return { taskId: activeId, status, afterId };
}

// The same move on the cached list, so the board updates before the server
// answers. Columns are read in list order, so no position math is needed here.
export function applyMove(tasks: Task[], { taskId, status, afterId }: Move): Task[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;

  const rest = tasks.filter((t) => t.id !== taskId);
  const index = afterId ? rest.findIndex((t) => t.id === afterId) + 1 : 0;
  rest.splice(index, 0, { ...task, status });
  return rest;
}
