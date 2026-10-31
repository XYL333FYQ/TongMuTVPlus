import { refreshPage, registerPageRefresh } from './page-refresh';

afterEach(() => jest.useRealTimers());

test('refresh waits for all visible page sections and coalesces repeated pulls', async () => {
  let complete!: () => void;
  const first = jest.fn(
    () => new Promise<void>((resolve) => (complete = resolve))
  );
  const second = jest.fn(async () => undefined);
  const stopFirst = registerPageRefresh('/search', first);
  const stopSecond = registerPageRefresh('/search', second);
  const pending = refreshPage('/search');
  expect(await refreshPage('/search')).toBe('busy');
  await Promise.resolve();
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  complete();
  expect(await pending).toBe('success');
  stopFirst();
  stopSecond();
});

test('leaving a page cancels pending work and a new visit can refresh independently', async () => {
  let oldSignal!: AbortSignal;
  const stop = registerPageRefresh('/douban', (signal) => {
    oldSignal = signal;
    return new Promise<void>(() => undefined);
  });
  const pending = refreshPage('/douban');
  await Promise.resolve();
  stop();
  expect(await pending).toBe('cancelled');
  expect(oldSignal.aborted).toBe(true);
  const stopNew = registerPageRefresh('/douban', async () => undefined);
  expect(await refreshPage('/douban')).toBe('success');
  stopNew();
});

test('a hung section times out and releases the busy state', async () => {
  jest.useFakeTimers();
  let signal!: AbortSignal;
  const stop = registerPageRefresh('/my', (value) => {
    signal = value;
    return new Promise<void>(() => undefined);
  });
  const pending = refreshPage('/my');
  await Promise.resolve();
  jest.advanceTimersByTime(20000);
  expect(await pending).toBe('timeout');
  expect(signal.aborted).toBe(true);
  stop();
  expect(await refreshPage('/my')).toBe('unavailable');
});

test('a failed section cancels its peers rather than reporting stale data as refreshed', async () => {
  let peer!: AbortSignal;
  const stopPeer = registerPageRefresh('/', (signal) => {
    peer = signal;
    return new Promise<void>(() => undefined);
  });
  const stopFailing = registerPageRefresh('/', async () => {
    throw new Error('network');
  });
  expect(await refreshPage('/')).toBe('failed');
  expect(peer.aborted).toBe(true);
  stopPeer();
  stopFailing();
});

test('unsupported pages never run refresh handlers', async () => {
  const handler = jest.fn(async () => undefined);
  const stop = registerPageRefresh('/play', handler);
  expect(await refreshPage('/play')).toBe('unavailable');
  expect(handler).not.toHaveBeenCalled();
  stop();
});
