import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@ownsprint/shared';
import { SettingsPage } from './SettingsPage';

const user: PublicUser = {
  id: 'u1',
  email: 'ann@example.com',
  firstName: 'Ann',
  lastName: 'Lee',
  name: 'Ann Lee',
  avatarColor: null,
  avatarEmoji: null,
  createdAt: '',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeApi(response: () => Response) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  // Requests sent so far: ["PATCH /api/auth/me", body]
  const calls = () =>
    fetchMock.mock.calls.map(
      ([url, init]) =>
        [`${init?.method ?? 'GET'} ${url}`, init?.body && JSON.parse(init.body as string)] as const,
    );
  return { calls };
}

function renderPage(session: PublicUser = user) {
  const client = new QueryClient();
  client.setQueryData(['session'], session);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, user: userEvent.setup() };
}

describe('SettingsPage', () => {
  it('saves the name and the chosen avatar, and updates the session', async () => {
    const saved = { ...user, firstName: 'Anna', name: 'Anna Lee', avatarEmoji: '🦊' };
    const { calls } = fakeApi(() => json({ user: saved }));
    const { client, user: u } = renderPage();

    await u.clear(screen.getByLabelText('First name'));
    await u.type(screen.getByLabelText('First name'), 'Anna');
    await u.click(screen.getByRole('button', { name: '🦊' }));
    await u.click(screen.getByRole('button', { name: 'Colour #a8c3a0' }));
    await u.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(calls()).toContainEqual([
        'PATCH /api/auth/me',
        { firstName: 'Anna', lastName: 'Lee', avatarColor: '#a8c3a0', avatarEmoji: '🦊' },
      ]),
    );
    await waitFor(() => expect(client.getQueryData(['session'])).toEqual(saved));
  });

  it('marks no colour on its own, and "Auto" goes back to automatic', async () => {
    const { calls } = fakeApi(() => json({ user }));
    const { user: u } = renderPage();

    // Nothing chosen yet: only "Auto" is marked.
    expect(screen.getByRole('button', { name: 'Automatic colour' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Colour #a8c3a0' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await u.click(screen.getByRole('button', { name: 'Colour #a8c3a0' }));
    expect(screen.getByRole('button', { name: 'Colour #a8c3a0' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await u.click(screen.getByRole('button', { name: 'Automatic colour' }));
    await u.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(calls()[0]?.[1]).toMatchObject({ avatarColor: null }));
  });

  it('can go back to initials', async () => {
    const { calls } = fakeApi(() => json({ user }));
    const { user: u } = renderPage();

    await u.click(screen.getByRole('button', { name: '🦊' }));
    await u.click(screen.getByRole('button', { name: 'Initials' }));
    await u.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(calls()[0]?.[1]).toMatchObject({ avatarColor: null, avatarEmoji: null }),
    );
  });

  it('shows a wrong password under the field', async () => {
    fakeApi(() =>
      json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: { body: { fieldErrors: { currentPassword: ['Wrong password'] } } },
          },
        },
        400,
      ),
    );
    const { user: u } = renderPage();

    await u.type(screen.getAllByLabelText('Current password')[0] as HTMLElement, 'nope');
    await u.click(screen.getByRole('button', { name: 'Change email' }));

    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
  });

  it('changes the password and clears the fields', async () => {
    const { calls } = fakeApi(() => new Response(null, { status: 204 }));
    const { user: u } = renderPage();

    await u.type(screen.getAllByLabelText('Current password')[1] as HTMLElement, 'old-password');
    await u.type(screen.getByLabelText('New password'), 'a-brand-new-password');
    await u.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(calls()).toContainEqual([
      'PATCH /api/auth/me/password',
      { currentPassword: 'old-password', newPassword: 'a-brand-new-password' },
    ]);
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it('hides email and password for a demo account', () => {
    renderPage({ ...user, email: 'abc@demo.ownsprint.dev' });

    expect(screen.getByText(/private demo account/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
  });

  it('does not send a too short new password', async () => {
    const { calls } = fakeApi(() => new Response(null, { status: 204 }));
    const { user: u } = renderPage();

    await u.type(screen.getAllByLabelText('Current password')[1] as HTMLElement, 'old-password');
    await u.type(screen.getByLabelText('New password'), 'short');
    await u.click(screen.getByRole('button', { name: 'Change password' }));

    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    expect(calls()).toEqual([]);
  });
});
