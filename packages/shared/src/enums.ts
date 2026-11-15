import { z } from 'zod';

// These must stay in sync with the enums in apps/api/prisma/schema.prisma.

export const roleSchema = z.enum(['owner', 'member']);
export type Role = z.infer<typeof roleSchema>;

export const sprintStatusSchema = z.enum(['planned', 'active', 'completed']);
export type SprintStatus = z.infer<typeof sprintStatusSchema>;

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const prioritySchema = z.enum(['low', 'medium', 'high']);
export type Priority = z.infer<typeof prioritySchema>;
