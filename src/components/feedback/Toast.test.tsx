import { act, fireEvent, render, screen } from '@testing-library/react';

import Toast from '@/components/feedback/Toast';

test('a visible toast follows modal opening and closing without restarting its lifetime', async () => {
  const close = jest.fn();
  const result = render(<Toast message='保留原来的提示时间' onClose={close} />);
  const dialog = document.createElement('dialog');
  document.body.append(dialog);
  try {
    act(() => jest.advanceTimersByTime(1000));
    await act(async () => {
      dialog.setAttribute('open', '');
      await Promise.resolve();
    });
    expect(dialog).toContainElement(screen.getByRole('status'));
    await act(async () => {
      dialog.removeAttribute('open');
      await Promise.resolve();
    });
    expect(dialog).not.toContainElement(screen.getByRole('status'));
    expect(close).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2320));
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    result.unmount();
    dialog.remove();
  }
});

test('removing the hosting modal keeps the remaining error message in the document', async () => {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('open', '');
  document.body.append(dialog);
  const result = render(
    <Toast message='关闭下载面板后仍能阅读错误' type='error' />
  );
  try {
    await act(async () => {
      dialog.remove();
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      '关闭下载面板后仍能阅读错误'
    );
  } finally {
    result.unmount();
    dialog.remove();
  }
});

test('an error raised inside a modal remains inside the active dialog instead of the inert page', () => {
  const first = document.createElement('dialog');
  const active = document.createElement('dialog');
  first.setAttribute('open', '');
  active.setAttribute('open', '');
  document.body.append(first, active);
  const result = render(<Toast message='无法导出此下载' type='error' />);
  expect(active).toContainElement(screen.getByRole('alert'));
  expect(first).not.toContainElement(screen.getByRole('alert'));
  result.unmount();
  first.remove();
  active.remove();
});

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
