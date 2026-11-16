import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@ownsprint/shared';
import { boardKeys, useMoveTask } from './queries';
import { makeTask } from '@/test/factories';

const key = boardKeys.board('p', 's');
const ids = (client: QueryClient) => client.getQueryData<Task[]>(key)?.map((t) => t.id);

describe('useMoveTask', () => {
  it('moves the card at once and rolls back when the server says no', async () => {
    // The move request stays open until the test answers it.
    let answer: (res: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );

    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(key, [makeTask('A'), makeTask('B')]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMoveTask('p', 's'), { wrapper });

    act(() => result.current.mutate({ taskId: 'A', status: 'todo', afterId: 'B' }));
    await waitFor(() => expect(ids(client)).toEqual(['B', 'A'])); // before the server answers

    answer(
      new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'No' } }), {
        status: 400,
      }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ids(client)).toEqual(['A', 'B']);
  });
});
