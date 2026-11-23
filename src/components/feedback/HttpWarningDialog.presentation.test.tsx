import { act, fireEvent, render, screen } from '@testing-library/react';

import { consumeBackLayer } from '@/lib/back-layers';

import HttpWarningDialog from '@/components/feedback/HttpWarningDialog';

let mockReduced = false;
let mockRole = 'owner';
jest.mock('@/lib/motion', () => ({
  useReducedMotionSetting: () => mockReduced,
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ role: mockRole }),
}));

const originalLocation = window.location;
function location(url: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL(url),
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockReduced = false;
  mockRole = 'owner';
  location('http://qa.test/');
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

test('dismissal during the opening delay never reveals the closing panel', () => {
  const closed = jest.fn();
  render(<HttpWarningDialog onClose={closed} />);
  const button = screen.getByRole('button', { name: '我知道了' });
  const backdrop = button.closest('.tm-http-warning-backdrop');
  fireEvent.click(button);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(backdrop).not.toHaveClass('opacity-100');
  act(() => {
    jest.advanceTimersByTime(220);
  });
  expect(closed).toHaveBeenCalledTimes(1);
});

test('repeated dismissal closes once after the panel exit', () => {
  const closed = jest.fn();
  render(<HttpWarningDialog onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  const button = screen.getByRole('button', { name: '我知道了' });
  fireEvent.click(button);
  fireEvent.click(button);
  act(() => {
    jest.advanceTimersByTime(120);
  });
  expect(closed).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(closed).toHaveBeenCalledTimes(1);
});

test('unmount cancels an outstanding close callback', () => {
  const closed = jest.fn(),
    { unmount } = render(<HttpWarningDialog onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  fireEvent.click(screen.getByRole('button', { name: '我知道了' }));
  unmount();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(closed).not.toHaveBeenCalled();
});

test('reduced motion finishes the exit within 120 milliseconds', () => {
  mockReduced = true;
  const closed = jest.fn();
  render(<HttpWarningDialog onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  fireEvent.click(screen.getByRole('button', { name: '我知道了' }));
  act(() => {
    jest.advanceTimersByTime(120);
  });
  expect(closed).toHaveBeenCalledTimes(1);
});

test.each([
  ['http://localhost/', 'owner'],
  ['http://127.0.0.1/', 'owner'],
  ['https://qa.test/', 'owner'],
  ['http://qa.test/', 'user'],
])('the existing visibility gate excludes %s for %s', (url, role) => {
  location(url);
  mockRole = role;
  render(<HttpWarningDialog onClose={jest.fn()} />);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(
    screen.queryByRole('button', { name: '我知道了' })
  ).not.toBeInTheDocument();
});

test('the warning opens in the default variant of the shared modal layer', () => {
  render(<HttpWarningDialog onClose={jest.fn()} />);
  const dialog = screen.getByRole('dialog', { name: 'HTTP 环境功能限制提示' });
  expect(dialog.tagName).toBe('DIALOG');
  expect(dialog).toHaveClass('tm-modal-layer');
  expect(dialog.className).not.toMatch(/tm-modal-layer--/);
});

test('Escape and the back key close the warning', () => {
  const closed = jest.fn();
  const { unmount } = render(<HttpWarningDialog onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { cancelable: true })
  );
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(closed).toHaveBeenCalledTimes(1);
  unmount();

  const backClosed = jest.fn();
  render(<HttpWarningDialog onClose={backClosed} />);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  act(() => {
    expect(consumeBackLayer()).toBe('handled');
  });
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(backClosed).toHaveBeenCalledTimes(1);
});

test('"不再提示" still writes the same storage key', () => {
  render(<HttpWarningDialog onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '不再提示' }));
  expect(localStorage.getItem('httpWarningDismissed')).toBe('true');
});
