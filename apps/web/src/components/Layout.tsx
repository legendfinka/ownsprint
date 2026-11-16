import { Link, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/features/auth/session';

// Header + page content for logged-in pages.
export function Layout() {
  const { data: user } = useSession();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/projects" className="font-semibold">
            OwnSprint
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
