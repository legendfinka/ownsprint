import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDetail, TaskDetail } from '@ownsprint/shared';
import { makeTask } from '@/test/factories';
import { TaskDialog } from './TaskDialog';

const project: ProjectDetail = {
  id: 'p',
  name: 'Project',
  role: 'owner',
  createdAt: '',
  members: [{ id: 'u1', name: 'Ann', email: 'ann@example.com', role: 'owner' }],
};
const task: TaskDetail = {
  ...makeTask('Write docs'),
  id: 't1',
  subtasks: [{ ...makeTask('Outline'), id: 's1', parentId: 't1' }],
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

// A fake API that knows one project and one task, and accepts any PATCH.
function fakeApi() {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return Promise.resolve(json(task));
    if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
    if (url === '/api/projects/p') return Promise.resolve(json(project));
    if (url === '/api/projects/p/tasks/t1') return Promise.resolve(json(task));
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  // The PATCH requests as [url, body] pairs.
  const patches = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([url, init]) => [url, JSON.parse(init?.body as string) as unknown]); // api() sends JSON strings
  return { patches };
}

function Search() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/board?task=t1']}>
        <Routes>
          <Route
            path="/board"
            element={
              <>
                <TaskDialog projectId="p" />
                <Search />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('TaskDialog', () => {
  it('saves a field as soon as it changes', async () => {
    const { patches } = fakeApi();
    const user = renderDialog();

    await user.selectOptions(await screen.findByLabelText('Priority'), 'high');

    await waitFor(() => expect(patches()).toEqual([['/api/projects/p/tasks/t1', { priority: 'high' }]]));
  });

  it('ticks a subtask done and opens it on click', async () => {
    const { patches } = fakeApi();
    const user = renderDialog();

    await user.click(await screen.findByLabelText('Done: Outline'));
    await waitFor(() => expect(patches()).toEqual([['/api/projects/p/tasks/s1', { status: 'done' }]]));

    await user.click(screen.getByRole('button', { name: 'Outline' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?task=s1');
  });

  it('asks before deleting, then deletes and closes', async () => {
    fakeApi();
    const user = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete task?' });
    expect(confirm).toHaveTextContent('together with its 1 subtask');

    await user.click(within(confirm).getByRole('button', { name: 'Delete task' }));
    await waitFor(() => expect(screen.getByTestId('search')).toBeEmptyDOMElement());
    expect(fetch).toHaveBeenCalledWith('/api/projects/p/tasks/t1', expect.objectContaining({ method: 'DELETE' }));
  });
});
