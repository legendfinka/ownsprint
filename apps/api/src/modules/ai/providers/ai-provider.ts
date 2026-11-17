// What every AI provider can do: take a prompt, return the model's text,
// either whole or piece by piece. Parsing and validating that text is the
// service's job, so swapping providers (Anthropic, a mock, OpenAI later)
// never touches business logic.

export type AiTask = 'breakdown' | 'estimate' | 'description' | 'estimates' | 'summary';

export interface AiRequest {
  task: AiTask; // lets the mock pick a fitting answer, and helps logs
  system: string;
  prompt: string;
  // A hard cap on the answer. Output tokens are the slow and expensive part,
  // so each prompt asks for a short answer and sets a cap a little above it.
  maxTokens: number;
  signal?: AbortSignal; // aborted when the user leaves, so streaming stops costing money
}

export interface AiProvider {
  readonly name: string; // for logs, e.g. "ollama (qwen2.5:7b)"
  warmUp?(): Promise<void>; // optional: get the model ready before the first request
  complete(request: AiRequest): Promise<string>;
  stream(request: AiRequest): AsyncIterable<string>;
}
