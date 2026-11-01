import { GetBangumiCalendarData } from './bangumi.client';

const originalFetch = global.fetch;
const timeoutDescriptor = Object.getOwnPropertyDescriptor(
  AbortSignal,
  'timeout'
);
const key = 'homepage_bangumi';
const oldData = [{ weekday: { en: 'Mon' }, items: [{ id: 1, name: 'old' }] }];
const newData = [{ weekday: { en: 'Mon' }, items: [{ id: 2, name: 'new' }] }];
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('animeDataSource', 'direct');
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: () => new AbortController().signal,
  });
});
afterEach(() => {
  localStorage.clear();
  global.fetch = originalFetch;
  if (timeoutDescriptor)
    Object.defineProperty(AbortSignal, 'timeout', timeoutDescriptor);
  else delete (AbortSignal as unknown as { timeout?: unknown }).timeout;
});
function cache() {
  localStorage.setItem(
    key,
    JSON.stringify({ data: oldData, timestamp: Date.now() })
  );
}

test('ordinary visits retain the same one-hour shared calendar cache', async () => {
  cache();
  global.fetch = jest.fn();
  expect(await GetBangumiCalendarData()).toEqual(oldData);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('explicit refresh bypasses the inner calendar cache and stores only completed fresh data', async () => {
  cache();
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => newData });
  expect(await GetBangumiCalendarData({ force: true })).toEqual(newData);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect((global.fetch as jest.Mock).mock.calls[0][1].cache).toBe('no-store');
  expect(JSON.parse(localStorage.getItem(key)!).data).toEqual(newData);
});

test('cancelled requests cannot retry a backup or overwrite the usable old cache', async () => {
  cache();
  const controller = new AbortController();
  let transport!: AbortSignal;
  let finish!: (value: unknown) => void;
  global.fetch = jest.fn(async (_url, options) => {
    transport = options?.signal as AbortSignal;
    return {
      ok: true,
      json: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    } as Response;
  });
  const pending = GetBangumiCalendarData({
    force: true,
    signal: controller.signal,
  });
  for (let index = 0; index < 6 && !finish; index++) await Promise.resolve();
  controller.abort();
  try {
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(transport.aborted).toBe(true);
  } finally {
    finish?.(newData);
    await pending.catch(() => undefined);
  }
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(key)!).data).toEqual(oldData);
});

test('a late initial load cannot overwrite the calendar cache after a newer explicit refresh', async () => {
  let finish!: (value: unknown) => void;
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => newData });
  const initial = GetBangumiCalendarData();
  for (let index = 0; index < 6 && !finish; index++) await Promise.resolve();
  await GetBangumiCalendarData({ force: true });
  finish(oldData);
  await initial;
  expect(JSON.parse(localStorage.getItem(key)!).data).toEqual(newData);
});

test('ordinary uncached calendar requests retain their normal HTTP cache policy', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => newData });
  await GetBangumiCalendarData();
  expect((global.fetch as jest.Mock).mock.calls[0][1].cache).toBeUndefined();
});
