/** @jest-environment ./src/test/node-web-environment.cjs */
import { NextRequest } from 'next/server';

import { GET } from './route';

const call = (platform: string) =>
  GET(
    new NextRequest(
      `https://tongmu.test/api/client-update?platform=${platform}`
    )
  );

afterEach(() => {
  jest.restoreAllMocks();
});

test('不支持的平台返回 400', async () => {
  expect((await call('tv')).status).toBe(400);
});

test('读到清单：返回最新构建时间和固定文件名的下载地址', async () => {
  process.env.CLIENT_DOWNLOAD_BASE_URL = 'https://dl.tongmu.test/clients';
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ build: '202610301530', file: '../evil.apk' }),
        { status: 200 }
      )
    );
  const data = await (await call('android')).json();
  expect(data).toEqual({
    build: '202610301530',
    url: 'https://dl.tongmu.test/clients/TongMuTV-Plus-Android.apk',
  });
  delete process.env.CLIENT_DOWNLOAD_BASE_URL;
});

test('读不到清单或内容异常：当作没有新版本，不报错', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
  expect(await (await call('windows')).json()).toEqual({
    build: null,
    url: null,
  });
});
