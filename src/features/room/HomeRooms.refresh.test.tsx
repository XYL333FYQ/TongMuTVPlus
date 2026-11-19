import { act, render, screen } from '@testing-library/react';

import { refreshPage } from '@/lib/page-refresh';

import HomeRooms from './HomeRooms';

let mockViewer = 'alice';
const mockContext = {
  isEnabled: true,
  currentRoom: null,
  config: { serverType: 'internal' },
};
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockContext,
}));
jest.mock('@/lib/client-memory', () => ({
  clientMemoryScope: () => mockViewer,
}));
const originalFetch = global.fetch;
const mockFetch = jest.fn();
const response = (name: string) => ({
  ok: true,
  json: async () => ({ rooms: [{ id: 'fixture', name, memberCount: 2 }] }),
});

beforeEach(() => {
  jest.useFakeTimers();
  document.documentElement.dataset.tmPlatform = 'app';
  mockViewer = 'alice';
  mockContext.isEnabled = true;
  mockContext.config.serverType = 'internal';
  mockFetch.mockReset().mockResolvedValueOnce(response('原摘要'));
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  delete document.documentElement.dataset.tmPlatform;
  jest.useRealTimers();
});

test('app refresh requests current room summaries and retains content while waiting', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  await act(async () => {
    render(<HomeRooms />);
  });
  let pending!: ReturnType<typeof refreshPage>;
  await act(async () => {
    pending = refreshPage('/');
  });
  expect(screen.getByText('原摘要')).toBeInTheDocument();
  expect(mockFetch).toHaveBeenLastCalledWith(
    '/api/rooms?mode=mine',
    expect.objectContaining({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
  );
  await act(async () => finish(response('新摘要')));
  expect(await pending).toBe('success');
  expect(screen.getByText('新摘要')).toBeInTheDocument();
});

test('failed manual refresh keeps the summary without a duplicate inline failure', async () => {
  mockFetch.mockResolvedValueOnce({ ok: false });
  await act(async () => {
    render(<HomeRooms />);
  });
  await act(async () => expect(await refreshPage('/')).toBe('failed'));
  expect(screen.getByText('原摘要')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('leaving aborts manual refresh even if the transport delivers a late response', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  const view = render(<HomeRooms />);
  await act(async () => undefined);
  let pending!: ReturnType<typeof refreshPage>;
  await act(async () => {
    pending = refreshPage('/');
  });
  const signal = mockFetch.mock.calls[1][1].signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  expect(await pending).toBe('cancelled');
  await act(async () => finish(response('迟到摘要')));
});

test('a previous initial request cannot overwrite a completed manual refresh', async () => {
  mockFetch.mockReset();
  let initial!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise((resolve) => (initial = resolve)));
  mockFetch.mockResolvedValueOnce(response('刷新摘要'));
  render(<HomeRooms />);
  await act(async () => expect(await refreshPage('/')).toBe('success'));
  await act(async () => initial(response('旧请求')));
  expect(screen.getByText('刷新摘要')).toBeInTheDocument();
});

test('a canceled refresh cannot block the next signed-in account initial load', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  const view = render(<HomeRooms />);
  await act(async () => undefined);
  let pending!: ReturnType<typeof refreshPage>;
  await act(async () => {
    pending = refreshPage('/');
  });
  await act(async () => view.rerender(<HomeRooms guest />));
  expect(await pending).toBe('cancelled');
  mockViewer = 'bob';
  mockFetch.mockResolvedValueOnce(response('Bob 摘要'));
  await act(async () => view.rerender(<HomeRooms />));
  expect(screen.getByText('Bob 摘要')).toBeInTheDocument();
  await act(async () => finish(response('Alice 迟到摘要')));
  expect(screen.getByText('Bob 摘要')).toBeInTheDocument();
  expect(screen.queryByText('Alice 迟到摘要')).not.toBeInTheDocument();
});

test('changing accounts during refresh cannot publish the old account response', async () => {
  mockFetch.mockImplementationOnce(async () => {
    mockViewer = 'bob';
    return response('Alice 私人摘要');
  });
  await act(async () => {
    render(<HomeRooms />);
  });
  await act(async () => expect(await refreshPage('/')).toBe('failed'));
  expect(screen.queryByText('Alice 私人摘要')).not.toBeInTheDocument();
  expect(screen.getByText('原摘要')).toBeInTheDocument();
});

test('the existing poll pauses during manual refresh and resumes afterward', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  mockFetch.mockResolvedValue(response('后续轮询'));
  await act(async () => {
    render(<HomeRooms />);
  });
  let pending!: ReturnType<typeof refreshPage>;
  await act(async () => {
    pending = refreshPage('/');
  });
  await act(async () => jest.advanceTimersByTime(15000));
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => finish(response('手动摘要')));
  expect(await pending).toBe('success');
  await act(async () => jest.advanceTimersByTime(15000));
  expect(mockFetch).toHaveBeenCalledTimes(3);
  expect(screen.getByText('后续轮询')).toBeInTheDocument();
});

test.each(['guest', 'external', 'disabled'])(
  '%s does not register private rooms refresh or issue requests',
  async (mode) => {
    mockContext.isEnabled = mode !== 'disabled';
    mockContext.config.serverType =
      mode === 'external' ? 'external' : 'internal';
    render(<HomeRooms guest={mode === 'guest'} />);
    expect(await refreshPage('/')).toBe('unavailable');
    expect(mockFetch).not.toHaveBeenCalled();
  }
);

test.each(['web', 'desktop'])(
  '%s retains existing polling without app refresh registration',
  async (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    mockFetch.mockResolvedValue(response('普通轮询'));
    await act(async () => {
      render(<HomeRooms />);
    });
    expect(await refreshPage('/')).toBe('unavailable');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(15000));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }
);
