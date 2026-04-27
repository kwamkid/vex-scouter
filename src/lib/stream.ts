// Consume an NDJSON streaming response one message at a time. Each line in the
// response body is parsed as JSON and dispatched to `onMessage`. Callers can
// abort via the `signal` option.
export async function consumeNdjson<T = unknown>(
  url: string,
  onMessage: (msg: T) => void,
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  const res = await fetch(url, { signal: opts.signal, cache: "no-store" });
  if (!res.ok || !res.body) {
    throw new Error(`stream failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as T;
        onMessage(parsed);
      } catch {
        // skip malformed line
      }
    }
  }
  // Flush any final fragment.
  const tail = buffer.trim();
  if (tail) {
    try {
      onMessage(JSON.parse(tail) as T);
    } catch {
      // ignore
    }
  }
}
