jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'qa-owner', role: 'user' }),
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSession: () => ({ controller: null }),
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/features/playback/PlaybackSlot', () => ({
  __esModule: true,
  default: () => null,
}));

import { render, screen, waitFor } from '@testing-library/react';

import RoomWorkspace from './RoomWorkspace';

let mockRoom: any;
const originalFetch = global.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockRoom = {
    currentRoom: null,
    isConnected: true,
    lastError: '',
    clearError: jest.fn(),
    joinRoom: jest.fn(),
    config: { enabled: true, serverType: 'internal' },
  };
  mockFetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ rooms: [] }),
  }));
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('the built-in room service lists rooms over REST as before', async () => {
  render(<RoomWorkspace />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  expect(String(mockFetch.mock.calls[0][0])).toContain('/api/rooms?mode=');
});

test('with an external room server the app does not ask the local REST endpoint that is known to refuse', async () => {
  mockRoom.config = {
    enabled: true,
    serverType: 'external',
    externalServerUrl: 'wss://rooms.example',
  };
  render(<RoomWorkspace />);
  await screen.findByText(/当前使用外部观影室服务/);
  expect(mockFetch).not.toHaveBeenCalled();
});

test('the external boundary is a clear statement, not a generic service failure', async () => {
  mockRoom.config = { enabled: true, serverType: 'external' };
  render(<RoomWorkspace />);
  const notice = await screen.findByText(/当前使用外部观影室服务/);
  expect(notice).toHaveTextContent('房间目录和长期房间恢复仅内置服务提供');
  expect(screen.queryByText('房间服务暂时不可用')).toBeNull();
});
