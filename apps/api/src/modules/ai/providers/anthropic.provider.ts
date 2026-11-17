import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, AiRequest } from './ai-provider';

export class AnthropicProvider implements AiProvider {
  readonly name: string;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.name = `anthropic (${model})`;
    // The SDK retries rate limits and server errors itself (with backoff).
    this.client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 2 });
  }

  async complete({ system, prompt }: AiRequest): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
  }
}
