import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  MeResponse,
  UpdateProfileInput,
} from '@ownsprint/shared';
import { sessionKey } from '@/features/auth/session';
import { projectKeys } from '@/features/projects/queries';
import { api } from '@/lib/api';

// The server answers with the updated user, which replaces the cached session.
function useSaveUser<T>(path: string, afterSave?: () => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => api<MeResponse>(path, { method: 'PATCH', body: input }),
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(sessionKey, user);
      await afterSave?.();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  // Teammates see the new name and avatar in the members list.
  return useSaveUser<UpdateProfileInput>('/auth/me', () =>
    queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  );
}

export function useChangeEmail() {
  return useSaveUser<ChangeEmailInput>('/auth/me/email');
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api<void>('/auth/me/password', { method: 'PATCH', body: input }),
  });
}
