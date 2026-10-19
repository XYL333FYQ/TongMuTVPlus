import { act, fireEvent, render, screen } from '@testing-library/react';

import Toast from './Toast';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('manual dismissal near expiry calls onClose only once', () => {
  const onClose = jest.fn();
  render(<Toast message='已保存' duration={1000} onClose={onClose} />);
  act(() => jest.advanceTimersByTime(900));
  fireEvent.click(screen.getByRole('button'));
  act(() => jest.advanceTimersByTime(1500));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('unmount clears the pending dismissal callback', () => {
  const onClose = jest.fn();
  const view = render(
    <Toast message='已保存' duration={1000} onClose={onClose} />
  );
  act(() => jest.advanceTimersByTime(1000));
  view.unmount();
  act(() => jest.runOnlyPendingTimers());
  expect(onClose).not.toHaveBeenCalled();
});

test('a new message gets its own visible lifetime and cancels old dismissal', () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <Toast message='第一条提示' duration={1000} onClose={onClose} />
  );
  act(() => jest.advanceTimersByTime(1000));
  rerender(<Toast message='第二条提示' duration={1000} onClose={onClose} />);
  expect(screen.getByRole('status')).toHaveTextContent('第二条提示');
  act(() => jest.advanceTimersByTime(500));
  expect(onClose).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1000));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('changing callback identity does not indefinitely extend a toast', () => {
  const previous = jest.fn();
  const latest = jest.fn();
  const { rerender } = render(
    <Toast message='已保存' duration={1000} onClose={previous} />
  );
  act(() => jest.advanceTimersByTime(800));
  rerender(<Toast message='已保存' duration={1000} onClose={latest} />);
  act(() => jest.advanceTimersByTime(600));
  expect(previous).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(1);
});

test('errors announce as alerts and other messages as status', () => {
  const { rerender } = render(<Toast message='下载失败' type='error' />);
  expect(screen.getByRole('alert')).toHaveTextContent('下载失败');
  rerender(<Toast message='下载完成' type='success' />);
  expect(screen.getByRole('status')).toHaveTextContent('下载完成');
  expect(screen.getByRole('button', { name: '关闭提示' })).toBeInTheDocument();
});

test('notification escapes a transformed page container to stay in the viewport', () => {
  const { container } = render(
    <div style={{ transform: 'translateY(700px)' }}>
      <Toast message='已保存' />
    </div>
  );
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(container).not.toContainElement(screen.getByRole('status'));
});
