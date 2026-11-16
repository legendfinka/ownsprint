import type { ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Window } from '@/components/Window';

interface Props {
  title: string;
  description: string;
  children: ReactNode;
}

// The centered window shared by the login and register pages.
export function AuthCard({ title, description, children }: Props) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Window
        icon={KeyRound}
        title={title}
        bar="bg-primary text-primary-foreground"
        className="w-full max-w-sm"
      >
        <div className="grid gap-4 p-5">
          <p className="text-sm text-muted-foreground">{description}</p>
          {children}
        </div>
      </Window>
    </main>
  );
}
