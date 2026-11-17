import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  BoardTask,
  CreateSubtasksInput,
  CreateTaskInput,
  Page,
  SubtaskListResponse,
  Task,
  TaskDetail,
  TaskQuery,
  UpdateTaskInput,
} from '@ownsprint/shared';
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

// One page of the project's tasks, filtered on the server. The previous page
// stays on screen while the next one loads, so the list doesn't flash empty.
export function useTasks(projectId: string, query: TaskQuery) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, String(value));
  }
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', 'list', query],
    queryFn: () => api<Page<Task>>(`/projects/${projectId}/tasks?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: taskKey(projectId, taskId),
    queryFn: () => api<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`),
    // Shown at once instead of "Loading…", until the full task arrives.
    placeholderData: () => cachedTask(queryClient, projectId, taskId),
  });
}

// A task as already seen on screen, before its subtasks are loaded.
export interface TaskPreview extends TaskDetail {
  expectedSubtasks: number; // from the board card's "2/5", else 0
}

// The task from a board card, a task list row, or the subtask list of an
// open task, whichever is cached. Undefined when it isn't on screen anywhere.
function cachedTask(
  queryClient: QueryClient,
  projectId: string,
  taskId: string,
): TaskPreview | undefined {
  for (const [key, data] of queryClient.getQueriesData({ queryKey: ['projects', projectId] })) {
    if (!data) continue;
    // The cache key says what the data is (see the hooks that fill it).
    let tasks: (Task | BoardTask)[] = [];
    if (key[2] === 'board') tasks = data as BoardTask[];
    else if (key[2] === 'tasks' && key[3] === 'list') tasks = (data as Page<Task>).items;
    else if (key[2] === 'tasks') tasks = (data as TaskDetail).subtasks;

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const expectedSubtasks = 'subtaskCount' in task ? task.subtaskCount.total : 0;
      return { ...task, subtasks: [], expectedSubtasks };
    }
  }
  return undefined;
}

// A task change can show up on any board and in any open task (its parent's
// subtask list), so refetch both.
export function useRefreshTasks(projectId: string) {
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

// Several subtasks in one request (an AI breakdown the user confirmed).
export function useCreateSubtasks(projectId: string, taskId: string) {
  const refresh = useRefreshTasks(projectId);
  return useMutation({
    mutationFn: (input: CreateSubtasksInput) =>
      api<SubtaskListResponse>(`/projects/${projectId}/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: input,
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
