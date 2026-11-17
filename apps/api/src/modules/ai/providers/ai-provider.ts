// What every AI provider can do: take a prompt, return the model's text.
// Parsing and validating that text is the service's job, so swapping
// providers (Anthropic, a mock, OpenAI later) never touches business logic.

export type AiTask = 'breakdown' | 'estimate' | 'description';

export interface AiRequest {
  task: AiTask; // lets the mock pick a fitting answer, and helps logs
  system: string;
  prompt: string;
}

export interface AiProvider {
  readonly name: string; // for logs, e.g. "ollama (qwen2.5:7b)"
  complete(request: AiRequest): Promise<string>;
}
