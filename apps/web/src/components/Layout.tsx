import { Link, Outlet } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/features/auth/session';

// Header + page content + footer for logged-in pages.
export function Layout() {
  const { data: user } = useSession();
  const logout = useLogout();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/projects" aria-label="OwnSprint home">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user && (
              <>
                <Avatar name={user.name} className="size-7" />
                <span className="hidden font-medium sm:inline">{user.name}</span>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-6 font-mono text-xs text-muted-foreground">
        © {new Date().getFullYear()} OwnSprint · a small sprint tracker ✦ best viewed
        in any browser
      </footer>
    </div>
  );
}
