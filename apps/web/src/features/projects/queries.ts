import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddMemberInput,
  ProjectDetail,
  ProjectListResponse,
  ProjectMember,
  ProjectNameInput,
  ProjectSummary,
  UpdateMemberInput,
} from '@ownsprint/shared';
import { api } from '@/lib/api';

export const projectKeys = {
  all: ['projects'] as const,
  detail: (projectId: string) => ['projects', projectId] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () => (await api<ProjectListResponse>('/projects')).projects,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => api<ProjectDetail>(`/projects/${projectId}`),
  });
}

// Member changes show up in the project (members box, assignee lists), and
// removing someone also unassigns their tasks, so the boards are refreshed too.
export function useAddMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) =>
      api<ProjectMember>(`/projects/${projectId}/members`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useSetMemberTitle(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: UpdateMemberInput & { userId: string }) =>
      api<ProjectMember>(`/projects/${projectId}/members/${userId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
    // The detail key is a prefix of the boards' and tasks' keys, so this refreshes all.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectNameInput) =>
      api<ProjectSummary>('/projects', { method: 'POST', body: input }),
    // Refetch the list so the new project shows up.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

// Owner only. The name shows on this page and in the project list.
export function useRenameProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectNameInput) =>
      api<ProjectSummary>(`/projects/${projectId}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
