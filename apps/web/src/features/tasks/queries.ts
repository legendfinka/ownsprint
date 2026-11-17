import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTaskInput, Task, TaskDetail, UpdateTaskInput } from '@ownsprint/shared';
import { useSearchParams } from 'react-router';
import { api } from '@/lib/api';

const taskKey = (projectId: string, taskId: string) =>
  ['projects', projectId, 'tasks', taskId] as const;

// The open task lives in the URL (?task=…), so it survives a reload and can be shared.
export function useTaskParam() {
  const [params, setParams] = useSearchParams();
  const openTask = (taskId: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (taskId) next.set('task', taskId);
      else next.delete('task');
      return next;
    });
  return [params.get('task'), openTask] as const;
}

export function useTask(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskKey(projectId, taskId),
    queryFn: () => api<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`),
  });
}

// A task change can show up on any board and in any open task (its parent's
// subtask list), so refetch both.
function useRefreshTasks(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'board'] }),
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
    ]);
}

export function useUpdateTask(projectId: string) {
  const refresh = useRefreshTasks(projectId);
  return useMutation({
    mutationFn: ({ taskId, ...input }: UpdateTaskInput & { taskId: string }) =>
      api<Task>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: input }),
    onSuccess: refresh,
  });
}

export function useCreateSubtask(projectId: string, parent: Task) {
  const refresh = useRefreshTasks(projectId);
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      api<Task>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: { ...input, parentId: parent.id, sprintId: parent.sprintId },
      }),
    onSuccess: refresh,
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshTasks(projectId);
  return useMutation({
    mutationFn: (taskId: string) =>
      api<void>(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: (_data, taskId) => {
      // Drop it first, or the refresh below would refetch a deleted task (404).
      queryClient.removeQueries({ queryKey: taskKey(projectId, taskId) });
      return refresh();
    },
  });
}
