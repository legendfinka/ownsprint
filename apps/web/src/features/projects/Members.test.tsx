import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDetail } from '@ownsprint/shared';
import { Members } from './Members';

const person = { avatarColor: null, avatarEmoji: null };

const project = (role: 'owner' | 'member'): ProjectDetail => ({
  id: 'p',
  name: 'Website',
  role,
  createdAt: '',
  members: [
    {
      ...person,
      id: 'u1',
      name: 'Olivia Owner',
      email: 'o@x.com',
      role: 'owner',
      title: 'Developer',
    },
    { ...person, id: 'u2', name: 'Mark Member', email: 'm@x.com', role: 'member', title: null },
  ],
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeApi(response: () => Response = () => json({})) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  // Calls sent so far: ["POST /api/projects/p/members", body]
  const calls = () =>
    fetchMock.mock.calls.map(
      ([url, init]) =>
        [`${init?.method ?? 'GET'} ${url}`, init?.body && JSON.parse(init.body as string)] as const,
    );
  return { calls };
}

function renderMembers(role: 'owner' | 'member') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Members project={project(role)} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('Members', () => {
  it('lets the owner set a title, saved when leaving the field', async () => {
    const { calls } = fakeApi();
    const user = renderMembers('owner');

    await user.type(screen.getByLabelText('Title of Mark Member'), 'Tester');
    expect(calls()).toEqual([]); // not saved while typing
    await user.tab();

    await waitFor(() =>
      expect(calls()).toContainEqual(['PATCH /api/projects/p/members/u2', { title: 'Tester' }]),
    );
  });

  it('adds a member by email and shows why it failed', async () => {
    const { calls } = fakeApi(() =>
      json({ error: { code: 'NOT_FOUND', message: 'No user with this email' } }, 404),
    );
    const user = renderMembers('owner');

    await user.type(screen.getByLabelText('Member email'), 'nobody@x.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('No user with this email')).toBeInTheDocument();
    expect(calls()[0]).toEqual(['POST /api/projects/p/members', { email: 'nobody@x.com' }]);
  });

  it('asks before removing a member', async () => {
    const { calls } = fakeApi();
    const user = renderMembers('owner');

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Mark Member?' });
    expect(calls()).toEqual([]); // nothing sent before confirming
    await user.click(within(confirm).getByRole('button', { name: 'Remove member' }));

    await waitFor(() =>
      expect(calls()).toContainEqual(['DELETE /api/projects/p/members/u2', undefined]),
    );
  });

  it('never offers to remove the owner', () => {
    renderMembers('owner');

    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
  });

  it('shows members only the titles, and no controls', () => {
    renderMembers('member');

    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.queryByLabelText('Member email')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByLabelText('Title of Mark Member')).toBeNull();
  });
});
