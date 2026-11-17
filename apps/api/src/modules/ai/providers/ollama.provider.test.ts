import { describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from './ollama.provider';

const request = {
  task: 'estimate' as const,
  system: 'Be brief.',
  prompt: '<task>…</task>',
  maxTokens: 150,
};
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
      options: { num_predict: 150 }, // the answer is capped
      keep_alive: '30m', // the model stays loaded between requests
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: '<task>…</task>' },
      ],
    });
  });

  it('streams the answer piece by piece, even when a line is split', async () => {
    const line = (content: string, done = false) =>
      JSON.stringify({ message: { content }, done }) + '\n';
    const second = line('wor');
    const encoder = new TextEncoder();
    // The second line arrives in two network chunks.
    const chunks = [line('Hello ') + second.slice(0, 10), second.slice(10) + line('ld', true)];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    const fetchMock = fakeFetch(new Response(body));

    const pieces: string[] = [];
    for await (const piece of ollama.stream({ ...request, task: 'summary' })) pieces.push(piece);

    expect(pieces).toEqual(['Hello ', 'wor', 'ld']);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const sent = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ stream: true });
    expect(sent).not.toHaveProperty('format'); // free text, not JSON
  });

  it('loads the model in advance, keeping it for a while', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = fakeFetch(new Response('{}'));

    await ollama.warmUp();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:11434/api/generate');
    // No prompt: Ollama only loads the model.
    expect(JSON.parse(init?.body as string)).toEqual({ model: 'qwen2.5:7b', keep_alive: '30m' });
  });

  it('does not fail the server when warm-up cannot reach Ollama', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeFetch(new TypeError('fetch failed'));

    await expect(ollama.warmUp()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('warm-up skipped'));
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
