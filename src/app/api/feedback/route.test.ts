/** @jest-environment ./src/test/node-web-environment.cjs */
// 反馈列表：成员要看全部（?all=1）时，在读出任何反馈之前就被拦下。
const getGlobalValue = jest.fn(async () => '[]');
jest.mock('@/lib/db', () => ({
  db: {
    getUserInfoV2: async (name: string) =>
      name === 'alice' ? { role: 'user', banned: false } : null,
  },
  getStorage: () => ({ getGlobalValue }),
}));

// jest 读不懂 nanoid 的 ESM，反馈接口只在提交时用到它
jest.mock('nanoid', () => ({ nanoid: () => 'id' }));

import { NextRequest } from 'next/server';

import { GET } from './route';

process.env.USERNAME = 'boss';
process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';

function request(username: string, all: boolean) {
  return new NextRequest(
    `https://tongmu.test/api/feedback${all ? '?all=1' : ''}`,
    {
      headers: {
        cookie:
          'auth=' +
          encodeURIComponent(
            JSON.stringify({ username, role: 'user', timestamp: Date.now() })
          ),
      },
    }
  );
}

beforeEach(() => getGlobalValue.mockClear());

test('a member asking for everyone’s feedback is refused before any is read', async () => {
  const response = await GET(request('alice', true));
  expect(response.status).toBe(403);
  expect(getGlobalValue).not.toHaveBeenCalled();
});

test('a member still reads their own feedback', async () => {
  const response = await GET(request('alice', false));
  expect(response.status).toBe(200);
  expect(getGlobalValue).toHaveBeenCalledTimes(1);
});
