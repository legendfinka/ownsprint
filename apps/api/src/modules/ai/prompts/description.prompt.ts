import type { TaskDetail } from '@ownsprint/shared';
import { JSON_ONLY, taskContext } from './task-context';

const system = `You are a senior software engineer writing a task description for a
team's sprint board.
- Start with one or two sentences on what to do and why.
- Then a line "Done when:" followed by 2 to 4 checks, one per line, each starting with "- ".
- Plain text, no headings or other markdown. Under 600 characters.
- If the task already has a description, improve it and keep its facts.
- Don't invent technical details the title doesn't suggest.
${JSON_ONLY}
Shape: {"description":"..."} (use \\n for line breaks inside the string)`;

export function descriptionPrompt(task: TaskDetail) {
  return { task: 'description' as const, system, prompt: taskContext(task), maxTokens: 400 };
}
