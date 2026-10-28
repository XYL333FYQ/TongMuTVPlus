jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockContext,
}));
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

import HomeRooms from '@/components/catalog/HomeRooms';
const mockContext = {
  isEnabled: true,
  currentRoom: null as null | {
    id: string;
    name: string;
    memberCount: number;
    lifecycle: string;
    currentState: { type: string; videoName: string };
  },
};
const originalFetch = global.fetch;
let mockFetch: jest.Mock;
beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
  mockContext.currentRoom = null;
  mockContext.isEnabled = true;
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});
test('with an external room server the homepage does not ask the local REST endpoint and says why', async () => {
  (mockContext as any).config = { enabled: true, serverType: 'external' };
  render(<HomeRooms />);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      '当前使用外部观影室服务'
    )
  );
  expect(mockFetch).not.toHaveBeenCalled();
  delete (mockContext as any).config;
});
test('guest homepage omits personal rooms and never requests private room data', () => {
  const { container } = render(<HomeRooms guest />);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
});
test('shows real membership, deduplicates the current room, and aborts on unmount', async () => {
  mockContext.currentRoom = {
    id: 'a',
    name: '当前房间',
    memberCount: 2,
    lifecycle: 'active',
    currentState: { type: 'play', videoName: '影片甲' },
  };
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      rooms: [
        { id: 'a', name: '当前房间', memberCount: 2, lifecycle: 'active' },
        { id: 'b', name: '休眠房间', memberCount: 0, lifecycle: 'sleeping' },
        { id: 'c', name: '其他房间', memberCount: 1, lifecycle: 'active' },
      ],
    }),
  });
  const { unmount } = render(<HomeRooms />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  expect(screen.getAllByText('当前房间')).toHaveLength(1);
  expect(screen.getByText('2 人在线')).toBeInTheDocument();
  expect(screen.getByText('正在播放 影片甲')).toBeInTheDocument();
  expect(screen.queryByText('休眠房间')).not.toBeInTheDocument();
  expect(screen.queryByText('其他房间')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /当前房间/ })).toHaveAttribute(
    'href',
    '/watch-room?room=a'
  );
  expect(screen.getByRole('link', { name: /管理房间/ })).toHaveAttribute(
    'href',
    '/watch-room'
  );
  const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
});
test('a failed request reports failure instead of inventing room data', async () => {
  mockFetch.mockRejectedValue(new Error('offline'));
  render(<HomeRooms />);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('房间列表暂时无法刷新')
  );
  expect(screen.getByRole('link', { name: /管理房间/ })).toBeInTheDocument();
  expect(screen.queryByText('和朋友一起看')).not.toBeInTheDocument();
});

test('a successful empty response becomes a small creation shortcut without a room shelf', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ rooms: [] }) });
  const { container } = render(<HomeRooms />);
  await waitFor(() =>
    expect(
      screen.queryByRole('heading', { name: '我的房间' })
    ).not.toBeInTheDocument()
  );
  expect(container.querySelector('.tm-home-room-empty')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /创建房间/ })).toHaveAttribute(
    'href',
    '/watch-room'
  );
});

test('loading is distinct from an empty result and uses a compact placeholder', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  render(<HomeRooms />);
  expect(
    screen.getByRole('status', { name: '正在加载房间' })
  ).toBeInTheDocument();
  await act(async () =>
    finish({ ok: true, json: async () => ({ rooms: [] }) })
  );
  expect(
    screen.queryByRole('status', { name: '正在加载房间' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: '我的房间' })
  ).not.toBeInTheDocument();
});

test('a disabled room service remains explicit and does not request memberships', () => {
  mockContext.isEnabled = false;
  render(<HomeRooms />);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('房间服务未启用');
});

test('a service enabled after configuration starts in loading rather than the empty shortcut', async () => {
  mockContext.isEnabled = false;
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const { rerender } = render(<HomeRooms />);
  mockContext.isEnabled = true;
  rerender(<HomeRooms />);
  expect(
    screen.getByRole('status', { name: '正在加载房间' })
  ).toBeInTheDocument();
  expect(screen.queryByText('和朋友一起看')).not.toBeInTheDocument();
  await act(async () =>
    finish({ ok: true, json: async () => ({ rooms: [] }) })
  );
  expect(screen.getByRole('link', { name: /创建房间/ })).toBeInTheDocument();
});
