/** @jest-environment ./src/test/node-web-environment.cjs */
import dns from 'dns';

jest.mock('dns', () => ({ promises: { lookup: jest.fn() } }));
jest.mock('../_utils', () => ({
  getAuthorizedBooksUsername: async () => 'reader',
}));
jest.mock('@/lib/legado.client', () => ({
  legadoClient: {
    getSourceById: async () => ({ url: 'https://books.test' }),
  },
}));

import { NextRequest } from 'next/server';

import { GET } from './route';

const originalFetch = global.fetch;
const lookup = dns.promises.lookup as jest.Mock;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  lookup.mockImplementation(async (host: string) => ({
    address: host === 'internal.test' ? '10.0.0.5' : '93.184.216.34',
    family: 4,
  }));
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

const request = (url: string) =>
  new NextRequest(
    `https://tongmu.test/api/books/image?sourceId=s&url=${encodeURIComponent(
      url
    )}`
  );

test('a second redirect into the private network is blocked', async () => {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    calls.push(String(url));
    if (String(url).includes('a.test'))
      return new Response(null, {
        status: 302,
        headers: { location: 'https://b.test/img' },
      });
    if (String(url).includes('b.test'))
      return new Response(null, {
        status: 302,
        headers: { location: 'http://internal.test/secret' },
      });
    return new Response('internal secret');
  }) as typeof fetch;

  const response = await GET(request('https://a.test/cover-1.jpg'));
  expect(response.status).toBe(400);
  expect(calls).toEqual(['https://a.test/cover-1.jpg', 'https://b.test/img']);
});

test('images are still served, and non-image bodies are not passed through as HTML', async () => {
  global.fetch = jest.fn(
    async () =>
      new Response('<script>alert(1)</script>', {
        headers: { 'content-type': 'text/html' },
      })
  ) as typeof fetch;
  const response = await GET(request('https://a.test/cover-2.jpg'));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
});
