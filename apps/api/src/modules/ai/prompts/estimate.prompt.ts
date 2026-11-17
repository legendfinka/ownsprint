import type { TaskDetail } from '@ownsprint/shared';
import { JSON_ONLY, taskContext } from './task-context';

const system = `You are a senior software engineer estimating work for a sprint.
- Estimate the whole task in story points: 1, 2, 3, 5, 8 or 13. Points measure
  effort, complexity and uncertainty together, not hours.
- Suggest a priority: "low", "medium" or "high", based on impact and urgency.
- Explain both in one plain sentence (under 120 characters).
${JSON_ONLY}
Shape: {"estimate":5,"priority":"medium","rationale":"..."}`;

export function estimatePrompt(task: TaskDetail) {
  return { task: 'estimate' as const, system, prompt: taskContext(task), maxTokens: 150 };
}
