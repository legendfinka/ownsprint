import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type {
  BreakdownSuggestion,
  DescriptionSuggestion,
  EstimateSuggestion,
  TaskDetail,
} from '@ownsprint/shared';
import { makeTask } from '@/test/factories';
import { AiAssistant } from './AiAssistant';

const task: TaskDetail = { ...makeTask('Add CSV export'), id: 't1', subtasks: [] };
const breakdown: BreakdownSuggestion = {
  subtasks: [
    { title: 'Design the format', priority: 'high', estimate: 2 },
    { title: 'Build the endpoint', priority: 'medium', estimate: 3 },
    { title: 'Add a download button', priority: 'low', estimate: 1 },
  ],
};
const estimate: EstimateSuggestion = { estimate: 5, priority: 'high', rationale: 'Touches many parts.' };
const description: DescriptionSuggestion = { description: 'Export tasks.\nDone when:\n- It downloads' };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeApi() {
  // `_init` is unused here, but declaring it lets tests read each call's body.
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url.endsWith('/ai/breakdown')) return Promise.resolve(json(breakdown));
    if (url.endsWith('/ai/estimate')) return Promise.resolve(json(estimate));
    if (url.endsWith('/ai/description')) return Promise.resolve(json(description));
    if (url.endsWith('/subtasks')) return Promise.resolve(json({ subtasks: [] }, 201));
    return Promise.resolve(json(task));
  });
  vi.stubGlobal('fetch', fetchMock);
  // The JSON body sent to a URL ending with `suffix`, if any.
  const sentTo = (suffix: string) => {
    const init = fetchMock.mock.calls.find(([url]) => url.endsWith(suffix))?.[1];
    return init && (JSON.parse(init.body as string) as unknown); // api() sends JSON strings
  };
  return { fetchMock, sentTo };
}

function renderAssistant(withTask: TaskDetail = task) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AiAssistant projectId="p" task={withTask} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('AiAssistant', () => {
  it('saves only the subtasks the user kept, with their edits', async () => {
    const { sentTo } = fakeApi();
    const user = renderAssistant();

    await user.click(screen.getByRole('button', { name: 'Break down into subtasks' }));
    const firstTitle = await screen.findByLabelText('Suggestion 1 title');
    await user.clear(firstTitle);
    await user.type(firstTitle, 'Pick CSV columns');
    await user.selectOptions(screen.getByLabelText('Suggestion 2 priority'), 'high');
    await user.click(screen.getByLabelText('Keep suggestion 3'));
    await user.click(screen.getByRole('button', { name: 'Add 2 subtasks' }));

    await waitFor(() =>
      expect(sentTo('/subtasks')).toEqual({
        subtasks: [
          { title: 'Pick CSV columns', priority: 'high', estimate: 2 },
          { title: 'Build the endpoint', priority: 'high', estimate: 3 },
        ],
        replace: true,
      }),
    );
    // The review list closes after saving.
    await waitFor(() => expect(screen.queryByLabelText('Suggestion 1 title')).toBeNull());
  });

  it('asks before replacing existing subtasks', async () => {
    const { sentTo } = fakeApi();
    const subtasks = [
      { ...makeTask('Old one', 'done'), id: 's1', parentId: 't1' },
      { ...makeTask('Old two'), id: 's2', parentId: 't1' },
    ];
    const user = renderAssistant({ ...task, subtasks });

    await user.click(screen.getByRole('button', { name: 'Break down into subtasks' }));
    await user.click(await screen.findByRole('button', { name: 'Replace subtasks' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Replace subtasks?' });
    expect(confirm).toHaveTextContent('deletes the 2 subtasks this task has now (1 already done)');
    expect(sentTo('/subtasks')).toBeUndefined(); // nothing sent before confirming

    await user.click(within(confirm).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(sentTo('/subtasks')).toMatchObject({ replace: true }));
  });

  it('writes a description and applies it only when asked', async () => {
    const { sentTo } = fakeApi();
    const user = renderAssistant();

    await user.click(screen.getByRole('button', { name: 'Write description' }));
    expect(await screen.findByText(/Export tasks\./)).toBeInTheDocument();
    expect(sentTo('/tasks/t1')).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(sentTo('/tasks/t1')).toEqual({ description: description.description }));
  });

  it('shows an estimate and applies it only when asked', async () => {
    const { sentTo } = fakeApi();
    const user = renderAssistant();

    await user.click(screen.getByRole('button', { name: 'Suggest estimate' }));
    expect(await screen.findByText('Touches many parts.')).toBeInTheDocument();
    expect(sentTo('/tasks/t1')).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(sentTo('/tasks/t1')).toEqual({ estimate: 5, priority: 'high' }));
  });
});
