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

test('guests may relay posters from whitelisted image hosts only', async () => {
  const original = process.env.PASSWORD;
  process.env.PASSWORD = 'test';
  const proxy = (target: string, init?: { method: string }) =>
    middleware(
      new NextRequest(
        'https://tongmu.test/api/image-proxy?url=' + encodeURIComponent(target),
        init
      )
    );
  try {
    for (const target of [
      'https://img3.doubanio.com/view/photo/m/public/p1.webp',
      'https://image.tmdb.org/t/p/w500/a.jpg',
      'https://lain.bgm.tv/pic/cover/l/a.jpg',
    ]) {
      expect((await proxy(target)).headers.get('x-middleware-next')).toBe('1');
    }
    for (const target of [
      'https://example.com/a.jpg',
      'https://doubanio.com.evil.test/a.jpg',
      'https://evil-doubanio.com/a.jpg',
      'http://127.0.0.1/a.jpg',
      'https://img3.doubanio.com:8443/a.jpg',
      'https://user:pass@img3.doubanio.com/a.jpg',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect((await proxy(target)).status).toBe(401);
    }
    expect(
      (await proxy('https://img3.doubanio.com/a.jpg', { method: 'POST' }))
        .status
    ).toBe(401);
    expect(
      (await middleware(new NextRequest('https://tongmu.test/api/image-proxy')))
        .status
    ).toBe(401);
  } finally {
    if (original === undefined) delete process.env.PASSWORD;
    else process.env.PASSWORD = original;
  }
});

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
