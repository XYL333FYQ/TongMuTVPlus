/** @jest-environment ./src/test/node-web-environment.cjs */
import dns from 'dns';

jest.mock('dns', () => ({ promises: { lookup: jest.fn() } }));
jest.mock('../_utils', () => ({
  getAuthorizedBooksUsername: async () => 'reader',
}));
jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/lib/book-provider', () => ({
  bookProvider: {
    getSourceById: async () => ({
      id: 's',
      name: '自建书库',
      url: 'http://opds.lan/catalog',
      authMode: 'basic',
      username: 'owner',
      password: 'library-secret',
    }),
  },
}));

import { NextRequest } from 'next/server';

import { GET } from './route';

const originalFetch = global.fetch;
const lookup = dns.promises.lookup as jest.Mock;
let requests: Array<{ url: string; auth: string | null }>;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  requests = [];
  // 书源在内网（自建），cdn.test 在公网，internal.test 是别的内网服务
  lookup.mockImplementation(async (host: string) => ({
    address: host === 'cdn.test' ? '93.184.216.34' : '10.0.0.5',
    family: 4,
  }));
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(url),
      auth: new Headers(init?.headers).get('authorization'),
    });
    if (String(url).endsWith('/redirect'))
      return new Response(null, {
        status: 302,
        headers: { location: 'https://cdn.test/book.epub' },
      });
    return new Response('book', {
      headers: { 'content-type': 'application/epub+zip' },
    });
  }) as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

const download = (href: string) =>
  GET(
    new NextRequest(
      `https://tongmu.test/api/books/file?sourceId=s&href=${encodeURIComponent(
        href
      )}`
    )
  );

test('the configured source on the LAN still downloads with its credentials', async () => {
  const response = await download('http://opds.lan/books/1.epub');
  expect(response.status).toBe(200);
  expect(requests[0].auth).toMatch(/^Basic /);
});

test('source credentials are never sent to another host, even after a redirect', async () => {
  await download('https://cdn.test/other.epub');
  await download('http://opds.lan/redirect');
  expect(requests.map((r) => [r.url, Boolean(r.auth)])).toEqual([
    ['https://cdn.test/other.epub', false],
    ['http://opds.lan/redirect', true],
    ['https://cdn.test/book.epub', false],
  ]);
});

test('a caller-supplied href pointing at another internal service is refused', async () => {
  const response = await download('http://internal.test:2375/containers');
  expect(response.status).toBe(400);
  expect(requests).toEqual([]);
});
