import { z } from 'zod';

// Trim and lowercase first, so " Bob@Mail.com" and "bob@mail.com" are one account.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254, 'Email is too long'));

// max stops huge inputs to the password hasher
const newPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password is too long');
const currentPasswordSchema = z.string().min(1, 'Enter your password').max(128);

// The last name may be empty: accounts from before the split have none.
const firstNameSchema = z
  .string()
  .trim()
  .min(1, 'First name is required')
  .max(100, 'First name is too long');
const lastNameSchema = z.string().trim().max(100, 'Last name is too long');

// Avatar: a colour and an optional emoji (initials show without one).
// Fixed lists, so nothing odd gets stored and every client can draw it.
export const AVATAR_COLORS = ['#e8c468', '#a8c3a0', '#9db4d6', '#e2a48a', '#c4b2d6'] as const;
export const AVATAR_EMOJIS = [
  '😀',
  '😎',
  '🤓',
  '🥳',
  '🤠',
  '🦊',
  '🐼',
  '🐸',
  '🐙',
  '🦄',
  '🐢',
  '🦉',
  '🚀',
  '⚡',
  '🔥',
  '🌈',
  '🌵',
  '🍕',
  '☕',
  '🎸',
  '🎮',
  '📚',
  '💡',
  '🧠',
] as const;

export const registerSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  avatarColor: z.enum(AVATAR_COLORS).nullable(),
  avatarEmoji: z.enum(AVATAR_EMOJIS).nullable(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Changing the email or the password asks for the current password again.
export const changeEmailSchema = z.object({
  email: emailSchema,
  currentPassword: currentPasswordSchema,
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const changePasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// "Ann" + "Lee" → "Ann Lee"; without a last name → "Ann".
export function fullName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ');
}

export interface Avatar {
  avatarColor: (typeof AVATAR_COLORS)[number] | null;
  avatarEmoji: (typeof AVATAR_EMOJIS)[number] | null;
}

export interface PublicUser extends Avatar {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string; // full name, ready to show
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface MeResponse {
  user: PublicUser;
}
