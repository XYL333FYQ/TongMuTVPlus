/** @jest-environment ./src/test/node-web-environment.cjs */
// 接口权限“现在的行为”快照：做角色或封禁检查的每个接口、每个方法，
// 用五种来访者（未登录、成员、被封禁的成员、管理员、站长）各请求一次，记下状态码和报错文字。
//
//   TM_RECORD_AUTH=1 pnpm test src/app/api/auth-behaviour.test.ts   重新记录 auth-behaviour.json
//   pnpm test src/app/api/auth-behaviour.test.ts                    和记录比较
//
// 比较规则（docs/plan/2026-11-23-phase2-shared-parts-plan.md P2-D1）：状态码必须相同；
// 报错文字：没登录的来访者只许变成 Unauthorized（原来是的必须还是，前端靠这个词自动续登录）；
// 已登录却被拒绝的只许变成三句统一的中文。
// 被拒绝（401 / 403）的请求不许碰到任何写操作。
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const touched: string[] = [];
const READ_OK = /^(get|has|check|verify|is)/;

type Row = { role: 'owner' | 'admin' | 'user'; banned: boolean };
const USERS: Record<string, Row> = {
  alice: { role: 'user', banned: false },
  bob: { role: 'user', banned: true },
  carol: { role: 'admin', banned: false },
  // 数据库初始化时站长也写进用户表（scripts/init-sqlite.js）
  boss: { role: 'owner', banned: false },
};

function recorder(label: string): unknown {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== 'string' || key === 'then') return undefined;
        if (key === 'getUserInfoV2')
          return async (name: string) => {
            touched.push(label + '.' + key);
            const row = USERS[name];
            return row ? { ...row, created_at: 1 } : null;
          };
        return (..._args: unknown[]) => {
          touched.push(label + '.' + key);
          if (READ_OK.test(key)) return Promise.resolve(null);
          throw new Error('request reached ' + label + '.' + key);
        };
      },
    }
  );
}
function writer(label: string) {
  return (..._args: unknown[]) => {
    touched.push(label);
    throw new Error('request reached ' + label);
  };
}

jest.mock('@/lib/config', () => {
  const actual = jest.requireActual('@/lib/config');
  return {
    ...actual,
    getConfig: jest.fn(async () => ({
      SiteConfig: {},
      UserConfig: {
        Users: [
          { username: 'alice', role: 'user' },
          { username: 'bob', role: 'user', banned: true },
          { username: 'carol', role: 'admin' },
          { username: 'boss', role: 'owner' },
        ],
      },
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
jest.mock('cheerio/slim', () => ({ load: jest.fn() }), { virtual: true });
jest.mock('nanoid', () => ({ nanoid: () => 'id' }));
jest.mock('@/lib/db', () => ({
  db: recorder('db'),
  getStorage: () => recorder('storage'),
}));

process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
process.env.USERNAME = 'boss';
process.env.PASSWORD = 'boss-password';

const API_DIR = __dirname;
const SNAPSHOT = path.join(API_DIR, 'auth-behaviour.json');
const RECORD = process.env.TM_RECORD_AUTH === '1';
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const CALLERS = ['anonymous', 'member', 'banned', 'admin', 'owner'] as const;
type Caller = (typeof CALLERS)[number];
const LOGIN: Record<Exclude<Caller, 'anonymous'>, [string, string]> = {
  member: ['alice', 'user'],
  banned: ['bob', 'user'],
  admin: ['carol', 'admin'],
  owner: ['boss', 'owner'],
};
// P2-D1 统一后的三句；Unauthorized 不在其中，它必须原样保留
const UNIFIED = new Set(['用户不存在', '账号已被封禁', '没有权限']);

type Outcome = { status: number | 'timeout'; error: string | null };
type Snapshot = Record<string, Record<string, Record<Caller, Outcome>>>;

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === 'route.ts' ? [full] : [];
  });
}

/** 记录时的清单：管理接口全部，加上其他做角色或封禁检查的接口 */
function checkedRoutes(): string[] {
  return routeFiles(API_DIR)
    .map((file) => path.relative(API_DIR, file).split(path.sep).join('/'))
    .filter(
      (rel) =>
        rel.startsWith('admin/') ||
        /\brole\s*[!=]==\s*'(?:owner|admin)'|\bbanned\b/.test(
          fs.readFileSync(path.join(API_DIR, rel), 'utf8')
        )
    )
    .sort();
}

function cookieFor(caller: Caller) {
  if (caller === 'anonymous') return undefined;
  const [username, role] = LOGIN[caller];
  return (
    'auth=' +
    encodeURIComponent(
      JSON.stringify({
        username,
        role,
        timestamp: Date.now(),
        tokenId: 't',
        refreshToken: 'r',
        refreshExpires: Date.now() + 100000,
        signature: 'a'.repeat(64),
      })
    )
  );
}

const PARAMS = {
  id: '1',
  token: 't',
  itemId: '1',
  filename: 'a.mp4',
  source: 's',
  videoId: 'v',
  episodeIndex: '0',
  file: ['a.ts'],
};

async function call(
  handler: (req: NextRequest, ctx: unknown) => Promise<Response>,
  method: string,
  caller: Caller
): Promise<Outcome> {
  const cookie = cookieFor(caller);
  const request = new NextRequest(
    'https://tongmu.test/api/x?id=1&url=https://a.test',
    {
      method,
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify({ action: 'x' }),
    }
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), 3000);
  });
  let response: Response | 'timeout';
  try {
    response = await Promise.race([
      handler(request, { params: { ...PARAMS } }),
      timeout,
    ]);
  } catch {
    // 没被拦下、一路走到被桩挡住的写操作才会抛错，记成 500
    return { status: 500, error: 'threw' };
  } finally {
    clearTimeout(timer);
  }
  if (response === 'timeout') return { status: 'timeout', error: null };
  let error: string | null = null;
  try {
    const body = await response.clone().json();
    if (body && typeof body.error === 'string') error = body.error;
  } catch {
    // 不是 JSON（重定向、流）就不记文字
  }
  return { status: response.status, error };
}

function denied(outcome: Outcome) {
  return outcome.status === 401 || outcome.status === 403;
}

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('offline in tests'))
  ) as unknown as typeof fetch;
});

const previous: Snapshot = fs.existsSync(SNAPSHOT)
  ? (JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as Snapshot)
  : {};
const recorded: Snapshot = RECORD ? {} : previous;
// 重新记录时保留已经记过的接口：换成 requireRole 以后，源码里搜不到角色判断了，
// 但它们仍要留在快照里
const routes = RECORD
  ? [...new Set([...Object.keys(previous), ...checkedRoutes()])].sort()
  : Object.keys(recorded);

test('the snapshot covers the checked routes', () => {
  expect(routes.length).toBeGreaterThanOrEqual(60);
});

describe.each(routes)('%s', (route) => {
  test('keeps its status codes and only the agreed error texts change', async () => {
    const mod = (await import(path.join(API_DIR, route))) as Record<
      string,
      unknown
    >;
    const handlers = METHODS.filter((m) => typeof mod[m] === 'function');
    const now: Record<string, Record<Caller, Outcome>> = {};
    const problems: string[] = [];
    for (const method of handlers) {
      now[method] = {} as Record<Caller, Outcome>;
      for (const caller of CALLERS) {
        touched.length = 0;
        const outcome = await call(
          mod[method] as (req: NextRequest, ctx: unknown) => Promise<Response>,
          method,
          caller
        );
        now[method][caller] = outcome;
        const writes = touched.filter(
          (label) => !READ_OK.test(label.split('.').pop() || '')
        );
        if (denied(outcome) && writes.length)
          problems.push(`${method} ${caller}: denied but wrote ${writes}`);
        if (RECORD) continue;
        const before = recorded[route]?.[method]?.[caller];
        if (!before) {
          problems.push(`${method} ${caller}: not in the snapshot`);
          continue;
        }
        if (before.status !== outcome.status)
          problems.push(
            `${method} ${caller}: status ${before.status} → ${outcome.status}`
          );
        const sameText = before.error === outcome.error;
        // 没登录：只许变成 Unauthorized（原来有的接口说“未授权”“未登录”），原来是的必须还是；
        // 已登录却被拒绝：只许变成三句统一的中文（有的接口拿 Unauthorized 拒绝成员，
        // 前端会误以为登录失效去续登录，这正是要改掉的）
        const agreed =
          outcome.error !== null &&
          (caller === 'anonymous'
            ? outcome.status === 401 && outcome.error === 'Unauthorized'
            : UNIFIED.has(outcome.error));
        if (!sameText && !agreed)
          problems.push(
            `${method} ${caller}: error ${JSON.stringify(
              before.error
            )} → ${JSON.stringify(outcome.error)}`
          );
      }
    }
    if (!RECORD) {
      expect(Object.keys(now).sort()).toEqual(
        Object.keys(recorded[route] || {}).sort()
      );
    }
    if (RECORD) recorded[route] = now;
    expect(problems).toEqual([]);
  });
});

afterAll(() => {
  if (!RECORD) return;
  const sorted: Snapshot = {};
  for (const route of Object.keys(recorded).sort())
    sorted[route] = recorded[route];
  fs.writeFileSync(SNAPSHOT, JSON.stringify(sorted, null, 2) + '\n');
});
