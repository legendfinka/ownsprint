import type { Avatar as AvatarChoice } from '@ownsprint/shared';
import { cn } from '@/lib/utils';

// Muted vintage tones. Dark ink text reads well on all of them, in both themes.
const colors = ['bg-[#e8c468]', 'bg-[#a8c3a0]', 'bg-[#9db4d6]', 'bg-[#e2a48a]', 'bg-[#c4b2d6]'];

// The same name always gets the same color.
function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length] ?? '';
}

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
      style={avatarColor ? { backgroundColor: avatarColor } : undefined}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-sm border-2 border-foreground font-heading text-xs font-bold text-[#2b2522]',
        !avatarColor && colorFor(name),
        className,
      )}
    >
      {avatarEmoji ?? initials(name)}
    </span>
  );
}
