import type { SyncedClock } from './clock';

export class TogetherApi {
  constructor(private fetcher: typeof fetch = fetch, private now = Date.now) {}
  async request<T = Record<string, unknown>>(
    path: string,
    init: { method?: string; body?: unknown; signal?: AbortSignal } = {}
  ): Promise<T> {
    if (
      !/^\/(?!\/)/.test(path) ||
      /[\\\r\n#]/.test(path) ||
      path
        .split('?')[0]
        .split('/')
        .some((part) => part === '.' || part === '..') ||
      /%2f|%5c|%2e/i.test(path)
    )
      throw new Error('无效的房间请求');
    const response = await this.fetcher('/api/together' + path, {
      method: init.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: init.signal,
      ...(init.body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(init.body),
          }
        : {}),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(
          typeof data?.code === 'string' && /^[A-Z_]{1,80}$/.test(data.code)
            ? data.code
            : 'TOGETHER_REQUEST_FAILED'
        ),
        { status: response.status }
      );
    return data as T;
  }
  ticket(roomId: string, signal: AbortSignal) {
    return this.request<{ roomId: string; ticket: string }>('/tickets', {
      method: 'POST',
      body: { roomId },
      signal,
    });
  }
  async syncClock(clock: SyncedClock, signal: AbortSignal) {
    const sent = (BigInt(this.now()) * BigInt(1000000)).toString();
    try {
      const response = await this.request<{
        clientSentAtNanos: string;
        serverReceivedAtNanos: string;
        serverSentAtNanos: string;
      }>('/clock?clientSentAtNanos=' + sent, { signal });
      const received = (BigInt(this.now()) * BigInt(1000000)).toString();
      if (signal.aborted || String(response.clientSentAtNanos) !== sent) return;
      clock.sample(
        sent,
        received,
        String(response.serverReceivedAtNanos),
        String(response.serverSentAtNanos)
      );
    } catch (error) {
      if (!signal.aborted) clock.reset();
      throw error;
    }
  }
}
