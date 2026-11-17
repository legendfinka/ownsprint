import { describe, expect, it } from 'vitest';
import type { TaskStatus } from '@ownsprint/shared';
import { makeTask } from '@/test/factories';
import { percentDone, sprintPoints } from './points';

const task = (id: string, status: TaskStatus, estimate: number | null) => ({
  ...makeTask(id, status),
  estimate,
});

describe('sprintPoints', () => {
  it('adds up the points of each column and the whole sprint', () => {
    const points = sprintPoints([
      task('a', 'todo', 3),
      task('b', 'todo', 5),
      task('c', 'in_progress', 2),
      task('d', 'done', 8),
    ]);

    expect(points.byStatus).toEqual({ todo: 8, in_progress: 2, done: 8 });
    expect(points.total).toBe(18);
    expect(points.unestimated).toBe(0);
  });

  it('counts tasks without an estimate separately, as 0 points', () => {
    const points = sprintPoints([
      task('a', 'todo', null),
      task('b', 'done', null),
      task('c', 'done', 3),
    ]);

    expect(points.total).toBe(3);
    expect(points.unestimated).toBe(2);
  });

  it('treats an estimate of 0 as estimated', () => {
    expect(sprintPoints([task('a', 'todo', 0)]).unestimated).toBe(0);
  });

  it('handles an empty sprint', () => {
    expect(sprintPoints([])).toEqual({
      byStatus: { todo: 0, in_progress: 0, done: 0 },
      total: 0,
      unestimated: 0,
    });
  });
});

describe('percentDone', () => {
  it('is the share of points that are done, rounded', () => {
    expect(percentDone(sprintPoints([task('a', 'done', 1), task('b', 'todo', 2)]))).toBe(33);
  });

  it('is 0, not NaN, when there are no points', () => {
    expect(percentDone(sprintPoints([task('a', 'todo', null)]))).toBe(0);
  });
});
