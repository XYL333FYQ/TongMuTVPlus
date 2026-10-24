/** @jest-environment ./src/test/node-web-environment.cjs */
import dns from 'dns';

import { fetchPageText } from './ai-tool-agent';

jest.mock('dns', () => ({ promises: { lookup: jest.fn() } }));
jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/lib/ai-orchestrator', () => ({}));
jest.mock('@/lib/tmdb.client', () => ({}));

const originalFetch = global.fetch;
const lookup = dns.promises.lookup as jest.Mock;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  // public.test 在公网，internal.test 在内网
  lookup.mockImplementation(async (host: string) => ({
    address: host === 'internal.test' ? '127.0.0.1' : '93.184.216.34',
    family: 4,
  }));
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test('a public page that redirects to an internal address is blocked, and the internal page is never read', async () => {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return String(url).includes('internal.test')
      ? new Response('<p>internal secret</p>')
      : new Response(null, {
          status: 302,
          headers: { location: 'http://internal.test:8080/secret' },
        });
  }) as typeof fetch;

  const text = await fetchPageText('https://public.test/start');
  expect(text).toContain('已拦截');
  expect(text).not.toContain('internal secret');
  expect(calls).toEqual(['https://public.test/start']);
});

test('public redirects still work and return the final page text', async () => {
  global.fetch = jest.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith('/start')
      ? new Response(null, { status: 301, headers: { location: '/article' } })
      : new Response('<html><body><p>正文内容</p></body></html>')
  ) as typeof fetch;

  await expect(fetchPageText('https://public.test/start')).resolves.toContain(
    '正文内容'
  );
});
