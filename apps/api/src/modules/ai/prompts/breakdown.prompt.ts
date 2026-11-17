import type { TaskDetail } from '@ownsprint/shared';
import { JSON_ONLY, taskContext } from './task-context';

const system = `You are a senior software engineer helping a team plan a sprint.
Write the complete list of 2 to 8 concrete subtasks that together finish the task.
Your list replaces the existing subtasks: keep the useful ones (reworded if needed),
merge or drop the rest.
- Each title is short and starts with a verb, e.g. "Add login form validation".
- Priority per subtask: "high" if other subtasks depend on it or it carries the most
  risk, "low" for nice-to-haves, otherwise "medium". Don't give them all the same one
  unless they really are equal.
- Estimate each subtask in story points: 1, 2, 3, 5, 8 or 13 (relative effort, not hours).
${JSON_ONLY}
Shape: {"subtasks":[{"title":"...","priority":"medium","estimate":3}]}`;

export function breakdownPrompt(task: TaskDetail) {
  return { task: 'breakdown' as const, system, prompt: taskContext(task) };
}
