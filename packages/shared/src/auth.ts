import { z } from 'zod';

// Trim and lowercase first, so " Bob@Mail.com" and "bob@mail.com" are one account.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128), // max stops huge inputs to the password hasher
  name: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
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
