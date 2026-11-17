import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Sprint } from '@ownsprint/shared';
import { makeTask } from '@/test/factories';
import { boardKeys } from './queries';
import { SprintActions } from './SprintActions';

const sprint = (id: string, status: Sprint['status']): Sprint => ({
  id,
  projectId: 'p',
  name: `Sprint ${id}`,
  startDate: '2026-11-16',
  endDate: '2026-11-29',
  status,
});

const active = sprint('1', 'active');
const next = sprint('2', 'planned');

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function show(current: Sprint, isOwner = true, response = () => json(current)) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);

  // Two of three tasks are open; 3 of 8 points are done.
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(boardKeys.board('p', current.id), [
    { ...makeTask('a', 'done'), estimate: 3 },
    { ...makeTask('b', 'todo'), estimate: 3 },
    { ...makeTask('c', 'in_progress'), estimate: 2 },
  ]);
  render(
    <QueryClientProvider client={client}>
      <SprintActions
        projectId="p"
        sprint={current}
        sprints={[active, next, sprint('3', 'completed')]}
        isOwner={isOwner}
      />
    </QueryClientProvider>,
  );
  // Requests sent so far: ["POST /api/projects/p/sprints/1/complete", body]
  const calls = () =>
    fetchMock.mock.calls.map(
      ([url, init]) =>
        [`${init?.method ?? 'GET'} ${url}`, init?.body && JSON.parse(init.body as string)] as const,
    );
  return { calls, user: userEvent.setup() };
}

// The button inside the open window (the trigger has the same name).
const confirm = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Complete sprint' }));

describe('SprintActions', () => {
  it('starts a planned sprint', async () => {
    const { calls, user } = show(next);

    await user.click(screen.getByRole('button', { name: 'Start sprint' }));

    await waitFor(() => expect(calls()[0]?.[0]).toBe('POST /api/projects/p/sprints/2/start'));
  });

  it('says why a sprint could not be started', async () => {
    const error = { error: { code: 'CONFLICT', message: '"Sprint 1" is already active' } };
    const { user } = show(next, true, () => json(error, 409));

    await user.click(screen.getByRole('button', { name: 'Start sprint' }));

    expect(await screen.findByText('"Sprint 1" is already active')).toBeInTheDocument();
  });

  it('hides that error after 5 seconds', async () => {
    const error = { error: { code: 'CONFLICT', message: 'Already active' } };
    const { user } = show(next, true, () => json(error, 409));
    await user.click(screen.getByRole('button', { name: 'Start sprint' }));
    await screen.findByText('Already active');

    // Real timers: waitFor polls until the 5 s are up.
    await waitFor(() => expect(screen.queryByText('Already active')).not.toBeInTheDocument(), {
      timeout: 6000,
    });
  }, 8000);

  it('completes into the next planned sprint by default', async () => {
    const { calls, user } = show(active);

    await user.click(screen.getByRole('button', { name: 'Complete sprint' }));
    expect(screen.getByText('1 of 3 tasks done · 3 of 8 pts')).toBeInTheDocument();
    expect(screen.getByLabelText(/Move 2 unfinished tasks to/)).toHaveValue('2');
    await confirm(user);

    await waitFor(() =>
      expect(calls()).toContainEqual(['POST /api/projects/p/sprints/1/complete', { moveTo: '2' }]),
    );
  });

  it('can send the unfinished tasks to the backlog', async () => {
    const { calls, user } = show(active);

    await user.click(screen.getByRole('button', { name: 'Complete sprint' }));
    await user.selectOptions(screen.getByLabelText(/unfinished tasks to/), 'Backlog');
    await confirm(user);

    await waitFor(() =>
      expect(calls()).toContainEqual(['POST /api/projects/p/sprints/1/complete', { moveTo: null }]),
    );
  });

  it('has no complete button for members', () => {
    show(active, false);

    expect(screen.queryByRole('button', { name: 'Complete sprint' })).not.toBeInTheDocument();
  });

  it('has no action for a completed sprint', () => {
    show(sprint('3', 'completed'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
