export type SseEvent = {
  event: string;
  data: unknown;
};

export function parseSseBuffer(buffer: string): {events: SseEvent[]; remainder: string} {
  const events: SseEvent[] = [];
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith(':')) {
      continue;
    }

    let eventName = 'message';
    let data = '';

    for (const line of part.split('\n')) {
      if (line.startsWith(':')) {
        continue;
      }
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data += line.slice(5).trim();
      }
    }

    if (!data) {
      continue;
    }

    try {
      events.push({event: eventName, data: JSON.parse(data)});
    } catch {
      // Ignore malformed JSON payloads.
    }
  }

  return {events, remainder};
}

export type SseConnectionOptions = {
  url: string;
  headers?: Record<string, string>;
  onEvent: (event: SseEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
};

export function openSseConnection(options: SseConnectionOptions): () => void {
  const {url, headers = {}, onEvent, onError, onClose} = options;
  const xhr = new XMLHttpRequest();
  let buffer = '';
  let lastIndex = 0;
  let closed = false;

  const finish = (notifyError = false) => {
    if (closed) {
      return;
    }
    closed = true;
    if (notifyError) {
      onError?.(new Error('SSE connection failed'));
    }
    onClose?.();
  };

  xhr.open('GET', url);
  xhr.setRequestHeader('Accept', 'text/event-stream');
  for (const [key, value] of Object.entries(headers)) {
    xhr.setRequestHeader(key, value);
  }

  xhr.onprogress = () => {
    const text = xhr.responseText;
    const chunk = text.slice(lastIndex);
    lastIndex = text.length;
    if (!chunk) {
      return;
    }

    buffer += chunk;
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.remainder;
    for (const event of parsed.events) {
      onEvent(event);
    }
  };

  xhr.onload = () => finish(false);
  xhr.onerror = () => finish(true);
  xhr.onabort = () => finish(false);

  xhr.send();

  return () => {
    closed = true;
    xhr.abort();
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
