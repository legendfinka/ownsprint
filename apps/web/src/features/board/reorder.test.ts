import { describe, expect, it } from 'vitest';
import type { Task } from '@ownsprint/shared';
import { makeTask } from '@/test/factories';
import { applyMove, dropToMove } from './reorder';

// To Do: A, B, C. In Progress: D.
const tasks = [makeTask('A'), makeTask('B'), makeTask('C'), makeTask('D', 'in_progress')];

// "todo: A B C | in_progress: D" — easy to read in assertions.
const columns = (list: Task[]) =>
  (['todo', 'in_progress', 'done'] as const)
    .map(
      (s) =>
        `${s}: ${list
          .filter((t) => t.status === s)
          .map((t) => t.id)
          .join(' ')}`,
    )
    .join(' | ');

describe('dropToMove', () => {
  it('moves down: lands below the card it was dropped on', () => {
    expect(dropToMove(tasks, 'A', 'C')).toEqual({ taskId: 'A', status: 'todo', afterId: 'C' });
  });

  it('moves up: takes the place of the card it was dropped on', () => {
    expect(dropToMove(tasks, 'C', 'A')).toEqual({ taskId: 'C', status: 'todo', afterId: null });
    expect(dropToMove(tasks, 'C', 'B')).toEqual({ taskId: 'C', status: 'todo', afterId: 'A' });
  });

  it('moves to another column, onto a card or onto empty space', () => {
    expect(dropToMove(tasks, 'B', 'D')).toEqual({
      taskId: 'B',
      status: 'in_progress',
      afterId: null,
    });
    expect(dropToMove(tasks, 'B', 'in_progress')).toEqual({
      taskId: 'B',
      status: 'in_progress',
      afterId: 'D',
    });
    expect(dropToMove(tasks, 'B', 'done')).toEqual({ taskId: 'B', status: 'done', afterId: null });
  });

  it("lands below the last card of a full column when dropped on the column's bottom", () => {
    expect(dropToMove(tasks, 'D', 'todo')).toEqual({ taskId: 'D', status: 'todo', afterId: 'C' });
  });

  it('returns null when nothing changes', () => {
    expect(dropToMove(tasks, 'B', 'B')).toBeNull();
    expect(dropToMove(tasks, 'C', 'todo')).toBeNull(); // already last
    expect(dropToMove(tasks, 'A', 'unknown')).toBeNull();
  });
});

describe('applyMove', () => {
  it('matches what the server will do', () => {
    expect(columns(applyMove(tasks, { taskId: 'A', status: 'todo', afterId: 'C' }))).toBe(
      'todo: B C A | in_progress: D | done: ',
    );
    expect(columns(applyMove(tasks, { taskId: 'B', status: 'in_progress', afterId: null }))).toBe(
      'todo: A C | in_progress: B D | done: ',
    );
    expect(columns(applyMove(tasks, { taskId: 'C', status: 'done', afterId: null }))).toBe(
      'todo: A B | in_progress: D | done: C',
    );
  });
});
