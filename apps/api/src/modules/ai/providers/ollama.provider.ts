import type { AiProvider, AiRequest } from './ai-provider';

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

  async complete({ system, prompt }: AiRequest): Promise<string> {
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
          format: 'json', // ask the model for valid JSON (still validated by us)
          stream: false,
        }),
        // Generous: the first call also loads the model into memory.
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new Error(`Ollama is not reachable at ${this.baseUrl}. Is it running? Start it with: ollama serve`, {
        cause: error,
      });
    }

    if (res.status === 404) {
      throw new Error(`Ollama has no model "${this.model}". Run: ollama pull ${this.model}`);
    }
    if (!res.ok) throw new Error(`Ollama answered ${String(res.status)}: ${await res.text()}`);

    const body = (await res.json()) as { message?: { content?: string } };
    return body.message?.content ?? '';
  }
}
