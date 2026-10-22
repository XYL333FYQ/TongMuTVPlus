jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));
jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => ({
    currentRoom: { id: 'audit-screen', roomType: mockRoomType },
    members: [],
    leaveRoom: mockLeaveRoom,
  }),
}));
jest.mock('@/hooks/useScreenShare', () => ({
  screenShareQualityOptions: [],
  useScreenShare: () => ({
    currentRoom: {
      id: 'audit-screen',
      roomType: mockRoomType,
      name: '审查房间',
    },
    isOwner: true,
    isSharing: false,
    isStarting: false,
    localVideoRef: { current: null },
    remoteVideoRef: { current: null },
  }),
}));

import { render } from '@testing-library/react';

import WatchRoomScreenPage from './page';

let mockRoomType: 'sync' | 'screen' = 'sync';
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockLeaveRoom = jest.fn();

beforeEach(() => {
  mockRoomType = 'sync';
  localStorage.clear();
  sessionStorage.clear();
  jest.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => jest.restoreAllMocks());

test('同步房间回跳时不打开首页或写入禁止连接标记', () => {
  render(<WatchRoomScreenPage />);
  expect(window.open).not.toHaveBeenCalled();
  expect(localStorage.getItem('watch_room_no_connect')).toBeNull();
  expect(localStorage.getItem('watch_room_no_connect_timestamp')).toBeNull();
});

test('真正的共享房间保留独立首页和清理连接标记的行为', () => {
  mockRoomType = 'screen';
  const view = render(<WatchRoomScreenPage />);
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(window.open).toHaveBeenCalledWith(
    '/',
    '_blank',
    'noopener,noreferrer'
  );
  expect(localStorage.getItem('watch_room_no_connect')).toBe('1');
  view.unmount();
  expect(localStorage.getItem('watch_room_no_connect')).toBeNull();
});
