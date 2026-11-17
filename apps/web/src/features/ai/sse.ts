export interface SseEvent {
  event: string; // "message" when the server names none
  data: string;
}

// Reads server-sent events from a response body. EventSource can't be used:
// it only does GET and can't send the Authorization header.
// An event is a few "field: value" lines, ended by a blank line.
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffered += decoder.decode(value, { stream: true });
      // A chunk can end mid-event, so keep the unfinished tail for the next read.
      const frames = buffered.split('\n\n');
      buffered = frames.pop() ?? '';
      for (const frame of frames) yield parseFrame(frame);
    }
  } finally {
    await reader.cancel().catch(() => {}); // stops the download if we quit early
  }
}

function parseFrame(frame: string): SseEvent {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  return { event, data: data.join('\n') };
}
