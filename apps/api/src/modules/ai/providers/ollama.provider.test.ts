import { describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from './ollama.provider';

const request = { task: 'estimate' as const, system: 'Be brief.', prompt: '<task>…</task>' };
const ollama = new OllamaProvider('http://localhost:11434', 'qwen2.5:7b');

function fakeFetch(response: Response | Error) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('OllamaProvider', () => {
  it('asks the local model for JSON and returns its text', async () => {
    const fetchMock = fakeFetch(
      new Response(JSON.stringify({ message: { role: 'assistant', content: '{"estimate":3}' } })),
    );

    await expect(ollama.complete(request)).resolves.toBe('{"estimate":3}');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      model: 'qwen2.5:7b',
      format: 'json',
      stream: false,
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: '<task>…</task>' },
      ],
    });
  });

  it('says how to fix a missing model', async () => {
    fakeFetch(new Response('{"error":"model not found"}', { status: 404 }));

    await expect(ollama.complete(request)).rejects.toThrow('ollama pull qwen2.5:7b');
  });

  it('says when Ollama is not running', async () => {
    fakeFetch(new TypeError('fetch failed'));

    await expect(ollama.complete(request)).rejects.toThrow('Start it with: ollama serve');
  });
});
