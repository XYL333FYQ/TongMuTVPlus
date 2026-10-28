import { act, cleanup, render, screen } from '@testing-library/react';

import RoomMusicPage from './page';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
let mockRoom: any;
let mockSession: any;
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => mockRoom,
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => mockSession,
}));
// pnpm 的目录布局下 jest 找不到 styled-jsx/style，这里只需要它渲染成空
jest.mock(
  'styled-jsx/style',
  () => ({ __esModule: true, default: () => null }),
  { virtual: true }
);
jest.mock('@/features/playback/useAudioFocus', () => ({
  useAudioFocus: () => ({ ownsSound: true, claimSound: jest.fn() }),
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => false }));

const song = {
  id: 'song-a',
  name: '歌 A',
  artist: '歌手',
  album: '专辑',
  pic: '',
  platform: 'netease',
  duration: 200,
};
const musicState = {
  type: 'music',
  song,
  nextSong: null,
  currentTime: 0,
  isPlaying: true,
  quality: 'standard',
  playMode: 'list',
  updatedAt: Date.now(),
};

function makeRoom(
  overrides: Record<string, unknown> = {},
  state: any = musicState
) {
  return {
    isConnected: true,
    isOwner: false,
    canControl: false,
    socket: { id: 'device-2', on: jest.fn(), off: jest.fn() },
    currentRoom: {
      id: 'room-a',
      name: '音乐房',
      roomType: 'music',
      ownerName: 'alice',
      revision: 3,
      controllerEpoch: 1,
      currentState: state,
    },
    ...overrides,
  };
}

const audioElement = () => document.querySelector('audio') as HTMLAudioElement;

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = {
    followingRoom: true,
    resumeRoom: jest.fn(),
    controller: null,
  };
  mockRoom = makeRoom();
  jest
    .spyOn(HTMLMediaElement.prototype, 'load')
    .mockImplementation(() => undefined);
  jest
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => undefined);
  jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ success: false }) })
  ) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

async function renderPage() {
  await act(async () => {
    render(<RoomMusicPage />);
  });
}

it('a listener hears the room music (baseline)', async () => {
  await renderPage();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(audioElement().getAttribute('src')).toContain('songId=song-a');
});

it('the owner account on a device that does not control the room is not thrown out of the page', async () => {
  mockRoom = makeRoom({ isOwner: true, canControl: false });
  await renderPage();
  expect(mockRouter.replace).not.toHaveBeenCalledWith('/watch-room');
  expect(audioElement().getAttribute('src')).toContain('songId=song-a');
});

it('a room that is not on music explains itself instead of silently redirecting', async () => {
  mockRoom = makeRoom({}, null);
  mockRoom.currentRoom.roomType = 'sync';
  await renderPage();
  expect(mockRouter.replace).not.toHaveBeenCalledWith('/watch-room');
  expect(screen.getByText('房间当前没有在一起听')).toBeInTheDocument();
  expect(audioElement().getAttribute('src')).toBeNull();
});

it('the device that controls the music is sent to the music player rather than playing it a second time', async () => {
  mockRoom = makeRoom({ isOwner: true, canControl: true });
  await renderPage();
  expect(mockRouter.replace).not.toHaveBeenCalledWith('/watch-room');
  expect(screen.getByRole('link', { name: /回到音乐播放器/ })).toHaveAttribute(
    'href',
    '/music'
  );
  expect(audioElement().getAttribute('src')).toBeNull();
});

it('someone watching alone is not made to hear the room, and can come back explicitly', async () => {
  mockSession.followingRoom = false;
  await renderPage();
  expect(audioElement().getAttribute('src')).toBeNull();
  screen.getByRole('button', { name: '恢复一起听' }).click();
  expect(mockSession.resumeRoom).toHaveBeenCalledTimes(1);
});

it('live music events are ignored while watching alone', async () => {
  mockSession.followingRoom = false;
  await renderPage();
  const handler = mockRoom.socket.on.mock.calls.find(
    ([event]: [string]) => event === 'music:change'
  )?.[1];
  if (handler) {
    await act(async () => handler(musicState));
  }
  expect(audioElement().getAttribute('src')).toBeNull();
});
