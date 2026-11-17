import { AVATAR_COLORS } from '@ownsprint/shared';

// Without a chosen colour, the name picks one of the same muted swatches the
// settings page offers. The same name always gets the same colour.
export function defaultAvatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}
