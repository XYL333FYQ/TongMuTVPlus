import { cleanup, render } from '@testing-library/react';

import MobileGestures from './MobileGestures';

let pathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

// 手机触屏：粗指针 + 窄屏
function phoneTouch(matches: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches:
      matches &&
      (query === '(pointer: coarse)' || query === '(max-width: 767px)'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
    onchange: null,
  }));
}

function touchstartListeners(spy: jest.SpyInstance) {
  return spy.mock.calls.filter(([type]) => type === 'touchstart').length;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  document.documentElement.removeAttribute('data-tm-platform');
  pathname = '/';
});

describe('MobileGestures 下拉刷新按端启用', () => {
  it('App（安卓壳/主屏幕应用）里的浏览页启用自制下拉刷新', () => {
    document.documentElement.setAttribute('data-tm-platform', 'app');
    phoneTouch(true);
    const spy = jest.spyOn(document, 'addEventListener');
    render(<MobileGestures />);
    expect(touchstartListeners(spy)).toBe(1);
  });

  it('手机浏览器里不启用：保留浏览器自带的下拉刷新', () => {
    document.documentElement.setAttribute('data-tm-platform', 'web');
    phoneTouch(true);
    const spy = jest.spyOn(document, 'addEventListener');
    render(<MobileGestures />);
    expect(touchstartListeners(spy)).toBe(0);
  });

  it('电脑客户端里不启用', () => {
    document.documentElement.setAttribute('data-tm-platform', 'desktop');
    phoneTouch(true);
    const spy = jest.spyOn(document, 'addEventListener');
    render(<MobileGestures />);
    expect(touchstartListeners(spy)).toBe(0);
  });

  it('App 里但不在浏览型页面（如播放页）不启用', () => {
    document.documentElement.setAttribute('data-tm-platform', 'app');
    phoneTouch(true);
    pathname = '/play';
    const spy = jest.spyOn(document, 'addEventListener');
    render(<MobileGestures />);
    expect(touchstartListeners(spy)).toBe(0);
  });

  it('App 里但不是手机触屏（如平板外接鼠标）不启用', () => {
    document.documentElement.setAttribute('data-tm-platform', 'app');
    phoneTouch(false);
    const spy = jest.spyOn(document, 'addEventListener');
    render(<MobileGestures />);
    expect(touchstartListeners(spy)).toBe(0);
  });
});
