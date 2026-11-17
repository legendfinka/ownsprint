import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/test/factories';
import { TaskList } from './TaskList';

const member = {
  id: 'u1',
  name: 'Ann Lee',
  email: 'ann@example.com',
  role: 'owner',
  title: null,
  avatarColor: null,
  avatarEmoji: null,
};
const project = { id: 'p', name: 'P', role: 'owner', createdAt: '', members: [member] };
const sprints = [
  { id: 's', projectId: 'p', name: 'Sprint 1', startDate: '', endDate: '', status: 'active' },
];

const json = (body: unknown) => new Response(JSON.stringify(body));

// Answers the project, the sprints and the task list; `total` fakes a long list.
function fakeApi(total = 2) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/tasks?')) {
      const page = Number(new URL(url, 'http://x').searchParams.get('page'));
      const items = [
        { ...makeTask('Fix login', 'in_progress'), assigneeId: 'u1', estimate: 3 },
        { ...makeTask('Write docs'), sprintId: null },
      ];
      return Promise.resolve(json({ items, total, page, pageSize: 20 }));
    }
    if (url.endsWith('/sprints')) return Promise.resolve(json({ sprints }));
    return Promise.resolve(json(project));
  });
  vi.stubGlobal('fetch', fetchMock);
  // Task list requests so far, e.g. "/api/projects/p/tasks?page=1&pageSize=20"
  const requests = () =>
    fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes('/tasks?'));
  return { requests };
}

function renderList(url = '/projects/p') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <TaskList projectId="p" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('TaskList', () => {
  it('lists the tasks with their assignee and sprint', async () => {
    fakeApi();
    renderList();

    expect(await screen.findByText('Fix login')).toBeInTheDocument();
    expect(screen.getByText('Tasks (2)')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Ann Lee').length).toBeGreaterThan(0));
    expect(screen.getByText('Backlog', { selector: 'td' })).toBeInTheDocument();
  });

  it('searches after a pause in typing, not on every key', async () => {
    const { requests } = fakeApi();
    const user = renderList();
    await screen.findByText('Fix login');

    await user.type(screen.getByLabelText('Search tasks'), 'login');

    await waitFor(() => expect(requests().at(-1)).toContain('q=login'));
    expect(requests().filter((url) => url.includes('q='))).toHaveLength(1);
  });

  it('filters on the server, and "All" removes a filter', async () => {
    const { requests } = fakeApi();
    const user = renderList();
    await screen.findByText('Fix login');

    await user.selectOptions(screen.getByLabelText('Status'), 'Done');
    await user.selectOptions(screen.getByLabelText('Priority'), 'High');
    await waitFor(() => expect(requests().at(-1)).toMatch(/status=done.*priority=high/));

    await user.selectOptions(screen.getByLabelText('Status'), 'All statuses');
    await waitFor(() => expect(requests().at(-1)).not.toContain('status='));
    expect(requests().at(-1)).toContain('priority=high');
  });

  it('clears the search with the cross in the bar', async () => {
    const { requests } = fakeApi();
    const user = renderList('/projects/p?q=login');
    await screen.findByText('Fix login');
    expect(screen.getByLabelText('Search tasks')).toHaveValue('login');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => expect(requests().at(-1)).not.toContain('q='));
    expect(screen.getByLabelText('Search tasks')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('starts from the filters in the URL', async () => {
    const { requests } = fakeApi();
    renderList('/projects/p?status=done&sprintId=backlog');

    await screen.findByText('Fix login');
    expect(requests()[0]).toContain('status=done');
    expect(requests()[0]).toContain('sprintId=backlog');
    expect(screen.getByLabelText('Sprint')).toHaveValue('backlog');
  });

  it('pages through the list', async () => {
    const { requests } = fakeApi(45);
    const user = renderList();

    expect(await screen.findByText('1–2 of 45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(requests().at(-1)).toContain('page=2'));
    expect(await screen.findByText('21–22 of 45')).toBeInTheDocument();
  });
});
