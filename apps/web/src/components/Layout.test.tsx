import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthGate } from '@/features/auth/guards';
import { Layout } from './Layout';

describe('Layout', () => {
  it('opens the login page as soon as you log out', async () => {
    // The logout request never answers: the app must not wait for it.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const client = new QueryClient();
    client.setQueryData(['session'], { id: '1', name: 'Ann', email: 'ann@example.com' });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/projects']}>
          <Routes>
            <Route element={<AuthGate allow="user" />}>
              <Route element={<Layout />}>
                <Route path="/projects" element={<p>Projects page</p>} />
              </Route>
            </Route>
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
