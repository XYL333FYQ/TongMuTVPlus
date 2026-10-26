import { act, cleanup, render, screen } from '@testing-library/react';

import { useUnreadNotificationCount } from './useUnreadNotificationCount';

function Counter({ name = 'owner' }: { name?: string }) {
  const count = useUnreadNotificationCount(name);
  return <span data-testid='count'>{count}</span>;
}

const originalFetch = global.fetch;
let hidden = false;
let count = 0;
beforeEach(() => {
  jest.useFakeTimers();
  hidden = false;
  count = 0;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  global.fetch = jest.fn().mockImplementation(async () => ({
    ok: true,
    json: async () => ({ unreadCount: count }),
  }));
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  global.fetch = originalFetch;
  Reflect.deleteProperty(document, 'hidden');
});
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

test('two avatars share one request and both update every 30 seconds', async () => {
  render(
    <>
      <Counter />
      <Counter />
    </>
  );
  await flush();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  count = 2;
  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(screen.getAllByTestId('count').map((el) => el.textContent)).toEqual([
    '2',
    '2',
  ]);
});

test('hidden pages pause requests, returning refreshes immediately, unmount stops polling', async () => {
  const view = render(<Counter />);
  await flush();
  hidden = true;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(60000);
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  hidden = false;
  count = 3;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(screen.getByTestId('count')).toHaveTextContent('3');
  view.unmount();
  act(() => {
    jest.advanceTimersByTime(60000);
    window.dispatchEvent(new Event('focus'));
  });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('read events and window focus refresh the shared count without waiting', async () => {
  render(<Counter />);
  await flush();
  count = 4;
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(screen.getByTestId('count')).toHaveTextContent('4');
  count = 0;
  await act(async () => {
    window.dispatchEvent(new Event('notificationsUpdated'));
  });
  expect(screen.getByTestId('count')).toHaveTextContent('0');
});

test('guests do not poll and slow requests do not overlap', async () => {
  const guest = render(<Counter name='' />);
  await flush();
  expect(global.fetch).not.toHaveBeenCalled();
  guest.unmount();
  (global.fetch as jest.Mock).mockImplementation(
    () =>
      new Promise(() => {
        /* 模拟仍未返回的网络请求。 */
      })
  );
  render(<Counter />);
  act(() => {
    jest.advanceTimersByTime(90000);
    window.dispatchEvent(new Event('focus'));
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
