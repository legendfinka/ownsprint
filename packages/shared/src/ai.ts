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
