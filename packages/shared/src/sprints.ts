import { z } from 'zod';
import type { SprintStatus } from './enums';
import { projectParamsSchema } from './projects';

export const sprintParamsSchema = projectParamsSchema.extend({ sprintId: z.uuid() });

export const createSprintSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  startDate: z.iso.date('Pick a start date'), // "2026-11-16"
  endDate: z.iso.date('Pick an end date'),
});
export type CreateSprintInput = z.infer<typeof createSprintSchema>;

// The status changes only through start and complete.
export const updateSprintSchema = createSprintSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Nothing to update');
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;

// Where the unfinished tasks go: a planned sprint, or the backlog (null).
export const completeSprintSchema = z.object({ moveTo: z.uuid().nullable() });
export type CompleteSprintInput = z.infer<typeof completeSprintSchema>;

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
