/** @jest-environment jsdom */
import { getPlatform, PLATFORM_BOOT_SCRIPT } from './platform';

type TestWindow = Window & {
  TMShell?: unknown;
  __tmDesktopInit?: boolean;
  TMDesktop?: unknown;
};

function boot({
  userAgent,
  standalone = false,
  iosStandalone = false,
  shell = false,
  desktop = false,
}: {
  userAgent?: string;
  standalone?: boolean;
  iosStandalone?: boolean;
  shell?: boolean;
  desktop?: boolean;
}) {
  const win = window as TestWindow;
  document.documentElement.removeAttribute('data-tm-platform');
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: userAgent || 'Mozilla/5.0 Chrome/120',
  });
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: iosStandalone ? true : undefined,
  });
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: standalone && query.includes('standalone'),
    media: query,
  }));
  if (shell) win.TMShell = {};
  else delete win.TMShell;
  if (desktop) win.__tmDesktopInit = true;
  else delete win.__tmDesktopInit;
  delete win.TMDesktop;
  new Function(PLATFORM_BOOT_SCRIPT)();
  return document.documentElement.getAttribute('data-tm-platform');
}

test('普通浏览器是 web，哪怕是手机宽度的触屏', () => {
  expect(boot({})).toBe('web');
  expect(getPlatform()).toBe('web');
});

test('安卓壳按 UA 或 TMShell 认出，是 app', () => {
  expect(boot({ userAgent: 'Mozilla/5.0 TongMuTVPlusAndroid WebView' })).toBe(
    'app'
  );
  expect(boot({ shell: true })).toBe('app');
  expect(getPlatform()).toBe('app');
});

test('电脑客户端按初始化脚本认出，是 desktop', () => {
  expect(boot({ desktop: true })).toBe('desktop');
  expect(getPlatform()).toBe('desktop');
});

test('安装到主屏幕的网页应用是 app（含 iOS 的 navigator.standalone）', () => {
  expect(boot({ standalone: true })).toBe('app');
  expect(boot({ iosStandalone: true })).toBe('app');
});

test('电脑客户端优先于独立窗口判断；安卓壳优先于电脑客户端标记', () => {
  expect(boot({ desktop: true, standalone: true })).toBe('desktop');
  expect(boot({ shell: true, desktop: true })).toBe('app');
});

test('判断过程抛错时不写标记，getPlatform 回落到 web', () => {
  document.documentElement.removeAttribute('data-tm-platform');
  window.matchMedia = (() => {
    throw new Error('boom');
  }) as unknown as typeof window.matchMedia;
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 Chrome/120',
  });
  delete (window as TestWindow).TMShell;
  delete (window as TestWindow).__tmDesktopInit;
  new Function(PLATFORM_BOOT_SCRIPT)();
  expect(getPlatform()).toBe('web');
});
