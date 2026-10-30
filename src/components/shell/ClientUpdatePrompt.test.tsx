import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import ClientUpdatePrompt, { CHECK_EVENT } from './ClientUpdatePrompt';

const ANDROID_UA =
  'Mozilla/5.0 TongMuTVPlusAndroid WebView TMBuild/202610301000';

function setUa(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value,
    configurable: true,
  });
}

function mockFetch(latest: string | null) {
  // jsdom 没有 Response，用最小的响应对象
  const reply = (ok: boolean, body: unknown) => ({
    ok,
    json: async () => body,
  });
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    if (String(input).startsWith('/api/client-update'))
      return reply(true, {
        build: latest,
        url: latest ? 'https://dl.test/TongMuTV-Plus-Android.apk' : null,
      });
    return reply(false, {});
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.useFakeTimers();
  window.matchMedia = jest.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  delete (window as { TMShell?: unknown }).TMShell;
});

async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(4100);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

test('普通浏览器里不请求也不弹窗', async () => {
  setUa('Mozilla/5.0 Chrome');
  mockFetch('202610301530');
  render(<ClientUpdatePrompt />);
  await flush();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('安卓壳落后：弹出新版本提示，点立即更新交给壳去下载安装', async () => {
  setUa(ANDROID_UA);
  mockFetch('202610301530');
  const install = jest.fn();
  window.TMShell = { installUpdate: install };
  render(<ClientUpdatePrompt />);
  await flush();
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByText('立即更新'));
  expect(install).toHaveBeenCalledWith(
    'https://dl.test/TongMuTV-Plus-Android.apk'
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('点稍后后不再弹，手动检查仍然可以看到', async () => {
  setUa(ANDROID_UA);
  mockFetch('202610301530');
  render(<ClientUpdatePrompt />);
  await flush();
  fireEvent.click(await screen.findByText('稍后'));
  expect(screen.queryByRole('dialog')).toBeNull();

  cleanup();
  render(<ClientUpdatePrompt />);
  await flush();
  expect(screen.queryByRole('dialog')).toBeNull();

  await act(async () => {
    window.dispatchEvent(new Event(CHECK_EVENT));
    await Promise.resolve();
  });
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

test('已是最新版本：不弹窗', async () => {
  setUa(ANDROID_UA);
  mockFetch('202610301000');
  render(<ClientUpdatePrompt />);
  await flush();
  expect(screen.queryByRole('dialog')).toBeNull();
});
