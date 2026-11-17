import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDetail } from '@ownsprint/shared';
import { ProjectTitle } from './ProjectTitle';

const project = (role: 'owner' | 'member'): ProjectDetail => ({
  id: 'p',
  name: 'Website',
  role,
  createdAt: '',
  members: [],
});

function renderTitle(role: 'owner' | 'member') {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify({ id: 'p', name: 'Shop', role })))
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProjectTitle project={project(role)} />
    </QueryClientProvider>,
  );
  return { fetchMock, user: userEvent.setup() };
}

describe('ProjectTitle', () => {
  it('lets the owner rename the project', async () => {
    const { fetchMock, user } = renderTitle('owner');

    await user.click(screen.getByRole('button', { name: 'Rename project' }));
    const field = screen.getByLabelText('Project name');
    await user.clear(field);
    await user.type(field, 'Shop{Enter}');

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/p',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Shop' }) }),
      ),
    );
  });

  it('cancels with Escape, without saving', async () => {
    const { fetchMock, user } = renderTitle('owner');

    await user.click(screen.getByRole('button', { name: 'Rename project' }));
    await user.type(screen.getByLabelText('Project name'), ' 2{Escape}');

    expect(screen.getByRole('heading', { name: 'Website' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows members the name only', () => {
    renderTitle('member');

    expect(screen.queryByRole('button', { name: 'Rename project' })).toBeNull();
  });
});
