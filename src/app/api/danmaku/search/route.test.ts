/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(async () => ({ SiteConfig: {} })),
}));
jest.mock('@/lib/danmaku/config', () => ({
  getDanmakuApiBaseUrl: () => 'https://danmaku.test',
}));

import { NextRequest } from 'next/server';

import { GET } from './route';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('the timeout still applies when the upstream sends headers and then stalls the body', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  // 记下路由设置的超时回调，等响应头到了、正在读正文时再手动触发
  let fireTimeout: (() => void) | undefined;
  jest.spyOn(global, 'setTimeout').mockImplementation(((
    callback: () => void
  ) => {
    fireTimeout = callback;
    return 0;
  }) as unknown as typeof setTimeout);
  // 路由清掉了超时就不再触发，和真实计时器一致
  jest.spyOn(global, 'clearTimeout').mockImplementation(() => {
    fireTimeout = undefined;
  });
  // 立即回响应头，正文一直不来，直到请求被中止
  global.fetch = jest.fn(
    async (_url: RequestInfo | URL, init?: RequestInit) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener('abort', () =>
              controller.error(
                Object.assign(new Error('aborted'), { name: 'AbortError' })
              )
            );
          },
        }),
        { status: 200 }
      )
  ) as typeof fetch;

  const pending = GET(
    new NextRequest('https://tongmu.test/api/danmaku/search?keyword=test')
  );
  for (let i = 0; i < 5; i++) await settle();
  expect(global.fetch).toHaveBeenCalled();
  fireTimeout?.();
  const response = await pending;

  expect(response.status).toBe(500);
  expect((await response.json()).errorMessage).toContain('超时');
});
