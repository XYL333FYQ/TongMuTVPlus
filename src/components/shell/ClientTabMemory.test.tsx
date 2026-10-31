import { act, cleanup, fireEvent, render } from '@testing-library/react';

import { clearClientMemory } from '@/lib/client-memory';
import { getPlatform } from '@/lib/platform';
import {
  prepareTabNavigation,
  rememberTabVisit,
  savedTabVisit,
  takeTabRestore,
} from '@/lib/tab-memory';

import ClientTabMemory from './ClientTabMemory';

let mockPath = '/search';
let mockSearch = 'q=电影';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock('@/lib/platform', () => ({ getPlatform: jest.fn() }));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'alice' }),
}));
const originalObserver = window.ResizeObserver;
const originalHeight = Object.getOwnPropertyDescriptor(
  document.body,
  'scrollHeight'
);
let resized: () => void = () => undefined;
let height = 100;
beforeEach(() => {
  jest.useFakeTimers();
  clearClientMemory();
  takeTabRestore('');
  (getPlatform as jest.Mock).mockReturnValue('app');
  mockPath = '/search';
  mockSearch = 'q=电影';
  height = 100;
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    writable: true,
    value: 0,
  });
  Object.defineProperty(document.body, 'scrollHeight', {
    configurable: true,
    get: () => height,
  });
  jest
    .spyOn(window, 'scrollTo')
    .mockImplementation((options: ScrollToOptions | number) => {
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        value: typeof options === 'object' ? options.top || 0 : 0,
      });
    });
  window.ResizeObserver = class {
    constructor(callback: () => void) {
      resized = callback;
    }
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
  window.ResizeObserver = originalObserver;
  if (originalHeight)
    Object.defineProperty(document.body, 'scrollHeight', originalHeight);
  else Reflect.deleteProperty(document.body, 'scrollHeight');
});

function waitingTab() {
  rememberTabVisit('/search?q=电影', 500);
  prepareTabNavigation('/search');
  render(<ClientTabMemory />);
  act(() => jest.advanceTimersByTime(20));
}

test('tab restore waits for content, then restores once without overwriting its saved position', () => {
  waitingTab();
  expect(window.scrollTo).not.toHaveBeenCalled();
  height = 2000;
  act(() => {
    resized();
    jest.advanceTimersByTime(20);
  });
  expect(window.scrollY).toBe(500);
  expect(savedTabVisit('/search')?.top).toBe(500);
});

test('a user gesture cancels a pending restore rather than pulling them back later', () => {
  waitingTab();
  fireEvent.wheel(window);
  height = 2000;
  act(() => {
    resized();
    jest.advanceTimersByTime(9000);
  });
  expect(window.scrollTo).not.toHaveBeenCalled();
});

test('ordinary browser pages do not install custom scroll restoration', () => {
  (getPlatform as jest.Mock).mockReturnValue('web');
  render(<ClientTabMemory />);
  height = 2000;
  act(() => jest.advanceTimersByTime(9000));
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(savedTabVisit('/search')).toBeUndefined();
});
