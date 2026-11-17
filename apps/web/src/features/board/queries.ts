import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BoardResponse,
  BoardTask,
  CompleteSprintInput,
  CreateSprintInput,
  CreateTaskInput,
  Sprint,
  SprintListResponse,
  Task,
} from '@ownsprint/shared';
import { api } from '@/lib/api';
import { applyMove, type Move } from './reorder';

export const boardKeys = {
  sprints: (projectId: string) => ['projects', projectId, 'sprints'] as const,
  board: (projectId: string, sprintId: string) =>
    ['projects', projectId, 'board', sprintId] as const,
};

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: boardKeys.sprints(projectId),
    queryFn: async () => (await api<SprintListResponse>(`/projects/${projectId}/sprints`)).sprints,
  });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSprintInput) =>
      api<Sprint>(`/projects/${projectId}/sprints`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKeys.sprints(projectId) }),
  });
}

// Starting or completing changes the sprint, and completing moves tasks
// between boards, so the sprints and all the boards of the project reload.
function useSprintAction<T = void>(
  projectId: string,
  sprintId: string,
  action: 'start' | 'complete',
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: T) =>
      api<Sprint>(`/projects/${projectId}/sprints/${sprintId}/${action}`, {
        method: 'POST',
        body,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: boardKeys.sprints(projectId) }),
        queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'board'] }),
      ]),
  });
}

export const useStartSprint = (projectId: string, sprintId: string) =>
  useSprintAction(projectId, sprintId, 'start');

export const useCompleteSprint = (projectId: string, sprintId: string) =>
  useSprintAction<CompleteSprintInput>(projectId, sprintId, 'complete');

export function useBoard(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: boardKeys.board(projectId, sprintId),
    queryFn: async () =>
      (await api<BoardResponse>(`/projects/${projectId}/sprints/${sprintId}/board`)).tasks,
  });
}

export function useCreateTask(projectId: string, sprintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      api<Task>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: { ...input, sprintId },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: boardKeys.board(projectId, sprintId) }),
  });
}

// Optimistic: the card moves in the cache at once, goes back if the server
// says no, and the board is refetched to pick up the real positions.
export function useMoveTask(projectId: string, sprintId: string) {
  const queryClient = useQueryClient();
  const queryKey = boardKeys.board(projectId, sprintId);
  const mutationKey = ['moveTask', ...queryKey];

  return useMutation({
    mutationKey,
    mutationFn: ({ taskId, ...body }: Move) =>
      api<Task>(`/projects/${projectId}/tasks/${taskId}/move`, { method: 'POST', body }),
    onMutate: async (move) => {
      // Stop a refetch in flight from overwriting the optimistic state.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardTask[]>(queryKey);
      queryClient.setQueryData<BoardTask[]>(queryKey, (tasks) => tasks && applyMove(tasks, move));
      return { previous };
    },
    onError: (_error, _move, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    // Only after the last move in flight: an earlier refetch could return
    // before a later move is saved and make that card jump back for a moment.
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        await queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
