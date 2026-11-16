import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from './session';

// Lets a route through only for logged-in users ("user") or only for
// logged-out ones ("guest", e.g. the login page). Others are redirected.
export function AuthGate({ allow }: { allow: 'user' | 'guest' }) {
  const { data: user, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;

  if (allow === 'user' && !user) {
    // Remember the page, so login can send the user back to it.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (allow === 'guest' && user) return <Navigate to="/projects" replace />;

  return <Outlet />;
}
