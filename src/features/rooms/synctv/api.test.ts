/** @jest-environment ./src/test/node-web-environment.cjs */
import { TogetherApi } from './api';
import { SyncedClock } from './clock';
test('bridge requests stay same-origin, send no upstream credentials and preserve cancellation', async () => {
  const fetcher = jest.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ticket: 'once', roomId: 'room_one' }))
  );
  const api = new TogetherApi(fetcher as typeof fetch);
  const controller = new AbortController();
  await api.ticket('room_one', controller.signal);
  expect(fetcher.mock.calls[0][0]).toBe('/api/together/tickets');
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    credentials: 'same-origin',
    signal: controller.signal,
    method: 'POST',
  });
  await expect(api.request('//evil.test')).rejects.toThrow();
});
test('site auth failures retain stable status while discarding upstream text', async () => {
  const api = new TogetherApi(
    async () =>
      new Response(
        JSON.stringify({ error: 'private-token', code: 'UNAUTHORIZED' }),
        { status: 401 }
      )
  );
  await expect(api.request('/session')).rejects.toMatchObject({
    status: 401,
    message: 'UNAUTHORIZED',
  });
});
test('clock accepts only the matching echo and preserves nanosecond precision in transport', async () => {
  let now = 1000;
  const clock = new SyncedClock(() => now);
  const api = new TogetherApi(
    async (input) => {
      const sent = new URL(String(input), 'http://localhost').searchParams.get(
        'clientSentAtNanos'
      );
      now = 1100;
      return new Response(
        JSON.stringify({
          clientSentAtNanos: sent,
          serverReceivedAtNanos: '1220000000',
          serverSentAtNanos: '1240000000',
        })
      );
    },
    () => now
  );
  await api.syncClock(clock, new AbortController().signal);
  expect(clock.offsetMillis).toBe(180);
});
