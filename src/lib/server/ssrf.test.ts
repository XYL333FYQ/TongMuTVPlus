/** @jest-environment ./src/test/node-web-environment.cjs */
import dns from 'dns';

import {
  guardedFetch,
  hostsOf,
  isPrivateIP,
  isProxyTargetAllowed,
  ProxyTargetBlockedError,
  safeImageContentType,
  safeMediaContentType,
  validateProxyUrlServerSide,
} from './ssrf';

jest.mock('dns', () => ({
  promises: { lookup: jest.fn() },
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test.each([
  '127.0.0.1',
  '10.0.0.1',
  '169.254.169.254',
  '172.16.0.1',
  '192.168.1.1',
  '::1',
  '::',
  'fc00::1',
  'fe80::1',
  '::ffff:7f00:1',
  '::ffff:a9fe:a9fe',
  '::ffff:127.0.0.1',
  '0:0:0:0:0:ffff:7f00:1',
])('recognizes private address %s', (address) => {
  expect(isPrivateIP(address)).toBe(true);
});

test.each(['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888', '::ffff:808:808'])(
  'preserves public address %s',
  (address) => {
    expect(isPrivateIP(address)).toBe(false);
  }
);

test.each(['::ffff:7f00:1', '::ffff:a9fe:a9fe'])(
  'blocks a URL resolving to mapped private address %s',
  async (address) => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (dns.promises.lookup as jest.Mock).mockResolvedValue({
      address,
      family: 6,
    });
    expect(await validateProxyUrlServerSide(`http://[${address}]/`)).toBe(
      false
    );
  }
);

test('continues to allow a public resolved destination', async () => {
  (dns.promises.lookup as jest.Mock).mockResolvedValue({
    address: '8.8.8.8',
    family: 4,
  });
  expect(await validateProxyUrlServerSide('https://example.test/')).toBe(true);
});

test.each(['file:///etc/passwd', 'http://user:password@example.test/'])(
  'rejects invalid URL policy before resolving %s',
  async (url) => {
    expect(await validateProxyUrlServerSide(url)).toBe(false);
    expect(dns.promises.lookup).not.toHaveBeenCalled();
  }
);

test.each(['100.64.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255'])(
  'treats carrier NAT, benchmark and multicast address %s as internal',
  (address) => {
    expect(isPrivateIP(address)).toBe(true);
  }
);

describe('guarded proxy fetch', () => {
  const originalFetch = global.fetch;
  const lookup = dns.promises.lookup as jest.Mock;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // evil.test 解析到公网，internal.test 解析到内网
    lookup.mockImplementation(async (host: string) => ({
      address: host === 'internal.test' ? '10.0.0.5' : '93.184.216.34',
      family: 4,
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ALLOW_PRIVATE_PROXY_TARGETS;
  });

  test('a public URL that redirects to an internal address is blocked at the redirect', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(null, {
        status: 302,
        headers: { location: 'http://internal.test/admin' },
      });
    }) as typeof fetch;

    await expect(guardedFetch('https://evil.test/r')).rejects.toBeInstanceOf(
      ProxyTargetBlockedError
    );
    // 只请求了公网第一跳，内网地址从未被访问
    expect(calls).toEqual(['https://evil.test/r']);
  });

  test('public redirects are followed and the final URL is reported', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('/start')
        ? new Response(null, { status: 301, headers: { location: '/final' } })
        : Object.defineProperty(new Response('ok'), 'url', {
            value: String(url),
          })
    ) as typeof fetch;

    const response = await guardedFetch('https://cdn.test/start');
    expect(await response.text()).toBe('ok');
    expect(response.url).toBe('https://cdn.test/final');
  });

  test('owner-configured LAN hosts are allowed, other internal hosts are not', async () => {
    const trusted = hostsOf([
      'http://internal.test:8080/live.m3u',
      'not a url',
    ]);
    expect(
      await isProxyTargetAllowed('http://internal.test/1.ts', trusted)
    ).toBe(true);
    expect(await isProxyTargetAllowed('http://internal.test/1.ts')).toBe(false);
    expect(await isProxyTargetAllowed('file:///etc/passwd', trusted)).toBe(
      false
    );
  });

  test('ALLOW_PRIVATE_PROXY_TARGETS lets the owner opt in to LAN targets', async () => {
    process.env.ALLOW_PRIVATE_PROXY_TARGETS = 'true';
    expect(await isProxyTargetAllowed('http://internal.test/x')).toBe(true);
  });
});

test('proxied content types never pass HTML through', () => {
  expect(safeImageContentType('image/webp')).toBe('image/webp');
  expect(safeImageContentType('text/html; charset=utf-8')).toBe(
    'application/octet-stream'
  );
  expect(safeImageContentType(null)).toBe('application/octet-stream');
  expect(safeMediaContentType('application/vnd.apple.mpegurl')).toBe(
    'application/vnd.apple.mpegurl'
  );
  expect(safeMediaContentType('video/mp2t')).toBe('video/mp2t');
  expect(safeMediaContentType('text/html')).toBe('application/octet-stream');
  expect(safeMediaContentType('application/xhtml+xml')).toBe(
    'application/octet-stream'
  );
});
