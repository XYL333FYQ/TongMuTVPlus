import { act, cleanup, render } from '@testing-library/react';

import { getPlatform } from '@/lib/platform';

import KeyboardViewport from './KeyboardViewport';

jest.mock('@/lib/platform', () => ({ getPlatform: jest.fn() }));
const originalViewport = Object.getOwnPropertyDescriptor(
  window,
  'visualViewport'
);
const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
let viewport: EventTarget & { height: number; scale: number };
beforeEach(() => {
  jest.useFakeTimers();
  (getPlatform as jest.Mock).mockReturnValue('app');
  viewport = Object.assign(new EventTarget(), { height: 900, scale: 1 });
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 900,
  });
  document.documentElement.style.setProperty('--tm-visual-height', '777px');
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  if (originalViewport)
    Object.defineProperty(window, 'visualViewport', originalViewport);
  else Reflect.deleteProperty(window, 'visualViewport');
  if (originalHeight)
    Object.defineProperty(window, 'innerHeight', originalHeight);
  document
    .querySelectorAll('[data-keyboard-test]')
    .forEach((element) => element.remove());
  delete document.documentElement.dataset.tmKeyboard;
  delete document.documentElement.dataset.tmImeSource;
  document.documentElement.style.removeProperty('--tm-visual-height');
});
const flush = () => act(() => jest.advanceTimersByTime(20));
function focusInput() {
  const input = document.createElement('input');
  input.dataset.keyboardTest = '';
  document.body.append(input);
  input.focus();
  flush();
  return input;
}

test('app keyboard hides the bar only for a focused editor and substantial visible-height loss', () => {
  render(<KeyboardViewport />);
  const input = focusInput();
  viewport.height = 400;
  act(() => viewport.dispatchEvent(new Event('resize')));
  flush();
  expect(document.documentElement.dataset.tmKeyboard).toBe('open');
  input.blur();
  flush();
  expect(document.documentElement.dataset.tmKeyboard).toBeUndefined();
});

test('browser toolbar changes and pinch zoom are not treated as the keyboard', () => {
  render(<KeyboardViewport />);
  viewport.height = 700;
  act(() => viewport.dispatchEvent(new Event('resize')));
  flush();
  expect(document.documentElement.dataset.tmKeyboard).toBeUndefined();
  focusInput();
  viewport.height = 400;
  viewport.scale = 2;
  act(() => viewport.dispatchEvent(new Event('resize')));
  flush();
  expect(document.documentElement.dataset.tmKeyboard).toBeUndefined();
});

test.each(['web', 'desktop'])(
  '%s keeps its existing viewport and navigation behavior',
  (platform) => {
    (getPlatform as jest.Mock).mockReturnValue(platform);
    render(<KeyboardViewport />);
    focusInput();
    viewport.height = 400;
    act(() => viewport.dispatchEvent(new Event('resize')));
    flush();
    expect(document.documentElement.dataset.tmKeyboard).toBeUndefined();
    expect(
      document.documentElement.style.getPropertyValue('--tm-visual-height')
    ).toBe('777px');
  }
);

test('a newer native shell owns its IME marker and cleanup restores only web-owned state', () => {
  document.documentElement.dataset.tmImeSource = 'native';
  document.documentElement.dataset.tmKeyboard = 'open';
  const view = render(<KeyboardViewport />);
  flush();
  expect(document.documentElement.dataset.tmKeyboard).toBe('open');
  view.unmount();
  expect(document.documentElement.dataset.tmKeyboard).toBe('open');
  expect(
    document.documentElement.style.getPropertyValue('--tm-visual-height')
  ).toBe('777px');
});
