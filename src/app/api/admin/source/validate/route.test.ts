/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: () => ({ username: 'owner', role: 'owner' }),
}));
jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(),
  API_CONFIG: { search: { headers: {} } },
}));

import { NextRequest } from 'next/server';

import { getConfig } from '@/lib/config';

import { GET } from './route';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

async function events(sources: Array<{ key: string; api: string }>) {
  (getConfig as jest.Mock).mockResolvedValue({ SourceConfig: sources });
  const response = await GET(
    new NextRequest('https://tongmu.test/api/admin/source/validate?q=test')
  );
  // text() 只有在流关闭后才会返回
  const text = await response.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/^data: /, '')).type);
}

test('with no configured sources the stream still completes and closes', async () => {
  await expect(events([])).resolves.toEqual(['start', 'complete']);
});

test('each source reports its result before the single completion event', async () => {
  global.fetch = jest.fn(
    async () => new Response(JSON.stringify({ list: [{ vod_name: 'test' }] }))
  ) as typeof fetch;
  await expect(
    events([
      { key: 'a', api: 'https://a.test' },
      { key: 'b', api: 'https://b.test' },
    ])
  ).resolves.toEqual(['start', 'source_result', 'source_result', 'complete']);
});
