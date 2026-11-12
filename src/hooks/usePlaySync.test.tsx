import { act, cleanup, render } from '@testing-library/react';

import { usePlaySync } from './usePlaySync';

let mockRoom: any;
let mockSession: any;
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => mockSession,
}));

function roomState(overrides: Record<string, unknown> = {}) {
  return {
    type: 'play',
    source: 'fixture',
    videoId: 'film-1',
    episode: 1,
    url: 'https://media.test/1.mp4',
    videoName: '第一部',
    currentTime: 200,
    isPlaying: true,
    playbackRate: 1,
    updatedAt: Date.now(),
    ...overrides,
  };
}

function setup() {
  const listeners = new Map<string, Set<() => void>>();
  const player = {
    video: {
      readyState: 4,
      seeking: false,
      paused: false,
      ended: false,
      duration: Infinity,
    },
    currentTime: 10,
    playbackRate: 1,
    on: jest.fn((event: string, listener: () => void) => {
      const set = listeners.get(event) || new Set();
      set.add(listener);
      listeners.set(event, set);
    }),
    off: jest.fn((event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    }),
    notice: { show: '' },
    play: jest.fn(async () => {
      player.video.paused = false;
    }),
    pause: jest.fn(() => {
      player.video.paused = true;
    }),
  };
  const emit = (event: string) =>
    listeners.get(event)?.forEach((listener) => listener());
  mockRoom = {
    isConnected: true,
    canControl: false,
    socket: { id: 'viewer' },
    members: [{ id: 'viewer', accountId: 'viewer' }],
    roomCommand: jest.fn(async () => ({ success: true })),
    currentRoom: {
      id: 'room-1',
      revision: 12,
      serverTime: Date.now(),
      currentState: roomState(),
    },
  };
  mockSession = {
    followingRoom: true,
    roomSelectionHref: null,
    requestPlayback: jest.fn(),
    clearRoomSelection: jest.fn(),
  };
  const options = {
    artPlayerRef: { current: player },
    videoId: 'film-1',
    videoName: '第一部',
    currentEpisode: 1,
    currentSource: 'fixture',
    videoUrl: 'https://media.test/1.mp4',
    playerReady: true,
    mediaLoading: false,
  };
  function Harness() {
    usePlaySync(options);
    return null;
  }
  return { player, options, Harness, emit };
}
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
const commands = () =>
  mockRoom.roomCommand.mock.calls.map((call: any[]) => call[0]);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1800000000000);
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test('joining snaps to the room position without sending anything to the room', async () => {
  const { player, Harness } = setup();
  render(<Harness />);
  await settle();
  expect(player.currentTime).toBe(200);
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
});

test('a small drift is tolerated while a large one is corrected', async () => {
  const { player, Harness } = setup();
  player.currentTime = 200.5;
  render(<Harness />);
  await settle();
  expect(player.currentTime).toBe(200.5);
  player.currentTime = 195;
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await settle();
  expect(player.currentTime).toBeCloseTo(201, 0);
});

test('a member with control pauses the whole room with their exact position', async () => {
  const { player, Harness, emit } = setup();
  mockRoom.canControl = true;
  render(<Harness />);
  await settle();
  player.currentTime = 201.5;
  player.video.paused = true;
  await act(async () => emit('video:pause'));
  await settle();
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'play:pause',
    expect.objectContaining({
      currentTime: 201.5,
      videoId: 'film-1',
      source: 'fixture',
      episode: 1,
    })
  );
});

test('dragging the progress bar seeks everyone', async () => {
  const { player, Harness, emit } = setup();
  mockRoom.canControl = true;
  render(<Harness />);
  await settle();
  // 第一次跳转是本机为了对齐房间做的，不能当成用户操作
  await act(async () => emit('video:seeked'));
  expect(commands()).not.toContain('play:seek');
  player.currentTime = 600;
  await act(async () => emit('video:seeked'));
  await settle();
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'play:seek',
    expect.objectContaining({ currentTime: 600, isPlaying: true })
  );
});

test('without permission a pause is undone and explained instead of silently reverted', async () => {
  const { player, Harness, emit } = setup();
  render(<Harness />);
  await settle();
  player.video.paused = true;
  await act(async () => emit('video:pause'));
  await settle();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  expect(player.play).toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(player.notice.show).toContain('房主没有开放成员控制播放');
});

test('following a remote pause does not echo a pause back to the room', async () => {
  const { player, Harness, emit } = setup();
  mockRoom.canControl = true;
  const view = render(<Harness />);
  await settle();
  mockRoom = {
    ...mockRoom,
    currentRoom: {
      ...mockRoom.currentRoom,
      currentState: roomState({
        isPlaying: false,
        currentTime: 230,
        version: 2,
        updatedBy: 'friend',
      }),
    },
  };
  view.rerender(<Harness />);
  await settle();
  expect(player.pause).toHaveBeenCalled();
  expect(player.currentTime).toBe(230);
  await act(async () => {
    emit('video:pause');
    emit('video:seeked');
  });
  await settle();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
});

test('clicking play after autoplay was blocked catches up instead of rewinding the room', async () => {
  const { player, Harness, emit } = setup();
  mockRoom.canControl = true;
  player.video.paused = true;
  player.play.mockRejectedValueOnce(new Error('NotAllowedError'));
  render(<Harness />);
  await settle();
  expect(player.notice.show).toBe('点击播放，加入房间同步');
  jest.setSystemTime(1800000030000);
  player.video.paused = false;
  await act(async () => emit('video:play'));
  await settle();
  expect(commands()).not.toContain('play:play');
  expect(player.currentTime).toBeCloseTo(230, 0);
});

test('a resolved queue selection starts the room from the beginning with its queue identity', async () => {
  const { player, Harness } = setup();
  mockRoom.canControl = true;
  mockSession.href = '/play?source=fixture&id=film-1&queueId=waiting-1';
  mockSession.roomSelectionHref = mockSession.href;
  player.currentTime = 55;
  render(<Harness />);
  await settle();
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'play:change',
    expect.objectContaining({
      queueItemId: 'waiting-1',
      currentTime: 0,
      isPlaying: true,
    })
  );
  expect(mockSession.clearRoomSelection).toHaveBeenCalledWith(
    mockSession.roomSelectionHref
  );
});

test('room media changes load the room film in the persistent player', async () => {
  const { options, Harness } = setup();
  options.videoId = 'old-film';
  render(<Harness />);
  await settle();
  expect(mockSession.requestPlayback).toHaveBeenCalledWith(
    expect.stringContaining('id=film-1'),
    'room'
  );
  expect(commands()).not.toContain('play:change');
});

test('switching to the next episode locally changes it for everyone when allowed', async () => {
  const { options, Harness } = setup();
  mockRoom.canControl = true;
  const view = render(<Harness />);
  await settle();
  options.currentEpisode = 2;
  view.rerender(<Harness />);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await settle();
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'play:change',
    expect.objectContaining({ episode: 2, videoId: 'film-1' })
  );
});

test('without permission a local episode switch goes back to the room episode', async () => {
  const { options, player, Harness } = setup();
  const view = render(<Harness />);
  await settle();
  options.currentEpisode = 2;
  view.rerender(<Harness />);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await settle();
  expect(commands()).not.toContain('play:change');
  expect(mockSession.requestPlayback).toHaveBeenCalledWith(
    expect.stringContaining('episode=1'),
    'room'
  );
  expect(player.notice.show).toContain('房主没有开放成员换片');
});

test('personal viewing keeps the room connection but ignores room playback', async () => {
  const { player, Harness, emit } = setup();
  mockRoom.canControl = true;
  mockSession.followingRoom = false;
  render(<Harness />);
  await settle();
  player.video.paused = true;
  await act(async () => emit('video:pause'));
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(player.currentTime).toBe(10);
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  expect(mockSession.requestPlayback).not.toHaveBeenCalled();
});
