import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SprintSummary } from './SprintSummary';

const encoder = new TextEncoder();
const piece = (text: string) => `data: ${JSON.stringify({ text })}\n\n`;

// A response whose body we feed by hand, like a server writing events over time.
function fakeStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    send: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
    end: () => controller.close(),
  };
}

function renderSummary() {
  render(<SprintSummary projectId="p" sprintId="s" />);
  return userEvent.setup();
}

describe('SprintSummary', () => {
  it('shows the text as it arrives and when it is finished', async () => {
    const stream = fakeStream();
    const user = renderSummary();

    await user.click(screen.getByRole('button', { name: 'Summarize sprint' }));
    expect(stream.fetchMock.mock.calls[0]?.[0]).toBe('/api/projects/p/sprints/s/ai/summary');
    expect(await screen.findByText('Thinking…')).toBeInTheDocument();

    // An event split over two network chunks is still read as one.
    const second = piece('are done.');
    stream.send(piece('Two tasks '));
    stream.send(second.slice(0, 8));
    expect(await screen.findByText('Two tasks')).toBeInTheDocument();
    stream.send(second.slice(8));
    stream.send('event: done\ndata: {}\n\n');
    stream.end();

    expect(await screen.findByText('Two tasks are done.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Write again' })).toBeInTheDocument();
  });

  it('shows an error sent in the stream and keeps the text so far', async () => {
    const stream = fakeStream();
    const user = renderSummary();

    await user.click(screen.getByRole('button', { name: 'Summarize sprint' }));
    stream.send(piece('Half a summary'));
    stream.send(
      `event: error\ndata: ${JSON.stringify({ message: 'The AI service is down.' })}\n\n`,
    );
    stream.end();

    expect(await screen.findByText('The AI service is down.')).toBeInTheDocument();
    expect(screen.getByText('Half a summary')).toBeInTheDocument();
  });

  it('reports a stream that ends without finishing', async () => {
    const stream = fakeStream();
    const user = renderSummary();

    await user.click(screen.getByRole('button', { name: 'Summarize sprint' }));
    stream.send(piece('Cut off'));
    stream.end(); // no "done" event

    expect(await screen.findByText(/connection was lost/)).toBeInTheDocument();
  });

  it('stops the request and keeps what has arrived', async () => {
    const stream = fakeStream();
    const user = renderSummary();

    await user.click(screen.getByRole('button', { name: 'Summarize sprint' }));
    stream.send(piece('So far'));
    await screen.findByText('So far');
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(stream.fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(screen.getByText('So far')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Write again' })).toBeEnabled());
  });
});
