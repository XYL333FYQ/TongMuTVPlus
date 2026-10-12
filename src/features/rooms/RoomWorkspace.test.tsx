jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockParams,
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'qa-owner', role: 'user' }),
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSession: () => mockPlayback,
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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import RoomWorkspace from './RoomWorkspace';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockParams = { get: () => null };
const mockPlayback = { controller: null };
const mockRoom = {
  currentRoom: null,
  isConnected: true,
  lastError: '',
  clearError: jest.fn(),
  joinRoom: jest.fn<Promise<void>, [unknown]>(),
};
const originalFetch = global.fetch;
let mockFetch: jest.Mock;
const directoryRoom = {
  id: 'room-a',
  name: '恢复验收',
  description: '测试房间',
  isPublic: true,
  memberCount: 1,
  ownerAccountId: 'friend',
  lifecycle: 'active',
};
function response() {
  return {
    ok: true,
    json: async () => ({ rooms: [directoryRoom] }),
  } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch = jest.fn();
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('successful refresh removes a previous directory network failure', async () => {
  mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
  render(<RoomWorkspace />);
  await screen.findByRole('alert');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '刷新房间' })).not.toBeDisabled()
  );
  mockFetch.mockResolvedValue(response());
  fireEvent.click(screen.getByRole('button', { name: '刷新房间' }));
  await screen.findByRole('heading', { name: '恢复验收' });
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  );
});

test('a successful directory refresh must not clear a failed join operation', async () => {
  mockFetch.mockResolvedValue(response());
  mockRoom.joinRoom.mockRejectedValue(new Error('房间密码错误'));
  render(<RoomWorkspace />);
  await screen.findByRole('heading', { name: '恢复验收' });
  fireEvent.click(screen.getByRole('button', { name: '进入房间' }));
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  screen
    .getAllByRole('alert')
    .forEach((alert) => expect(alert).toHaveTextContent('房间密码错误'));
  fireEvent.click(screen.getByRole('button', { name: '刷新房间' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '刷新房间' })).not.toBeDisabled()
  );
  screen
    .getAllByRole('alert')
    .forEach((alert) => expect(alert).toHaveTextContent('房间密码错误'));
});

test('an obsolete directory failure cannot overwrite a newer successful directory response', async () => {
  let rejectOld: (error: Error) => void = () => {
    throw new Error('request was not started');
  };
  const oldRequest = new Promise<Response>((_resolve, reject) => {
    rejectOld = reject;
  });
  mockFetch.mockImplementation((url: string) =>
    url.endsWith('mode=mine') ? oldRequest : Promise.resolve(response())
  );
  render(<RoomWorkspace />);
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith('/api/rooms?mode=mine', {
      cache: 'no-store',
    })
  );
  fireEvent.click(screen.getByRole('tab', { name: '公开房间' }));
  await screen.findByRole('heading', { name: '恢复验收' });
  await act(async () => {
    rejectOld(new Error('旧目录已断开'));
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
