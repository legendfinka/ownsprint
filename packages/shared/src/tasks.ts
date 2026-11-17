import { z } from 'zod';
import { prioritySchema, taskStatusSchema, type Priority, type TaskStatus } from './enums';
import { projectParamsSchema } from './projects';

export const taskParamsSchema = projectParamsSchema.extend({ taskId: z.uuid() });

const title = z.string().trim().min(1, 'Title is required').max(200, 'Title is too long');
const description = z.string().max(5000, 'Description is too long');
// story points
const estimate = z
  .number('Enter a number')
  .int('Use a whole number')
  .min(0, 'Cannot be negative')
  .max(100, 'Use 100 points or fewer');

export const createTaskSchema = z.object({
  title,
  description: description.default(''),
  priority: prioritySchema.default('medium'),
  estimate: estimate.nullable().default(null),
  assigneeId: z.uuid().nullable().default(null),
  sprintId: z.uuid().nullable().default(null), // null = backlog
  parentId: z.uuid().nullable().default(null),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// `null` clears a field (e.g. unassign), a missing field stays unchanged.
export const updateTaskSchema = z
  .object({
    title,
    description,
    status: taskStatusSchema,
    priority: prioritySchema,
    estimate: estimate.nullable(),
    assigneeId: z.uuid().nullable(),
    sprintId: z.uuid().nullable(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Nothing to update');
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// Saving several subtasks at once (e.g. the AI breakdown the user confirmed).
// replace: true deletes the task's current subtasks first, in the same transaction.
export const createSubtasksSchema = z.object({
  subtasks: z
    .array(
      z.object({
        title,
        priority: prioritySchema.default('medium'),
        estimate: estimate.nullable().default(null),
      }),
    )
    .min(1)
    .max(20),
  replace: z.boolean().default(false),
});
export type CreateSubtasksInput = z.infer<typeof createSubtasksSchema>;

export interface SubtaskListResponse {
  subtasks: Task[];
}

// Drag-and-drop on the board: the target column and the card to land below
// (null = top of the column). The server works out the position itself.
export const moveTaskSchema = z.object({
  status: taskStatusSchema,
  afterId: z.uuid().nullable(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const taskQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  assigneeId: z.uuid().optional(),
  sprintId: z.union([z.uuid(), z.literal('backlog')]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type TaskQuery = z.infer<typeof taskQuerySchema>;

export interface Task {
  id: string;
  projectId: string;
  sprintId: string | null;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  estimate: number | null;
  assigneeId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetail extends Task {
  subtasks: Task[];
}

// A board card: the task plus how far along its subtasks are.
export interface BoardTask extends Task {
  subtaskCount: { done: number; total: number };
}

// All top-level tasks of one sprint, sorted by position.
export interface BoardResponse {
  tasks: BoardTask[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
