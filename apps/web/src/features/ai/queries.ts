import { useMutation } from '@tanstack/react-query';
import type {
  BreakdownSuggestion,
  DescriptionSuggestion,
  EstimateSuggestion,
} from '@ownsprint/shared';
import { api } from '@/lib/api';

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
