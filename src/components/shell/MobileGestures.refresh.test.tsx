import { act, cleanup, render } from '@testing-library/react';

import { refreshPage } from '@/lib/page-refresh';

import { notify } from '@/components/feedback/AppDialogs';

import MobileGestures from './MobileGestures';

jest.mock('next/navigation', () => ({ usePathname: () => '/douban' }));
jest.mock('@/lib/platform', () => ({ getPlatform: () => 'app' }));
jest.mock('@/lib/page-refresh', () => ({ refreshPage: jest.fn() }));
jest.mock('@/lib/shell-bridge', () => ({ haptic: jest.fn() }));
jest.mock('@/components/feedback/AppDialogs', () => ({ notify: jest.fn() }));
const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')!;
const reload = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload },
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true }),
  });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  (refreshPage as jest.Mock).mockResolvedValue('success');
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', originalLocation);
  expect(reload).not.toHaveBeenCalled();
  delete document.documentElement.dataset.tmKeyboard;
});
function touch(type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'touches', {
    value:
      type === 'touchend' || type === 'touchcancel'
        ? []
        : [{ clientX: x, clientY: y }],
  });
  document.dispatchEvent(event);
}
async function pull(end = 'touchend', horizontal = false) {
  await act(async () => {
    touch('touchstart', 100, 100);
    touch('touchmove', horizontal ? 300 : 100, 250);
    touch(end, 100, 250);
  });
}

test('a completed pull refreshes page data and restores the indicator', async () => {
  const { container } = render(<MobileGestures />);
  await pull();
  expect(refreshPage).toHaveBeenCalledWith('/douban');
  expect(
    (container.querySelector('.tm-ptr') as HTMLElement).style.opacity
  ).toBe('0');
});

test('system cancellation and horizontal gestures never trigger refresh', async () => {
  render(<MobileGestures />);
  await pull('touchcancel');
  await pull('touchend', true);
  expect(refreshPage).not.toHaveBeenCalled();
});

test('keyboard and native dialogs retain their own gestures', async () => {
  render(<MobileGestures />);
  document.documentElement.dataset.tmKeyboard = 'open';
  await pull();
  delete document.documentElement.dataset.tmKeyboard;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('open', '');
  document.body.append(dialog);
  await pull();
  dialog.remove();
  expect(refreshPage).not.toHaveBeenCalled();
});

test('a pending refresh ignores another pull and exposes failure without hanging', async () => {
  let complete!: (result: string) => void;
  (refreshPage as jest.Mock).mockReturnValue(
    new Promise((resolve) => (complete = resolve))
  );
  const { container } = render(<MobileGestures />);
  await pull();
  await pull();
  expect(refreshPage).toHaveBeenCalledTimes(1);
  await act(async () => complete('failed'));
  expect(notify).toHaveBeenCalledWith('暂时无法刷新，请稍后再试。', 'error');
  expect(
    (container.querySelector('.tm-ptr') as HTMLElement).style.opacity
  ).toBe('0');
});
