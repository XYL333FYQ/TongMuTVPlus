import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import WatchRoomScreenPage from './page';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockLeaveRoom = jest.fn();
const mockClaimSound = jest.fn();
const startSharing = jest.fn();
const stopSharing = jest.fn();
const resumeRoom = jest.fn();
const localVideoRef = { current: null };
const remoteVideoRef = { current: null };
let mockShare: Record<string, unknown>;
let mockRoom: any;
let mockSession: any;

jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => mockRoom,
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => mockSession,
}));
jest.mock('@/features/playback/useAudioFocus', () => ({
  useAudioFocus: () => ({ ownsSound: true, claimSound: mockClaimSound }),
}));
jest.mock('@/hooks/useScreenShare', () => ({
  screenShareQualityOptions: [{ value: 'smooth', label: '流畅' }],
  useScreenShare: () => mockShare,
}));

const room = (overrides: Record<string, unknown> = {}) => ({
  id: 'room-a',
  name: '常规房间',
  roomType: 'sync',
  ownerName: 'alice',
  currentState: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  jest.spyOn(window, 'open').mockImplementation(() => null);
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia: jest.fn() },
  });
  (window as any).RTCPeerConnection = function RTCPeerConnection() {
    return undefined;
  };
  mockSession = { followingRoom: true, resumeRoom };
  mockRoom = {
    currentRoom: room(),
    members: [{ id: 'device-1', name: 'alice', isOwner: true }],
    leaveRoom: mockLeaveRoom,
    canControl: true,
  };
  mockShare = {
    currentRoom: room(),
    canShare: true,
    following: true,
    isLocalSharing: false,
    isSharing: false,
    isStarting: false,
    error: null,
    captureSettings: null,
    localVideoRef,
    remoteVideoRef,
    startSharing,
    stopSharing,
  };
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

it('a regular room is a valid place to share: nothing redirects the page away before the capture starts', () => {
  render(<WatchRoomScreenPage />);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '开始共享' })).toBeEnabled();
});

it('without a room the page goes back to the room list', () => {
  mockRoom = { ...mockRoom, currentRoom: null };
  mockShare = { ...mockShare, currentRoom: null };
  render(<WatchRoomScreenPage />);
  expect(mockRouter.replace).toHaveBeenCalledWith('/watch-room');
});

it('entering the page never opens another tab by itself', () => {
  render(<WatchRoomScreenPage />);
  expect(window.open).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});

it('the home-page button is the only thing that opens a new tab', () => {
  render(<WatchRoomScreenPage />);
  fireEvent.click(screen.getByText('新开主页'));
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(window.open).toHaveBeenCalledWith(
    '/',
    '_blank',
    'noopener,noreferrer'
  );
});

it('keeps other tabs of this browser from joining the room only while this device may share, and cleans up afterwards', () => {
  const view = render(<WatchRoomScreenPage />);
  expect(localStorage.getItem('watch_room_no_connect')).toBe('1');
  view.unmount();
  expect(localStorage.getItem('watch_room_no_connect')).toBeNull();
});

it('a reload or tab close while able to share never leaves this browser blocked from the room', () => {
  render(<WatchRoomScreenPage />);
  expect(localStorage.getItem('watch_room_no_connect')).toBe('1');
  // 整页刷新/关闭时 React 不会跑卸载清理，只有 pagehide；标记留着会让本浏览器被拒绝重连 10 分钟
  window.dispatchEvent(new Event('pagehide'));
  expect(localStorage.getItem('watch_room_no_connect')).toBeNull();
  expect(localStorage.getItem('watch_room_no_connect_timestamp')).toBeNull();
});

it('after a reload the controlling device can end or restart a share it is no longer capturing', () => {
  mockShare = { ...mockShare, isSharing: true, isLocalSharing: false };
  render(<WatchRoomScreenPage />);
  const stop = screen.getByRole('button', { name: '停止' });
  expect(stop).toBeEnabled();
  fireEvent.click(stop);
  expect(stopSharing).toHaveBeenCalledWith(true);
  const restart = screen.getByRole('button', { name: '重新开始共享' });
  expect(restart).toBeEnabled();
  fireEvent.click(restart);
  expect(startSharing).toHaveBeenCalledTimes(1);
});

it('an idle room has nothing to stop', () => {
  render(<WatchRoomScreenPage />);
  expect(screen.getByRole('button', { name: '停止' })).toBeDisabled();
});

it('a device that cannot share only waits and watches: no share controls, no connection block', () => {
  mockShare = { ...mockShare, canShare: false };
  render(<WatchRoomScreenPage />);
  expect(screen.queryByRole('button', { name: '开始共享' })).toBeNull();
  expect(screen.getByText('等待主持开始共享屏幕')).toBeInTheDocument();
  expect(localStorage.getItem('watch_room_no_connect')).toBeNull();
});

it('a browser that cannot capture the screen says so and stays in the room', () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {},
  });
  render(<WatchRoomScreenPage />);
  expect(screen.getByRole('button', { name: '开始共享' })).toBeDisabled();
  expect(screen.getByText(/当前浏览器不支持屏幕共享/)).toBeInTheDocument();
  expect(mockLeaveRoom).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('starting is an explicit click', () => {
  render(<WatchRoomScreenPage />);
  expect(startSharing).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '开始共享' }));
  expect(startSharing).toHaveBeenCalledTimes(1);
});

it('stopping only stops the sharing; the room and the page stay', () => {
  mockShare = { ...mockShare, isLocalSharing: true, isSharing: true };
  render(<WatchRoomScreenPage />);
  fireEvent.click(screen.getByRole('button', { name: '停止' }));
  expect(stopSharing).toHaveBeenCalledWith(true);
  expect(mockLeaveRoom).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('there is a way back to the room that does not leave it', () => {
  render(<WatchRoomScreenPage />);
  const back = screen.getByRole('link', { name: '返回房间' });
  expect(back).toHaveAttribute('href', '/watch-room');
  fireEvent.click(back);
  expect(mockLeaveRoom).not.toHaveBeenCalled();
});

it('leaving the room is a separate, explicit button that stops a running share first', () => {
  mockShare = { ...mockShare, isLocalSharing: true, isSharing: true };
  render(<WatchRoomScreenPage />);
  fireEvent.click(screen.getByRole('button', { name: '离开房间' }));
  expect(stopSharing).toHaveBeenCalledWith(true);
  expect(mockLeaveRoom).toHaveBeenCalledTimes(1);
});

it('someone watching alone sees why there is no picture and can come back explicitly', () => {
  mockShare = { ...mockShare, canShare: false, following: false };
  render(<WatchRoomScreenPage />);
  expect(screen.getByText('正在个人观看，房间和消息保留')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '恢复一起看' }));
  expect(resumeRoom).toHaveBeenCalledTimes(1);
});

it('the shared picture takes over the sound only when the viewer plays it', async () => {
  mockShare = {
    ...mockShare,
    canShare: false,
    isSharing: true,
    currentRoom: room({
      currentState: { type: 'screen', status: 'sharing', ownerName: 'alice' },
    }),
  };
  render(<WatchRoomScreenPage />);
  const video = document.querySelector('video[controls]') as HTMLVideoElement;
  expect(mockClaimSound).not.toHaveBeenCalled();
  await act(async () => {
    video.dispatchEvent(new Event('play'));
  });
  expect(mockClaimSound).toHaveBeenCalledTimes(1);
});
