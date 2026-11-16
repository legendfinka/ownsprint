import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ProjectDetail,
  ProjectListResponse,
  ProjectNameInput,
  ProjectSummary,
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

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectNameInput) =>
      api<ProjectSummary>('/projects', { method: 'POST', body: input }),
    // Refetch the list so the new project shows up.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
