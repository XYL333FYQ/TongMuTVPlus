/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/request-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/tv-mode', () => ({
  isTVModeEnabled: () => true,
  resolveLoginPath: () => '/login',
}));
import { NextRequest } from 'next/server';

import { middleware } from './middleware';

test('short-drama browsing is public but source and playback endpoints remain protected', async () => {
  const original = process.env.PASSWORD;
  process.env.PASSWORD = 'test';
  try {
    expect(
      (
        await middleware(new NextRequest('https://tongmu.test/duanju'))
      ).headers.get('x-middleware-next')
    ).toBe('1');
    expect(
      (
        await middleware(
          new NextRequest('https://tongmu.test/api/public/catalog?type=duanju')
        )
      ).headers.get('x-middleware-next')
    ).toBe('1');
    for (const route of [
      '/api/duanju/sources',
      '/api/duanju/videos',
      '/api/search',
      '/api/detail',
      '/api/rooms/join',
    ]) {
      expect(
        (await middleware(new NextRequest('https://tongmu.test' + route)))
          .status
      ).toBe(401);
    }
    expect(
      (
        await middleware(new NextRequest('https://tongmu.test/play?title=x'))
      ).headers.get('location')
    ).toContain('/login?');
  } finally {
    if (original === undefined) delete process.env.PASSWORD;
    else process.env.PASSWORD = original;
  }
});
