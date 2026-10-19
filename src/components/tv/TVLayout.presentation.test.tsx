import { act, fireEvent, render, screen } from '@testing-library/react';

import TVLayout from './TVLayout';

let mockPathname = '/tv/private';
let reduced = false;
let navWidth = 340;
const scrollTo = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('./TVVirtualRemote', () => () => null);

beforeEach(() => {
  jest.useFakeTimers();
  mockPathname = '/tv/private';
  reduced = false;
  navWidth = 340;
  scrollTo.mockClear();
  delete document.documentElement.dataset.tmReducedMotion;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      get matches() {
        return reduced;
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollTo,
  });
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      const left = this.tagName === 'NAV' ? 16 : 700;
      const width = this.tagName === 'NAV' ? navWidth : 100;
      return {
        x: left,
        y: 20,
        left,
        right: left + width,
        top: 20,
        bottom: 64,
        width,
        height: 44,
        toJSON: () => ({}),
      };
    });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete document.documentElement.dataset.tmReducedMotion;
});

test('keeps all nine routes in their original order and identifies the current page', () => {
  render(
    <TVLayout>
      <p>内容</p>
    </TVLayout>
  );
  expect(
    screen.getAllByRole('link').map((link) => link.getAttribute('href'))
  ).toEqual([
    '/tv/search',
    '/tv',
    '/tv/movie',
    '/tv/series',
    '/tv/anime',
    '/tv/variety',
    '/tv/live',
    '/tv/private',
    '/tv/me',
  ]);
  expect(screen.getByRole('link', { name: '私人影库' })).toHaveAttribute(
    'aria-current',
    'page'
  );
});
test('reveals an offscreen selected item without moving keyboard focus', () => {
  render(
    <TVLayout>
      <button>页面操作</button>
    </TVLayout>
  );
  screen.getByRole('button', { name: '页面操作' }).focus();
  act(() => jest.runOnlyPendingTimers());
  expect(scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: 'smooth' })
  );
  expect(screen.getByRole('button', { name: '页面操作' })).toHaveFocus();
});
test.each(['system', 'site'])(
  'uses immediate scrolling for the %s reduced-motion preference',
  (mode) => {
    reduced = mode === 'system';
    if (mode === 'site')
      document.documentElement.dataset.tmReducedMotion = 'true';
    render(
      <TVLayout>
        <p>内容</p>
      </TVLayout>
    );
    act(() => jest.runOnlyPendingTimers());
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' })
    );
  }
);
test('reveals the current item when a desktop window narrows', () => {
  navWidth = 1200;
  render(
    <TVLayout>
      <p>内容</p>
    </TVLayout>
  );
  act(() => jest.runOnlyPendingTimers());
  expect(scrollTo).not.toHaveBeenCalled();
  navWidth = 340;
  fireEvent.resize(window);
  act(() => jest.runOnlyPendingTimers());
  expect(scrollTo).toHaveBeenCalled();
});
