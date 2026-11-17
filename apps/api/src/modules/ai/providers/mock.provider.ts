import type {
  BreakdownSuggestion,
  DescriptionSuggestion,
  EstimateSuggestion,
} from '@ownsprint/shared';
import type { AiProvider, AiRequest, AiTask } from './ai-provider';

const answers: Record<
  Exclude<AiTask, 'summary' | 'estimates'>,
  BreakdownSuggestion | EstimateSuggestion | DescriptionSuggestion
> = {
  breakdown: {
    subtasks: [
      { title: 'Clarify requirements and edge cases', priority: 'high', estimate: 1 },
      { title: 'Implement the core change', priority: 'high', estimate: 3 },
      { title: 'Write tests', priority: 'medium', estimate: 2 },
      { title: 'Review, polish and update docs', priority: 'low', estimate: 1 },
    ],
  },
  estimate: {
    estimate: 3,
    priority: 'medium',
    rationale: 'Mock answer: a moderate, well-understood change. Set AI_PROVIDER for real ones.',
  },
  description: {
    description:
      'Mock answer: describe the goal of this task in a sentence or two.\n' +
      'Done when:\n- The main flow works\n- It is covered by tests\n- Set AI_PROVIDER for real answers',
  },
};

const summary = `Done
- Mock answer: the tasks in the Done column would be listed here.

Not done
- Tasks still To Do or In Progress would be listed here.

Risks
- Set AI_PROVIDER in .env for a real summary of this sprint.`;

// An answer for every numbered line ("1. Title") in the prompt, cycling
// through 2, 3, 5 and 8 points so the list looks varied.
function estimatesFor(prompt: string) {
  const count = (prompt.match(/^\d+\. /gm) ?? []).length;
  const points = [2, 3, 5, 8] as const;
  return {
    estimates: Array.from({ length: count }, (_, i) => ({
      n: i + 1,
      estimate: points[i % points.length],
      rationale: 'Mock answer: a guess. Set AI_PROVIDER for real estimates.',
    })),
  };
}

// Used when AI_PROVIDER is "mock" (the default) and in tests: believable
// answers, no network, no cost. Answers as JSON text, like a model.
export class MockAiProvider implements AiProvider {
  readonly name = 'mock (set AI_PROVIDER in .env for real answers)';

  // `delayMs` is the pause between streamed words, so the UI looks live.
  constructor(private readonly delayMs = 30) {}

  complete({ task, prompt }: AiRequest): Promise<string> {
    if (task === 'summary') return Promise.resolve(summary);
    if (task === 'estimates') return Promise.resolve(JSON.stringify(estimatesFor(prompt)));
    return Promise.resolve(JSON.stringify(answers[task]));
  }

  async *stream({ signal }: AiRequest): AsyncGenerator<string> {
    for (const word of summary.match(/\S+\s*/g) ?? []) {
      if (signal?.aborted) return;
      if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      yield word;
    }
  }
}
