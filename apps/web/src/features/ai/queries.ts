import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  summaryChunkSchema,
  summaryErrorSchema,
  type BreakdownSuggestion,
  type DescriptionSuggestion,
  type EstimateSuggestion,
  type SprintEstimates,
  type Task,
} from '@ownsprint/shared';
import { useRefreshTasks } from '@/features/tasks/queries';
import { api, apiStream } from '@/lib/api';
import { errorMessage } from '@/lib/forms';
import { readEvents } from './sse';

// Mutations, not queries: each call costs money and gives a new answer, so it
// only runs when the user clicks, never on mount, refocus or retry.

export function useBreakdown(projectId: string, taskId: string) {
  return useMutation({
    mutationFn: () =>
      api<BreakdownSuggestion>(`/projects/${projectId}/tasks/${taskId}/ai/breakdown`, {
        method: 'POST',
      }),
  });
}

export function useDescription(projectId: string, taskId: string) {
  return useMutation({
    mutationFn: () =>
      api<DescriptionSuggestion>(`/projects/${projectId}/tasks/${taskId}/ai/description`, {
        method: 'POST',
      }),
  });
}

export function useEstimate(projectId: string, taskId: string) {
  return useMutation({
    mutationFn: () =>
      api<EstimateSuggestion>(`/projects/${projectId}/tasks/${taskId}/ai/estimate`, {
        method: 'POST',
      }),
  });
}

// Suggested points for the sprint's tasks that have none (a mutation, like the others).
export function useSuggestEstimates(projectId: string, sprintId: string) {
  return useMutation({
    mutationFn: () =>
      api<SprintEstimates>(`/projects/${projectId}/sprints/${sprintId}/ai/estimates`, {
        method: 'POST',
      }),
  });
}

// Saves the estimates the user confirmed: one update per task, in parallel,
// and one refresh of the board when they are all done (or one has failed).
export function useApplyEstimates(projectId: string) {
  const refresh = useRefreshTasks(projectId);
  return useMutation({
    mutationFn: (items: { taskId: string; estimate: number }[]) =>
      Promise.all(
        items.map(({ taskId, estimate }) =>
          api<Task>(`/projects/${projectId}/tasks/${taskId}`, {
            method: 'PATCH',
            body: { estimate },
          }),
        ),
      ),
    onSettled: refresh,
  });
}

export interface SummaryState {
  status: 'idle' | 'streaming' | 'done' | 'error';
  text: string;
  error?: string;
}

// The streamed sprint summary. Plain state instead of TanStack Query: the text
// grows while the request is still open, and nothing here is worth caching.
export function useSprintSummary(projectId: string, sprintId: string) {
  const [state, setState] = useState<SummaryState>({ status: 'idle', text: '' });
  const request = useRef<AbortController | null>(null);

  // Leaving the page cancels the request, so the server stops paying for it.
  useEffect(() => () => request.current?.abort(), []);

  async function start() {
    request.current?.abort();
    const { signal } = (request.current = new AbortController());
    setState({ status: 'streaming', text: '' });

    try {
      const body = await apiStream(`/projects/${projectId}/sprints/${sprintId}/ai/summary`, {
        method: 'POST',
        signal,
      });
      let finished = false;
      for await (const { event, data } of readEvents(body)) {
        if (event === 'error') {
          throw new Error(summaryErrorSchema.parse(JSON.parse(data)).message);
        }
        if (event === 'done') finished = true;
        if (event === 'message') {
          const { text } = summaryChunkSchema.parse(JSON.parse(data));
          setState((s) => ({ ...s, text: s.text + text }));
        }
      }
      if (!finished) throw new Error('The connection was lost before the summary was finished.');
      setState((s) => ({ ...s, status: 'done' }));
    } catch (error) {
      if (signal.aborted) return; // stopped or replaced on purpose
      setState((s) => ({ ...s, status: 'error', error: errorMessage(error) }));
    }
  }

  // Keeps what has arrived so far.
  function stop() {
    request.current?.abort();
    setState((s) => ({ ...s, status: 'done' }));
  }

  function close() {
    request.current?.abort();
    setState({ status: 'idle', text: '' });
  }

  return { state, start, stop, close };
}
