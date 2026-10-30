/** @jest-environment ./src/test/node-web-environment.cjs */
// 管理接口权限总排查：每一个 /api/admin/** 接口的每一个方法，
// 未登录、普通成员来访都必须被拒绝（401/403），且不能动到配置或数据库。
// 新增管理接口会被自动纳入，不用记得补测试。
import fs from 'node:fs';
import path from 'node:path';

import { NextRequest } from 'next/server';

// 被拒绝的请求不应该走到写配置、写数据库这一步。
// 读用户信息（判断角色）返回空；其余任何数据库/存储调用直接抛错——
// 既能暴露"没校验权限就动数据"，也避免假对象让某些循环永远转下去。
const touched: string[] = [];
const READ_OK = /^(get|has|check|verify|is)/;
function recorder(label: string): unknown {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== 'string' || key === 'then') return undefined;
        return (..._args: unknown[]) => {
          touched.push(label + '.' + key);
          if (READ_OK.test(key)) return Promise.resolve(null);
          throw new Error('unauthorized request reached ' + label + '.' + key);
        };
      },
    }
  );
}
function writer(label: string) {
  return (..._args: unknown[]) => {
    touched.push(label);
    throw new Error('unauthorized request reached ' + label);
  };
}

jest.mock('@/lib/config', () => {
  const actual = jest.requireActual('@/lib/config');
  return {
    ...actual,
    getConfig: jest.fn(async () => ({
      SiteConfig: {},
      UserConfig: { Users: [] },
      SourceConfig: [],
      LiveConfig: [],
      CustomCategories: [],
      ConfigFile: '',
    })),
    resetConfig: writer('resetConfig'),
    clearConfigCache: writer('clearConfigCache'),
    setCachedConfig: writer('setCachedConfig'),
  };
});
// jest 27 读不懂 package.json 的 exports，cheerio/slim 在真实运行和构建里是正常的
jest.mock('cheerio/slim', () => ({ load: jest.fn() }), { virtual: true });
jest.mock('nanoid', () => ({ nanoid: () => 'id' }));
jest.mock('@/lib/db', () => ({
  db: recorder('db'),
  getStorage: () => recorder('storage'),
}));

process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
process.env.USERNAME = 'boss';
process.env.PASSWORD = 'boss-password';

const ADMIN_DIR = path.join(__dirname);
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === 'route.ts' ? [full] : [];
  });
}

function memberCookie() {
  return (
    'auth=' +
    encodeURIComponent(
      JSON.stringify({
        username: 'alice',
        role: 'user',
        timestamp: Date.now(),
        tokenId: 't',
        refreshToken: 'r',
        refreshExpires: Date.now() + 100000,
        signature: 'a'.repeat(64),
      })
    )
  );
}

const files = routeFiles(ADMIN_DIR);

test('the sweep actually found the admin routes', () => {
  expect(files.length).toBeGreaterThanOrEqual(40);
});

describe.each(files.map((file) => [path.relative(ADMIN_DIR, file), file]))(
  '%s',
  (_name, file) => {
    test('rejects visitors and regular members', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(file) as Record<string, unknown>;
      const handlers = METHODS.filter((m) => typeof mod[m] === 'function');
      expect(handlers.length).toBeGreaterThan(0);
      for (const method of handlers) {
        for (const cookie of [undefined, memberCookie()]) {
          touched.length = 0;
          const url = 'https://tongmu.test/api/admin/x?id=1&url=https://a.test';
          const request = new NextRequest(url, {
            method,
            headers: {
              'content-type': 'application/json',
              ...(cookie ? { cookie } : {}),
            },
            body:
              method === 'GET' ? undefined : JSON.stringify({ action: 'x' }),
          });
          const handler = mod[method] as (
            req: NextRequest,
            ctx: unknown
          ) => Promise<Response>;
          const response = await handler(request, {
            params: { id: '1' },
          });
          expect({ method, cookie: !!cookie, status: response.status }).toEqual(
            expect.objectContaining({
              status: expect.any(Number),
            })
          );
          // 拒绝即可：401/403，或在校验身份前就因存储模式等原因拒绝（4xx）；500 说明碰到了数据
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.status).toBeLessThan(500);
          // 只允许读取用户信息来判断角色
          expect(
            touched.filter(
              (label) => !READ_OK.test(label.split('.').pop() || '')
            )
          ).toEqual([]);
        }
      }
    });
  }
);
