import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TaskStatus } from '@ownsprint/shared';
import { makeTask } from '@/test/factories';
import { sprintPoints } from './points';
import { SprintProgress } from './SprintProgress';

const task = (id: string, status: TaskStatus, estimate: number | null) => ({
  ...makeTask(id, status),
  estimate,
});

const show = (...tasks: ReturnType<typeof task>[]) =>
  render(<SprintProgress points={sprintPoints(tasks)} />);

describe('SprintProgress', () => {
  it('shows the points done out of the total, and per column', () => {
    show(task('a', 'done', 5), task('b', 'in_progress', 3), task('c', 'todo', 2));

    expect(screen.getByText('5 of 10 pts done · 50%')).toBeInTheDocument();
    expect(screen.getByText('5 done')).toBeInTheDocument();
    expect(screen.getByText('3 in progress')).toBeInTheDocument();
    expect(screen.getByText('2 to do')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '50% of 10 points done' })).toBeInTheDocument();
  });

  it('warns about tasks without an estimate', () => {
    show(task('a', 'done', 5), task('b', 'todo', null), task('c', 'todo', null));

    expect(screen.getByText('2 tasks have no estimate')).toBeInTheDocument();
  });

  it('says so when nothing has points yet', () => {
    show(task('a', 'todo', null));

    expect(screen.getByText('no points yet')).toBeInTheDocument();
    expect(screen.getByText('1 task has no estimate')).toBeInTheDocument();
  });
});
