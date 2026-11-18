import { z } from 'zod';
import { emailSchema, type Avatar } from './auth';
import type { Role } from './enums';

export const projectNameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
});
export type ProjectNameInput = z.infer<typeof projectNameSchema>;

export const addMemberSchema = z.object({ email: emailSchema });
export type AddMemberInput = z.infer<typeof addMemberSchema>;

// A member's label on the team. Suggestions for the UI; any text up to 40
// characters is allowed, and empty clears it. It never changes permissions.
export const MEMBER_TITLES = ['Developer', 'Designer', 'Tester', 'Product', 'Manager'] as const;
export const updateMemberSchema = z.object({
  title: z.string().trim().max(40, 'Title is too long'),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const projectParamsSchema = z.object({ projectId: z.uuid() });
export const memberParamsSchema = projectParamsSchema.extend({ userId: z.uuid() });

export interface ProjectSummary {
  id: string;
  name: string;
  role: Role; // the current user's role in this project
  createdAt: string;
}

export interface ProjectMember extends Avatar {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  members: ProjectMember[];
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}
