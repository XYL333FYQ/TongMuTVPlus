jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'qa-owner' }),
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  base58Encode: () => 'encoded-controlled-media',
}));
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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

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
  roomCommand: jest.fn(
    async (_event: string, _payload: Record<string, unknown>) => ({
      success: true,
    })
  ),
});
let mockRoom = makeRoom();
const mockPlayback = {
  href: null as string | null,
  shareCurrentPlayback: jest.fn(),
  requestPlayback: jest.fn(),
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
  let command = 0;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => `room-command-${++command}` },
  });
  window.innerWidth = 1280;
  mockRoom = makeRoom();
  mockPlayback.followingRoom = true;
  mockPlayback.href = null;
  mockPlayback.metadata.error = null;
  mockPlayback.presentation = 'docked';
  jest.clearAllMocks();
  // Presentation tests do not need directory responses.
  global.fetch = jest.fn(() => new Promise<Response>(() => undefined));
});

test('sharing the current film explicitly targets this room rather than passing the click event', () => {
  mockRoom.canControl = true;
  mockPlayback.href = '/play?source=fixture&id=current';
  render(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '分享当前正在看的影片' }));
  expect(mockPlayback.shareCurrentPlayback).toHaveBeenCalledWith('qa-room');
});

test.each([
  [
    {
      type: 'live',
      channelId: 'a',
      channelName: '频道A',
      channelUrl: 'https://media.test/live.m3u8',
    },
    '观看直播',
    '/live',
  ],
  [
    {
      type: 'live',
      channelId: 'a',
      channelName: '主播A',
      channelUrl: 'https://site.test/web-live?platform=huya&roomId=123',
    },
    '观看直播',
    '/web-live?platform=huya&roomId=123',
  ],
  [{ type: 'music' }, '一起听', '/watch-room/music'],
  [{ type: 'screen', status: 'sharing' }, '观看共享', '/watch-room/screen'],
])(
  'the room dispatches activity %j to a reachable adapter without starting a film',
  (state, label, href) => {
    mockRoom.currentRoom!.currentState = state as Room['currentState'];
    render(<RoomWorkspace />);
    expect(screen.getByRole('link', { name: label as string })).toHaveAttribute(
      'href',
      href
    );
    expect(mockPlayback.requestPlayback).not.toHaveBeenCalled();
  }
);

function openDirectPicker() {
  fireEvent.click(screen.getByRole('button', { name: '选择影片' }));
  fireEvent.click(screen.getByRole('button', { name: '视频直链' }));
  fireEvent.change(screen.getByLabelText('影片名称'), {
    target: { value: '待看片' },
  });
  fireEvent.change(screen.getByLabelText('MP4 / M3U8 地址'), {
    target: { value: 'https://media.test/next.mp4' },
  });
}

test('the existing room picker binds additions to this room and reuses an uncertain command on retry', async () => {
  mockRoom.roomCommand.mockRejectedValueOnce(new Error('确认超时'));
  render(<RoomWorkspace />);
  openDirectPicker();
  fireEvent.click(screen.getByRole('button', { name: '加入片单' }));
  await screen.findAllByText('确认超时');
  fireEvent.click(screen.getByRole('button', { name: '加入片单' }));
  await screen.findByText('已加入片单');
  const first = mockRoom.roomCommand.mock.calls[0][1];
  const retry = mockRoom.roomCommand.mock.calls[1][1];
  expect(first).toEqual(
    expect.objectContaining({
      roomId: 'qa-room',
      commandId: expect.any(String),
    })
  );
  expect(retry.commandId).toBe(first.commandId);
});

test('an old room picker failure cannot leave an error or sending lock in a newly entered room', async () => {
  let fail!: (reason: Error) => void;
  mockRoom.roomCommand.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      })
  );
  const view = render(<RoomWorkspace />);
  openDirectPicker();
  fireEvent.click(screen.getByRole('button', { name: '加入片单' }));
  if (mockRoom.currentRoom)
    mockRoom.currentRoom = { ...mockRoom.currentRoom, id: 'new-room' };
  view.rerender(<RoomWorkspace />);
  await act(async () => fail(new Error('旧房取消')));
  expect(screen.queryAllByText('旧房取消')).toHaveLength(0);
  expect(screen.getByRole('button', { name: '选择影片' })).not.toBeDisabled();
});

test('narrow screens open chat first and put film details after the room panel', () => {
  window.innerWidth = 390;
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
  render(<RoomWorkspace />);
  expect(screen.getByRole('tab', { name: '聊天' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  const panel = document.querySelector('.tm-room-side')!;
  const details = screen.getByRole('region', { name: '当前影片资料' });
  expect(
    panel.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
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

test('a playing room with an empty queue keeps an explicit add-later route and recommendations', () => {
  if (mockRoom.currentRoom)
    mockRoom.currentRoom.currentState = {
      type: 'play',
      source: 'fixture',
      videoId: 'playing',
      videoName: '正在播放',
      url: 'https://media.test/playing.mp4',
      currentTime: 0,
      isPlaying: true,
    };
  render(<RoomWorkspace />);
  expect(screen.getByRole('link', { name: '添加待看' })).toHaveAttribute(
    'href',
    '/watch-room/select?room=qa-room'
  );
  expect(
    screen.getByRole('heading', { name: '挑选下一部' })
  ).toBeInTheDocument();
});

test('a host queue play action uses an explicit together intent', () => {
  mockRoom.canControl = true;
  if (mockRoom.currentRoom)
    mockRoom.currentRoom.queue = [
      {
        id: 'next',
        title: '下一部',
        href: '/play?source=fixture&id=next',
        source: 'fixture',
        videoId: 'next',
        episode: 1,
        addedBy: 'qa-owner',
        addedAt: 0,
      },
    ];
  render(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '播放下一部' }));
  expect(mockPlayback.requestPlayback).toHaveBeenCalledWith(
    '/play?source=fixture&id=next&episode=1&queueId=next',
    'together'
  );
});

test('starting from an idle room chooses the first waiting item rather than replaying a completed one', () => {
  mockRoom.canControl = true;
  if (mockRoom.currentRoom)
    mockRoom.currentRoom.queue = [
      {
        id: 'past',
        title: '已看过',
        href: '/play?source=fixture&id=past',
        addedBy: 'qa-owner',
        addedAt: 0,
        playedAt: 1,
      },
      {
        id: 'next',
        title: '下一部',
        href: '/play?source=fixture&id=next',
        addedBy: 'qa-owner',
        addedAt: 0,
      },
    ];
  render(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '开始播放' }));
  expect(mockPlayback.requestPlayback).toHaveBeenCalledWith(
    '/play?source=fixture&id=next&episode=1&queueId=next',
    'together'
  );
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
