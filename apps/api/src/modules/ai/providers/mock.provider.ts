import type {
  BreakdownSuggestion,
  DescriptionSuggestion,
  EstimateSuggestion,
} from '@ownsprint/shared';
import type { AiProvider, AiRequest, AiTask } from './ai-provider';

const answers: Record<AiTask, BreakdownSuggestion | EstimateSuggestion | DescriptionSuggestion> = {
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

// Used when AI_PROVIDER is "mock" (the default) and in tests: believable
// answers, no network, no cost. Answers as JSON text, like a model.
export class MockAiProvider implements AiProvider {
  readonly name = 'mock (set AI_PROVIDER in .env for real answers)';

  complete({ task }: AiRequest): Promise<string> {
    return Promise.resolve(JSON.stringify(answers[task]));
  }
}
