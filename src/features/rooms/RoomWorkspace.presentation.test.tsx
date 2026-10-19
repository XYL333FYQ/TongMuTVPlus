jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'qa-owner' }),
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSession: () => mockPlayback,
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/features/playback/PlaybackSlot', () => ({
  __esModule: true,
  default: () => <div data-testid='player-slot' />,
}));

import { fireEvent, render, screen } from '@testing-library/react';

import RoomWorkspace from './RoomWorkspace';

import type { Member, Room } from '@/types/watch-room';

const room: Room = {
  id: 'qa-room',
  name: '验收房间',
  description: '',
  isPublic: false,
  roomType: 'sync',
  ownerId: 'owner-session',
  ownerName: 'qa-owner',
  ownerAccountId: 'qa-owner',
  memberCount: 1,
  currentState: null,
  createdAt: 0,
  lastOwnerHeartbeat: 0,
};
const makeRoom = () => ({
  currentRoom: { ...room } as Room | null,
  members: [] as Member[],
  isConnected: true,
  canControl: false,
  isOwner: true,
  notices: [],
  lastError: '',
  socket: null,
  clearError: jest.fn(),
  reconnectFailed: false,
  manualReconnect: jest.fn(),
});
let mockRoom = makeRoom();
const mockPlayback = {
  controller: null,
  followingRoom: true,
  presentation: 'docked',
  metadata: { error: null as string | null },
  resumeRoom: jest.fn(),
  minimize: jest.fn(),
  enterPersonalViewing: jest.fn(),
  restore: jest.fn(),
};
const originalFetch = global.fetch;
beforeEach(() => {
  mockRoom = makeRoom();
  mockPlayback.followingRoom = true;
  mockPlayback.metadata.error = null;
  mockPlayback.presentation = 'docked';
  jest.clearAllMocks();
  // Presentation tests do not need directory responses.
  global.fetch = jest.fn(() => new Promise<Response>(() => undefined));
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('connected, no host and empty queue have direct copy', () => {
  render(<RoomWorkspace />);
  expect(screen.getByText('已连接 · 暂无主持')).toBeInTheDocument();
  expect(screen.getByText('片单为空')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '片单 0' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  fireEvent.click(screen.getByRole('tab', { name: '聊天' }));
  expect(document.querySelector('[data-tm-room-chat-slot]')).toHaveAttribute(
    'data-active',
    'true'
  );
});

test('reconnection and departed assigned controller are distinct states', () => {
  if (mockRoom.currentRoom) {
    mockRoom.currentRoom.controllerSessionId = 'departed';
    mockRoom.currentRoom.controllerAccountId = 'qa-owner';
  }
  const view = render(<RoomWorkspace />);
  expect(screen.getByText('已连接 · 房主交接中')).toBeInTheDocument();
  mockRoom.isConnected = false;
  view.rerender(<RoomWorkspace />);
  expect(screen.getByRole('status')).toHaveTextContent('重连中 · 影片继续播放');
});

test('personal viewing returns using the existing session action', () => {
  mockPlayback.followingRoom = false;
  render(<RoomWorkspace />);
  expect(screen.getByText('你正在个人观看')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '回到一起看' }));
  expect(mockPlayback.resumeRoom).toHaveBeenCalledTimes(1);
});

test('folding preserves player slot and restores through existing session action', () => {
  if (mockRoom.currentRoom)
    mockRoom.currentRoom.currentState = {
      type: 'play',
      url: '',
      currentTime: 0,
      isPlaying: true,
      videoId: 'qa',
      videoName: '验收影片',
      source: 'directplay',
    };
  const view = render(<RoomWorkspace />);
  const slot = screen.getByTestId('player-slot');
  fireEvent.click(screen.getByRole('button', { name: '仅自己看' }));
  expect(mockPlayback.enterPersonalViewing).toHaveBeenCalledTimes(1);
  expect(mockPlayback.minimize).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: '收起画面' })
  ).not.toBeInTheDocument();
  mockPlayback.presentation = 'folded';
  view.rerender(<RoomWorkspace />);
  expect(screen.getByTestId('player-slot')).toBe(slot);
  fireEvent.click(screen.getByRole('button', { name: '恢复画面' }));
  expect(mockPlayback.restore).toHaveBeenCalledTimes(1);
  // Keeping the same slot avoids an old slot cleanup clearing the new anchor.
  mockPlayback.followingRoom = false;
  view.rerender(<RoomWorkspace />);
  expect(screen.getByTestId('player-slot')).toBe(slot);
  expect(document.querySelector('.tm-room-personal-anchor')).toContainElement(
    slot
  );
  mockPlayback.followingRoom = true;
  view.rerender(<RoomWorkspace />);
  expect(screen.getByTestId('player-slot')).toBe(slot);
});

test('media failure directs users to existing global retry and autocomplete remains correct', () => {
  mockPlayback.metadata.error = '来源暂时不可用';
  const view = render(<RoomWorkspace />);
  expect(screen.getByRole('status')).toHaveTextContent('视频加载失败');
  mockRoom.currentRoom = null;
  view.rerender(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
  expect(screen.getByLabelText('房间名称')).toHaveAttribute(
    'autocomplete',
    'off'
  );
  expect(screen.getByLabelText('设置房间密码（可选）')).toHaveAttribute(
    'autocomplete',
    'new-password'
  );
});
