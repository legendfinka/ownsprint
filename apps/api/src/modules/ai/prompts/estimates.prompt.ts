import { z } from 'zod';
import { STORY_POINTS, type BoardTask, type Sprint } from '@ownsprint/shared';
import { JSON_ONLY } from './task-context';

// What the model answers. Tasks are numbered 1, 2, 3… in the prompt and the
// model answers with those numbers: short numbers are copied far more reliably
// than ids, and cost fewer tokens. The service turns them back into ids.
// Strict on the points (they get saved), lenient on the reason (only a hint):
// small local models often leave it out, and that must not sink the answer.
export const estimatesAnswerSchema = z.object({
  estimates: z.array(
    z.object({
      n: z.int().min(1),
      estimate: z.literal(STORY_POINTS),
      rationale: z.string().trim().min(1).max(200).optional().catch(undefined),
    }),
  ),
});

const system = `You are a senior software engineer estimating work for a sprint.
Estimate each numbered task in <to_estimate> in story points: 1, 2, 3, 5, 8 or 13.
Points are relative effort, complexity and uncertainty together, not hours.
- Compare the tasks with each other and with the ones in <estimated>, so the scale stays consistent.
- Answer once for every number. Give each a "rationale": one plain sentence (under 100 characters).
${JSON_ONLY}
Shape: {"estimates":[{"n":1,"estimate":3,"rationale":"Small form change with a clear scope."}]}`;

const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

// `toEstimate` are the tasks to answer for (numbered in this order); `known`
// are the sprint's already estimated tasks, shown as a yardstick.
export function estimatesPrompt(sprint: Sprint, toEstimate: BoardTask[], known: BoardTask[]) {
  const numbered = toEstimate.map(
    (t, i) =>
      `${String(i + 1)}. ${t.title}${t.description ? ` — ${short(t.description, 200)}` : ''}`,
  );
  const reference = known.slice(0, 20).map((t) => `- ${t.title} (${String(t.estimate)} pts)`);

  const prompt = [
    '<sprint>',
    `<name>${sprint.name}</name>`,
    `<estimated>\n${reference.join('\n') || '(none yet)'}\n</estimated>`,
    `<to_estimate>\n${numbered.join('\n')}\n</to_estimate>`,
    '</sprint>',
  ].join('\n');

  // About 60 tokens per answer, plus the wrapper.
  return { task: 'estimates' as const, system, prompt, maxTokens: 80 + 70 * toEstimate.length };
}
