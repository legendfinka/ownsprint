import { z } from 'zod';
import { prioritySchema } from './enums';

// The usual planning-poker scale: relative effort, not hours.
export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;
const storyPoints = z.literal(STORY_POINTS);

// What the AI must answer for "Break down task". Anything else is rejected.
export const breakdownSuggestionSchema = z.object({
  subtasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        priority: prioritySchema,
        estimate: storyPoints,
      }),
    )
    .min(2)
    .max(8),
});
export type BreakdownSuggestion = z.infer<typeof breakdownSuggestionSchema>;

// What the AI must answer for "Suggest estimate".
export const estimateSuggestionSchema = z.object({
  estimate: storyPoints,
  priority: prioritySchema,
  rationale: z.string().trim().min(1).max(300),
});
export type EstimateSuggestion = z.infer<typeof estimateSuggestionSchema>;

// What the AI must answer for "Write description".
export const descriptionSuggestionSchema = z.object({
  description: z.string().trim().min(1).max(2000),
});
export type DescriptionSuggestion = z.infer<typeof descriptionSuggestionSchema>;

// "Estimate the rest": suggested points for the sprint's tasks that have none.
// One request covers up to this many tasks; `remaining` counts the others.
export const MAX_BULK_ESTIMATES = 15;

export const sprintEstimatesSchema = z.object({
  suggestions: z.array(
    z.object({
      taskId: z.uuid(),
      estimate: storyPoints,
      rationale: z.string().trim().min(1).max(200).optional(), // the model may skip it
    }),
  ),
  remaining: z.number().int().min(0),
});
export type SprintEstimates = z.infer<typeof sprintEstimatesSchema>;

// The sprint summary is streamed as server-sent events: a default event with
// the next piece of text, then `done`, or `error` if it breaks half-way.
export const summaryChunkSchema = z.object({ text: z.string() });
export type SummaryChunk = z.infer<typeof summaryChunkSchema>;

export const summaryErrorSchema = z.object({ message: z.string() });
export type SummaryError = z.infer<typeof summaryErrorSchema>;
