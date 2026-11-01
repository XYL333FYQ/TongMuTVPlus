import {
  getDoubanCategories,
  getDoubanList,
  getDoubanRecommends,
} from './douban.client';

const originalFetch = global.fetch;
const errors = jest.fn();
type Options = { signal?: AbortSignal; reportError?: boolean };
const categories = (options?: Options) =>
  getDoubanCategories(
    { kind: 'movie', category: '热门', type: '全部' },
    options
  );
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('doubanDataSource', 'direct');
  errors.mockClear();
  window.addEventListener('globalError', errors);
});
afterEach(() => {
  window.removeEventListener('globalError', errors);
  global.fetch = originalFetch;
  localStorage.clear();
});

test('ordinary catalogue failure retains the existing global feedback', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  await expect(categories()).rejects.toThrow();
  expect(errors).toHaveBeenCalledTimes(1);
});

test.each([
  ['categories', categories],
  [
    'list',
    (options?: Options) =>
      getDoubanList({ tag: '热门', type: 'movie' }, options),
  ],
  [
    'recommends',
    (options?: Options) => getDoubanRecommends({ kind: 'movie' }, options),
  ],
] as const)(
  '%s leaves feedback to its manual-refresh owner without hiding failure',
  async (_name, load) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(load({ reportError: false })).rejects.toThrow();
    expect(errors).not.toHaveBeenCalled();
  }
);

test('manual direct requests receive the real abort signal and never retry after cancellation', async () => {
  localStorage.setItem('doubanDataSourceBackup', 'cmliussss-cdn-tencent');
  const controller = new AbortController();
  global.fetch = jest.fn(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true }
        );
      })
  );
  const pending = categories({ signal: controller.signal });
  expect((global.fetch as jest.Mock).mock.calls[0][1].signal).toBe(
    controller.signal
  );
  expect((global.fetch as jest.Mock).mock.calls[0][1].cache).toBe('no-store');
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(errors).not.toHaveBeenCalled();
});

test('a proxy request remains linked to cancellation while its JSON body is pending', async () => {
  localStorage.setItem('doubanDataSource', 'cmliussss-cdn-tencent');
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
  const pending = categories({ signal: controller.signal, reportError: false });
  for (let index = 0; index < 6 && !finish; index++) await Promise.resolve();
  controller.abort();
  try {
    expect(transport.aborted).toBe(true);
  } finally {
    finish({ items: [] });
    await pending.catch(() => undefined);
  }
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(errors).not.toHaveBeenCalled();
});

test('an already cancelled refresh starts no network request', async () => {
  const controller = new AbortController();
  controller.abort();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ code: 200, list: [] }),
  });
  await expect(categories({ signal: controller.signal })).rejects.toThrow();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});
