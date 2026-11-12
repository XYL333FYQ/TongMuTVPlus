/** @jest-environment ./src/test/node-web-environment.cjs */
import { NextRequest } from 'next/server';

import { isTogetherSameOrigin } from './request-origin';
test('checks browser origin against incoming host when Next normalizes internal URL to localhost', () => {
  const request = new NextRequest('http://localhost:18300/api/together/rooms', {
    headers: { host: '127.0.0.1:18300', origin: 'http://127.0.0.1:18300' },
  });
  expect(isTogetherSameOrigin(request)).toBe(true);
  expect(
    isTogetherSameOrigin(
      new NextRequest('http://localhost:18300/api/together/rooms', {
        headers: { host: '127.0.0.1:18300', origin: 'https://evil.test' },
      })
    )
  ).toBe(false);
});
test('uses existing secure-proxy handling but rejects missing/null/cross-site origins', () => {
  const url = 'http://localhost:3000/api/together/rooms';
  expect(
    isTogetherSameOrigin(
      new NextRequest(url, {
        headers: {
          host: 'tv.example.test',
          'x-forwarded-proto': 'https',
          origin: 'https://tv.example.test',
        },
      })
    )
  ).toBe(true);
  for (const origin of [
    '',
    'null',
    'http://tv.example.test',
    'https://tv.example.test/path',
  ]) {
    expect(
      isTogetherSameOrigin(
        new NextRequest(url, {
          headers: {
            host: 'tv.example.test',
            'x-forwarded-proto': 'https',
            origin,
          },
        })
      )
    ).toBe(false);
  }
  expect(
    isTogetherSameOrigin(
      new NextRequest(url, {
        headers: {
          origin: 'http://localhost:3000',
          'sec-fetch-site': 'cross-site',
        },
      })
    )
  ).toBe(false);
});
