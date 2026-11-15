import { z } from 'zod';
import { emailSchema } from './auth';
import type { Role } from './enums';

export const projectNameSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type ProjectNameInput = z.infer<typeof projectNameSchema>;

export const addMemberSchema = z.object({ email: emailSchema });
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const projectParamsSchema = z.object({ projectId: z.uuid() });
export const memberParamsSchema = projectParamsSchema.extend({ userId: z.uuid() });

export interface ProjectSummary {
  id: string;
  name: string;
  role: Role; // the current user's role in this project
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ProjectDetail extends ProjectSummary {
  members: ProjectMember[];
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}
