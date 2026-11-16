import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AuthResponse,
  LoginInput,
  MeResponse,
  PublicUser,
  RegisterInput,
} from '@ownsprint/shared';
import { api, refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '@/lib/api';

const sessionKey = ['session'] as const;

// The logged-in user, or null. After a page reload the access token is gone
// (it lived in memory), so first get a new one with the refresh cookie.
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async (): Promise<PublicUser | null> => {
      if (!(await refreshAccessToken())) return null;
      return (await api<MeResponse>('/auth/me')).user;
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useLogin() {
  return useStartSession((input: LoginInput) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  );
}

export function useRegister() {
  return useStartSession((input: RegisterInput) =>
    api<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  );
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    // Log out locally even if the request failed.
    onSettled: () => {
      setAccessToken(null);
      queryClient.clear(); // drop every cached response of this user
      queryClient.setQueryData(sessionKey, null);
    },
  });
}

// When the refresh cookie stops working mid-session, show the login page.
export function watchSessionExpiry(queryClient: QueryClient): void {
  setSessionExpiredHandler(() => queryClient.setQueryData(sessionKey, null));
}

function useStartSession<T>(request: (input: T) => Promise<AuthResponse>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: ({ user, accessToken }) => {
      setAccessToken(accessToken);
      queryClient.setQueryData(sessionKey, user);
    },
  });
}
