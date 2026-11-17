import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BoardTask, SprintEstimates } from '@ownsprint/shared';
import { makeTask } from '@/test/factories';
import { BulkEstimate } from './BulkEstimate';

const board = (id: string, title: string): BoardTask => ({
  ...makeTask(id),
  title,
  subtaskCount: { done: 0, total: 0 },
});
const tasks = [board('t1', 'Write docs'), board('t2', 'Fix login bug')];

const suggestion: SprintEstimates = {
  suggestions: [
    { taskId: 't1', estimate: 2, rationale: 'Small and clear.' },
    { taskId: 't2', estimate: 5, rationale: 'Touches auth.' },
  ],
  remaining: 0,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeApi(estimates: Response | SprintEstimates = suggestion) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    Promise.resolve(
      url.endsWith('/ai/estimates')
        ? estimates instanceof Response
          ? estimates
          : json(estimates)
        : json({}),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  // Every task update sent so far: [task id, JSON body].
  const updates = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([url, init]) => [url.split('/').pop(), JSON.parse(init?.body as string)] as const);
  return { fetchMock, updates };
}

function renderButton() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BulkEstimate projectId="p" sprintId="s" tasks={tasks} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('BulkEstimate', () => {
  it('applies only the suggestions the user kept, with their edits', async () => {
    const { updates } = fakeApi();
    const user = renderButton();

    await user.click(screen.getByRole('button', { name: 'Estimate with AI' }));
    expect(await screen.findByText('Small and clear.')).toBeInTheDocument();
    expect(updates()).toEqual([]); // nothing saved yet

    await user.selectOptions(screen.getByLabelText('Points for Write docs'), '8');
    await user.click(screen.getByLabelText('Apply to Fix login bug'));
    await user.click(screen.getByRole('button', { name: 'Apply 1 estimate' }));

    await waitFor(() => expect(updates()).toEqual([['t1', { estimate: 8 }]]));
    // The window closes after saving.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows the error and lets the user try again', async () => {
    const failure = json({ error: { code: 'AI_ERROR', message: 'The AI service is down.' } }, 502);
    const { fetchMock } = fakeApi(failure);
    const user = renderButton();

    await user.click(screen.getByRole('button', { name: 'Estimate with AI' }));
    expect(await screen.findByText('The AI service is down.')).toBeInTheDocument();

    fetchMock.mockImplementationOnce(() => Promise.resolve(json(suggestion)));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Touches auth.')).toBeInTheDocument();
  });

  it('says when more tasks are left without an estimate', async () => {
    fakeApi({ ...suggestion, remaining: 3 });
    const user = renderButton();

    await user.click(screen.getByRole('button', { name: 'Estimate with AI' }));

    expect(await screen.findByText(/3 more tasks have no estimate/)).toBeInTheDocument();
  });

  it('applies nothing when discarded', async () => {
    const { updates } = fakeApi();
    const user = renderButton();

    await user.click(screen.getByRole('button', { name: 'Estimate with AI' }));
    await screen.findByText('Small and clear.');
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(updates()).toEqual([]);
  });
});
