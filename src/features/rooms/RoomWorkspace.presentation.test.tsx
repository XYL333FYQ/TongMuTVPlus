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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  leaveRoom: jest.fn(),
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
  expect(screen.getByText('已连接')).toBeInTheDocument();
  expect(screen.getByText('暂无主持')).toBeInTheDocument();
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
  expect(screen.getByText('已连接')).toBeInTheDocument();
  expect(screen.getByText('房主交接中')).toBeInTheDocument();
  mockRoom.isConnected = false;
  view.rerender(<RoomWorkspace />);
  expect(screen.getByText('重连中 · 影片继续播放')).toHaveAttribute(
    'role',
    'status'
  );
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
  expect(screen.getByText(/视频加载失败/)).toHaveAttribute('role', 'status');
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

test('member shortcut reflects the selected panel and returns to the queue', () => {
  render(<RoomWorkspace />);
  const shortcut = screen.getByRole('button', { name: '成员，1人' });
  fireEvent.click(screen.getByRole('tab', { name: '成员 1' }));
  expect(shortcut).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(shortcut);
  expect(screen.getByRole('tab', { name: '片单 0' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(shortcut).toHaveAttribute('aria-expanded', 'false');
});

test('the empty queue has one central selection action and no duplicate add action', () => {
  render(<RoomWorkspace />);
  expect(screen.getByRole('button', { name: '选择影片' })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '添加影片' })
  ).not.toBeInTheDocument();
});

test('room identifiers are masked on screen and copied in full', async () => {
  if (mockRoom.currentRoom) mockRoom.currentRoom.id = '0123456789AB';
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(<RoomWorkspace />);
  expect(screen.getByText(/房间号 0123…89AB/)).toBeInTheDocument();
  expect(screen.queryByText('0123456789AB')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '复制房间号' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('0123456789AB'));
});

test('exit stays in the accessible action menu and retains the original leave callback', () => {
  render(<RoomWorkspace />);
  expect(
    screen.queryByRole('button', { name: '退出房间' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '房间操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '退出房间' }));
  expect(mockRoom.leaveRoom).toHaveBeenCalledTimes(1);
});

test('new rooms start with a display name rather than an empty identifier', () => {
  mockRoom.currentRoom = null;
  render(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
  expect(screen.getByLabelText('房间名称')).toHaveValue('qa-owner 的放映室');
});
