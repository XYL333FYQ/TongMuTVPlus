jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockParams,
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'qa-owner' }),
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSession: () => ({
    controller: null,
    metadata: {},
    followingRoom: true,
  }),
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('./useRoomScreening', () => ({
  __esModule: true,
  default: () => false,
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import RoomWorkspace from './RoomWorkspace';

import type { Room } from '@/types/watch-room';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockParams = new URLSearchParams();
const targetRoom = {
  id: 'invited-room',
  name: '邀请测试',
  ownerAccountId: 'qa-owner',
  members: [],
  memberCount: 1,
  currentState: null,
} as unknown as Room;
const mockRoom = {
  currentRoom: null as Room | null,
  members: [],
  isConnected: true,
  canControl: false,
  isOwner: true,
  lastError: '',
  notices: [],
  joinRoom: jest.fn<Promise<void>, [unknown]>(),
  clearError: jest.fn(),
  leaveRoom: jest.fn(() => {
    mockRoom.currentRoom = null;
  }),
};
const originalFetch = global.fetch;
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard'
);
const mockWriteText = jest.fn<Promise<void>, [string]>();
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams('room=invited-room&keep=1');
  mockRoom.currentRoom = null;
  global.fetch = jest.fn(() => new Promise<Response>(() => undefined));
  mockWriteText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: mockWriteText },
  });
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalClipboard)
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

test('an already joined invitation is consumed and only room is removed', async () => {
  mockRoom.currentRoom = targetRoom;
  render(<RoomWorkspace />);
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith('/watch-room?keep=1', {
      scroll: false,
    })
  );
  expect(mockRoom.joinRoom).not.toHaveBeenCalled();
});

test('successful invitation waits for the joined snapshot and cannot rejoin on exit while URL cleanup is pending', async () => {
  mockRoom.joinRoom.mockResolvedValue(undefined);
  const view = render(<RoomWorkspace />);
  await waitFor(() => expect(mockRoom.joinRoom).toHaveBeenCalledTimes(1));
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalledWith('/watch-room?keep=1', {
    scroll: false,
  });
  mockRoom.currentRoom = targetRoom;
  view.rerender(<RoomWorkspace />);
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith('/watch-room?keep=1', {
      scroll: false,
    })
  );
  fireEvent.click(screen.getByRole('button', { name: '房间操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '退出房间' }));
  view.rerender(<RoomWorkspace />);
  await waitFor(() => expect(mockRoom.leaveRoom).toHaveBeenCalledTimes(1));
  expect(mockRoom.joinRoom).toHaveBeenCalledTimes(1);
});

test('failed invitation keeps its room parameter for password retry', async () => {
  mockRoom.joinRoom.mockRejectedValue(new Error('房间密码错误'));
  render(<RoomWorkspace />);
  await screen.findAllByText('房间密码错误');
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockParams.get('room')).toBe('invited-room');
});

test('copy feedback belongs to the room whose invitation was copied', async () => {
  mockParams = new URLSearchParams();
  mockRoom.currentRoom = targetRoom;
  const view = render(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '邀请朋友' }));
  await screen.findByRole('button', { name: '已复制' });
  expect(mockWriteText).toHaveBeenLastCalledWith(
    `${window.location.origin}/watch-room?room=invited-room`
  );

  mockRoom.currentRoom = { ...targetRoom, id: 'another-room' };
  view.rerender(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '邀请朋友' }));
  await screen.findByRole('button', { name: '已复制' });
  expect(mockWriteText).toHaveBeenLastCalledWith(
    `${window.location.origin}/watch-room?room=another-room`
  );

  mockRoom.currentRoom = targetRoom;
  view.rerender(<RoomWorkspace />);
  expect(screen.getByRole('button', { name: '邀请朋友' })).toBeInTheDocument();
});

test('a pending copy from the previous room cannot mark the next room as copied', async () => {
  let resolveCopy: () => void = () => {
    throw new Error('Clipboard request did not start');
  };
  mockWriteText.mockImplementationOnce(
    () => new Promise<void>((resolve) => (resolveCopy = resolve))
  );
  mockParams = new URLSearchParams();
  mockRoom.currentRoom = targetRoom;
  const view = render(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '邀请朋友' }));
  expect(mockWriteText).toHaveBeenCalledTimes(1);

  mockRoom.currentRoom = { ...targetRoom, id: 'another-room' };
  view.rerender(<RoomWorkspace />);
  await act(async () => resolveCopy());
  expect(screen.getByRole('button', { name: '邀请朋友' })).toBeInTheDocument();
});
