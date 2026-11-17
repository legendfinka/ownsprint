import type { Task, TaskStatus } from '@ownsprint/shared';

export interface SprintPoints {
  byStatus: Record<TaskStatus, number>;
  total: number;
  unestimated: number; // tasks without an estimate (they count as 0 points)
}

// Story points of the board's tasks. The board lists only top-level tasks:
// a subtask's points are already part of its parent's estimate, so counting
// both would count the work twice.
export function sprintPoints(tasks: Task[]): SprintPoints {
  const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 };
  let unestimated = 0;

  for (const task of tasks) {
    if (task.estimate === null) unestimated++;
    else byStatus[task.status] += task.estimate;
  }

  const total = byStatus.todo + byStatus.in_progress + byStatus.done;
  return { byStatus, total, unestimated };
}

// Share of the points that are done, as a whole percent (0 when there are none).
export function percentDone({ byStatus, total }: SprintPoints): number {
  return total === 0 ? 0 : Math.round((byStatus.done / total) * 100);
}
