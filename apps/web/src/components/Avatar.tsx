import type { Avatar as AvatarChoice } from '@ownsprint/shared';
import { defaultAvatarColor } from '@/lib/avatar';
import { cn } from '@/lib/utils';

// "Ann Lee" → "AL", "oleh_liubichenko" → "OL", "Ann" → "AN".
function initials(name: string): string {
  const words = name.split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '?');
  return letters.slice(0, 2).toUpperCase();
}

interface Props extends Partial<AvatarChoice> {
  name: string;
  className?: string;
}

// An emoji or the initials in a small ink-bordered square. Serif, so "O" never
// looks like "0". Without a chosen colour, one is picked from the name.
export function Avatar({ name, avatarColor, avatarEmoji, className }: Props) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: avatarColor ?? defaultAvatarColor(name) }}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-sm border-2 border-foreground font-heading text-xs font-bold text-[#2b2522]',
        className,
      )}
    >
      {avatarEmoji ?? initials(name)}
    </span>
  );
}
