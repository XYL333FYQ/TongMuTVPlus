import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { ReactNode } from 'react';

import LoginPage from './page';

const params = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => params,
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));
jest.mock('@/components/SiteProvider', () => ({
  useSite: () => ({ siteName: '桐木' }),
}));
jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('@/components/auth/AuthVersion', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));

const originalFetch = global.fetch;
const originalAbortController = global.AbortController;
const originalExec = Object.getOwnPropertyDescriptor(document, 'execCommand');
const link = 'https://t.me/fixture_bot?start=fixture_login';
let fetchMock: jest.Mock;
let openMock: jest.SpyInstance;
let status: string;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});
beforeEach(() => {
  jest.useFakeTimers();
  params.delete('redirect');
  localStorage.clear();
  document.documentElement.dataset.tmPlatform = 'app';
  window.TMShell = { supportsExternalLinks: () => true };
  delete window.TMDesktop;
  Object.defineProperty(window, 'RUNTIME_CONFIG', {
    configurable: true,
    value: { STORAGE_TYPE: 'd1', ENABLE_TELEGRAM_LOGIN: true },
  });
  status = 'pending';
  fetchMock = jest.fn(async (input: string) => ({
    ok: true,
    json: async () =>
      input.includes('/create')
        ? { token: 'fixture_token', deepLink: link }
        : { status },
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  openMock = jest.spyOn(window, 'open').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  openMock.mockRestore();
  global.fetch = originalFetch;
  Object.defineProperty(global, 'AbortController', {
    configurable: true,
    writable: true,
    value: originalAbortController,
  });
  delete window.TMShell;
  delete window.TMDesktop;
  delete document.documentElement.dataset.tmPlatform;
  if (originalExec)
    Object.defineProperty(document, 'execCommand', originalExec);
  else Reflect.deleteProperty(document, 'execCommand');
});
async function start() {
  render(<LoginPage />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '使用 Telegram 登录' }));
  });
}

test.each(['app', 'desktop'])(
  '%s waits for an explicit link action after preparing the challenge',
  async (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    if (platform === 'desktop') window.TMDesktop = { externalLinks: true };
    await start();
    expect(openMock).not.toHaveBeenCalled();
    const open = screen.getByRole('button', { name: '打开 Telegram' });
    expect(screen.getAllByRole('button', { name: /Telegram/ })).toHaveLength(1);
    expect(open).toHaveAccessibleDescription(
      '登录请求已就绪，请打开 Telegram 确认。'
    );
    expect(screen.getByRole('status')).toHaveTextContent('登录请求已就绪');
    fireEvent.click(open);
    expect(openMock).toHaveBeenCalledWith(
      link,
      '_blank',
      'noopener,noreferrer'
    );
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/create'))
    ).toHaveLength(1);
  }
);

test('old App exposes a copy action without replacing the login page', async () => {
  window.TMShell = {};
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  await start();
  expect(openMock).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: '复制 Telegram 登录链接' })
    );
  });
  expect(writeText).toHaveBeenCalledWith(link);
  expect(openMock).not.toHaveBeenCalled();
});

test('expiry also dismisses a manual-copy dialog containing the invalid login link', async () => {
  window.TMShell = {};
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockRejectedValue(new Error('Denied')) },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: jest.fn(() => false),
  });
  await start();
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: '复制 Telegram 登录链接' })
    );
  });
  expect(screen.getByRole('dialog', { name: '复制链接' })).toBeInTheDocument();
  status = 'expired';
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(
    screen.queryByRole('dialog', { name: '复制链接' })
  ).not.toBeInTheDocument();
});

test('ordinary web retains its automatic open and adds no client action', async () => {
  document.documentElement.dataset.tmPlatform = 'web';
  delete window.TMShell;
  await start();
  expect(openMock).toHaveBeenCalledWith(link, '_blank', 'noopener,noreferrer');
  expect(
    screen.queryByRole('button', { name: '打开 Telegram' })
  ).not.toBeInTheDocument();
});

test.each(['denied', 'expired'])(
  '%s removes the now-invalid link and allows a new login request',
  async (state) => {
    await start();
    expect(
      screen.getByRole('button', { name: '打开 Telegram' })
    ).toBeInTheDocument();
    status = state;
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(
      screen.queryByRole('button', { name: '打开 Telegram' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '使用 Telegram 登录' })
    ).toBeEnabled();
  }
);

test('timeout removes the client link and permits retry', async () => {
  await start();
  jest.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(
    screen.queryByRole('button', { name: '打开 Telegram' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '使用 Telegram 登录' })
  ).toBeEnabled();
});

test('a failed create request leaves a retryable login button', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 503,
    json: async () => ({ error: '受控请求失败' }),
  });
  await start();
  expect(
    screen.getByRole('button', { name: '使用 Telegram 登录' })
  ).toBeEnabled();
  expect(openMock).not.toHaveBeenCalled();
});

test('malformed challenge does not open a blank window or start polling', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token: 'fixture_token' }),
  });
  await start();
  expect(openMock).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '使用 Telegram 登录' })
  ).toBeEnabled();
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('leaving during challenge preparation aborts it and ignores its late reply', async () => {
  let complete!: (value: unknown) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  const view = render(<LoginPage />);
  fireEvent.click(screen.getByRole('button', { name: '使用 Telegram 登录' }));
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    complete({
      ok: true,
      json: async () => ({ token: 'fixture_token', deepLink: link }),
    });
  });
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(openMock).not.toHaveBeenCalled();
});

test('slow status requests do not overlap and leaving aborts the active request', async () => {
  await start();
  let complete!: (value: unknown) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
  cleanup();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    complete({ ok: true, json: async () => ({ status: 'denied' }) });
  });
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each(['app', 'web'])(
  '%s still prepares a login when AbortController is absent',
  async (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    Object.defineProperty(global, 'AbortController', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    await start();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
    if (platform === 'app')
      expect(
        screen.getByRole('button', { name: '打开 Telegram' })
      ).toBeEnabled();
    else
      expect(openMock).toHaveBeenCalledWith(
        link,
        '_blank',
        'noopener,noreferrer'
      );
  }
);

test('without network-abort support, a late create reply still cannot open a page or start polling after leave', async () => {
  document.documentElement.dataset.tmPlatform = 'web';
  Object.defineProperty(global, 'AbortController', {
    configurable: true,
    writable: true,
    value: undefined,
  });
  let complete!: (value: unknown) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  const view = render(<LoginPage />);
  fireEvent.click(screen.getByRole('button', { name: '使用 Telegram 登录' }));
  view.unmount();
  await act(async () => {
    complete({
      ok: true,
      json: async () => ({ token: 'fixture_token', deepLink: link }),
    });
  });
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(openMock).not.toHaveBeenCalled();
});
