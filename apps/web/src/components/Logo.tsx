import { Zap } from 'lucide-react';

// A stamped badge + serif wordmark. Used in the header and on the auth pages.
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-sm border-2 border-foreground bg-accent text-accent-foreground shadow-hard-sm">
        <Zap className="size-4" fill="currentColor" aria-hidden />
      </span>
      <span className="font-heading text-xl font-bold italic">OwnSprint</span>
    </span>
  );
}
