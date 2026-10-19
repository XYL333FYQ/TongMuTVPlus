jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockContext,
}));
import { cleanup, render, screen, waitFor } from '@testing-library/react';

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
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});
test('guest homepage never requests private room data', () => {
  render(<HomeRooms guest />);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.getByText('登录后创建和加入房间')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '创建房间' })).toHaveAttribute(
    'href',
    '/watch-room'
  );
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
  await screen.findByText('休眠房间');
  expect(screen.getAllByText('当前房间')).toHaveLength(1);
  expect(screen.getByText('2 人在线')).toBeInTheDocument();
  expect(screen.getByText('正在播放 影片甲')).toBeInTheDocument();
  expect(screen.getByText('无人在线')).toBeInTheDocument();
  expect(screen.queryByText('其他房间')).not.toBeInTheDocument();
  const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
});
test('a failed request reports failure instead of inventing room data', async () => {
  mockFetch.mockRejectedValue(new Error('offline'));
  render(<HomeRooms />);
  await waitFor(() =>
    expect(screen.getByText('房间列表暂时无法刷新')).toBeInTheDocument()
  );
  expect(screen.getByRole('link', { name: '创建房间' })).toBeInTheDocument();
});
