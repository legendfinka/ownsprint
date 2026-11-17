import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_ACCOUNT } from '@ownsprint/shared';
import { LoginPage } from './LoginPage';

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<p>Projects page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

// Every fetch answers with this response.
function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('LoginPage', () => {
  it('shows field errors without calling the API', async () => {
    const fetchMock = mockFetch({});
    const user = renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs in and opens the projects page', async () => {
    const fetchMock = mockFetch({
      user: { id: '1', email: 'ann@example.com', name: 'Ann', createdAt: '2026-11-16' },
      accessToken: 'token',
    });
    const user = renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'ann@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Projects page')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.anything());
  });

  it('signs in to the demo account with one click', async () => {
    const fetchMock = mockFetch({
      user: { id: '1', email: DEMO_ACCOUNT.email, name: 'Demo User', createdAt: '2026-11-16' },
      accessToken: 'token',
    });
    const user = renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Try demo account' }));

    expect(await screen.findByText('Projects page')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        body: JSON.stringify({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password }),
      }),
    );
  });

  it('says so when the demo account cannot be reached', async () => {
    mockFetch({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, 401);
    const user = renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Try demo account' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('shows the server message for wrong credentials', async () => {
    mockFetch({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, 401);
    const user = renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'ann@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});
