import type { AiProvider, AiRequest } from './ai-provider';

// Ollama unloads a model after 5 minutes by default, and loading it again
// takes seconds. Keeping it longer makes the next request start at once.
const KEEP_ALIVE = '30m';

// A free model running on your own machine (https://ollama.com).
// Errors say how to fix them; the service logs them for the developer.
export class OllamaProvider implements AiProvider {
  readonly name: string;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {
    this.name = `ollama (${model})`;
  }

  // Loads the model into memory (a request without a prompt does just that),
  // so the first real request doesn't wait for it. Never throws: Ollama may
  // simply not be running yet, and the first request will say so.
  async warmUp(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, keep_alive: KEEP_ALIVE }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`answered ${String(res.status)}`);
      console.log(`Ollama: ${this.model} is loaded`);
    } catch (error) {
      console.warn(`Ollama warm-up skipped: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  async complete(request: AiRequest): Promise<string> {
    // format "json" asks the model for valid JSON (still validated by us).
    const res = await this.chat(request, { stream: false, format: 'json' });
    const body = (await res.json()) as { message?: { content?: string } };
    return body.message?.content ?? '';
  }

  // Ollama streams one JSON object per line: {"message":{"content":"…"},"done":false}
  async *stream(request: AiRequest): AsyncGenerator<string> {
    const res = await this.chat(request, { stream: true });
    if (!res.body) return;

    // Node types the body as ReadableStream<any>; it is bytes.
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });
        // A line can arrive split over two reads, so only whole lines are used.
        const lines = buffered.split('\n');
        buffered = done ? '' : (lines.pop() ?? '');
        for (const line of lines) {
          const content = this.contentOf(line);
          if (content) yield content;
        }
        if (done) return;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  private contentOf(line: string): string | undefined {
    if (!line.trim()) return undefined;
    const part = JSON.parse(line) as { message?: { content?: string }; error?: string };
    if (part.error) throw new Error(`Ollama failed: ${part.error}`);
    return part.message?.content;
  }

  private async chat(
    { system, prompt, maxTokens, signal }: AiRequest,
    options: { stream: boolean; format?: 'json' },
  ): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          options: { num_predict: maxTokens },
          keep_alive: KEEP_ALIVE,
          ...options,
        }),
        // Generous: the first call also loads the model into memory.
        signal: AbortSignal.any([AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]),
      });
    } catch (error) {
      throw new Error(
        `Ollama is not reachable at ${this.baseUrl}. Is it running? Start it with: ollama serve`,
        {
          cause: error,
        },
      );
    }

    if (res.status === 404) {
      throw new Error(`Ollama has no model "${this.model}". Run: ollama pull ${this.model}`);
    }
    if (!res.ok) throw new Error(`Ollama answered ${String(res.status)}: ${await res.text()}`);
    return res;
  }
}
