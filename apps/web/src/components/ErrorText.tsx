import { useEffect, useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  persistent?: boolean; // stays: for a page that failed to load
  children?: ReactNode;
}

const VISIBLE_MS = 5000;

// An error notice: ink-red border, tinted fill, warning icon. Renders nothing
// when there's no error. Screen readers announce it when it appears.
// A message fades out after 5 s; when it comes back, it shows again.
export function ErrorText({ id, persistent, children }: Props) {
  const [expired, setExpired] = useState<ReactNode>(null);
  const fades = !persistent && typeof children === 'string';

  useEffect(() => {
    if (!fades || !children) return;
    const timer = setTimeout(() => setExpired(children), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [fades, children]);

  // The same text again after it went away (e.g. a second failed submit) is a
  // new error, so forget the expired one once the message is cleared.
  if (!children && expired) setExpired(null);
  if (!children || (fades && expired === children)) return null;

  return (
    <p
      id={id}
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-sm border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive',
        // Fully visible for 4 s, then fades out over the last second.
        fades && 'animate-out fill-mode-forwards fade-out duration-1000 [animation-delay:4s]',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} aria-hidden />
      {children}
    </p>
  );
}
