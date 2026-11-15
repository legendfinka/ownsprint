import { z } from 'zod';
import { sprintStatusSchema, type SprintStatus } from './enums';
import { projectParamsSchema } from './projects';

export const sprintParamsSchema = projectParamsSchema.extend({ sprintId: z.uuid() });

export const createSprintSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: z.iso.date(), // "2026-11-16"
  endDate: z.iso.date(),
});
export type CreateSprintInput = z.infer<typeof createSprintSchema>;

export const updateSprintSchema = createSprintSchema
  .partial()
  .extend({ status: sprintStatusSchema.optional() })
  .refine((input) => Object.keys(input).length > 0, 'Nothing to update');
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
}

export interface SprintListResponse {
  sprints: Sprint[];
}
