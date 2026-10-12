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

function setup() {
  const player = {
    video: { readyState: 4, seeking: false, paused: false, duration: Infinity },
    currentTime: 10,
    playbackRate: 1,
    playing: true,
    on: jest.fn(),
    off: jest.fn(),
    notice: { show: '' },
    play: jest.fn(async () => {
      player.playing = true;
      player.video.paused = false;
    }),
    pause: jest.fn(() => {
      player.playing = false;
      player.video.paused = true;
    }),
  };
  mockRoom = {
    isConnected: true,
    canControl: false,
    socket: { id: 'viewer' },
    roomCommand: jest.fn(async () => ({ success: true })),
    currentRoom: {
      id: 'room-1',
      revision: 12,
      controllerEpoch: 3,
      serverTime: Date.now(),
      currentState: {
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
      },
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
  return { player, options, Harness };
}
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1800000000000);
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test('returning owner applies current room progress before becoming ready and never broadcasts its old progress', async () => {
  const { player, Harness } = setup();
  mockRoom.canControl = true;
  render(<Harness />);
  await settle();
  expect(player.currentTime).toBe(200);
  expect(
    mockRoom.roomCommand.mock.calls.slice(0, 2).map((call: any[]) => call[0])
  ).toEqual(['room:sync-applied', 'room:ready']);
  await act(async () => {
    jest.advanceTimersByTime(2100);
  });
  await settle();
  const updates = mockRoom.roomCommand.mock.calls.filter(
    (call: any[]) => call[0] === 'play:update'
  );
  expect(updates.length).toBeGreaterThan(0);
  expect(updates.every((call: any[]) => call[1].currentTime >= 200)).toBe(true);
});
test('room media changes update the persistent player without navigating the current page', async () => {
  const { options, Harness } = setup();
  options.videoId = 'old-film';
  render(<Harness />);
  await settle();
  expect(mockSession.requestPlayback).toHaveBeenCalledWith(
    expect.stringContaining('id=film-1'),
    'room'
  );
  expect(mockRoom.roomCommand).not.toHaveBeenCalledWith(
    'play:change',
    expect.anything()
  );
});
test('personal viewing retains room connection while ignoring room media and emitting no playback controls', async () => {
  const { player, Harness } = setup();
  mockSession.followingRoom = false;
  mockRoom.canControl = true;
  render(<Harness />);
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  expect(player.currentTime).toBe(10);
  expect(player.pause).not.toHaveBeenCalled();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
});
test('unmount cleanup never tells other members to pause or leaves the room', async () => {
  const { Harness } = setup();
  const view = render(<Harness />);
  await settle();
  mockRoom.roomCommand.mockClear();
  view.unmount();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
});
test('a new selection cannot publish the previous decoded video while its own media is loading', async () => {
  const { options, Harness } = setup();
  mockRoom.canControl = true;
  mockSession.roomSelectionHref = '/play?source=fixture&id=film-2';
  options.videoId = 'film-2';
  options.mediaLoading = true;
  render(<Harness />);
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  await settle();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  expect(mockSession.clearRoomSelection).not.toHaveBeenCalled();
});

test('a paused room stops native playback before seeking can make the wrapper report not playing', async () => {
  const { player, Harness } = setup();
  mockRoom.currentRoom.currentState.isPlaying = false;
  let time = 10;
  Object.defineProperty(player, 'currentTime', {
    get: () => time,
    set: (value: number) => {
      time = value;
      // A real seek temporarily drops readyState, which makes Artplayer.playing false.
      player.video.readyState = 1;
      player.playing = false;
    },
  });
  render(<Harness />);
  await settle();
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(player.video.paused).toBe(true);
  expect(player.currentTime).toBe(200);
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  player.video.readyState = 4;
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  await settle();
  expect(player.video.paused).toBe(true);
  expect(player.play).not.toHaveBeenCalled();
  expect(player.currentTime).toBe(200);
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'room:ready',
    expect.objectContaining({ ready: true })
  );
});

test('buffering does not publish a false pause when native playback is still active', async () => {
  const { player, Harness } = setup();
  mockRoom.canControl = true;
  render(<Harness />);
  await settle();
  mockRoom.roomCommand.mockClear();
  player.video.readyState = 2;
  player.playing = false;
  player.video.paused = false;
  await act(async () => {
    jest.advanceTimersByTime(2100);
  });
  await settle();
  const updates = mockRoom.roomCommand.mock.calls.filter(
    (call: any[]) => call[0] === 'play:update'
  );
  expect(updates.length).toBeGreaterThan(0);
  expect(updates.every((call: any[]) => call[1].isPlaying)).toBe(true);
});

test('a returning owner can become ready after the hostless timeline has passed the finite film end', async () => {
  const { player, Harness } = setup();
  player.video.duration = 120;
  player.video.paused = true;
  player.currentTime = 120;
  player.play.mockRejectedValue(new Error('cannot resume beyond the film end'));
  render(<Harness />);
  await settle();
  expect(player.currentTime).toBe(120);
  expect(player.play).not.toHaveBeenCalled();
  expect(
    mockRoom.roomCommand.mock.calls.map((call: unknown[]) => call[0])
  ).toEqual(['room:sync-applied', 'room:ready']);

  mockRoom.canControl = true;
  await act(async () => {
    jest.advanceTimersByTime(2100);
  });
  await settle();
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'play:update',
    expect.objectContaining({ currentTime: 120, isPlaying: false })
  );
});

test.each([0, NaN, Infinity])(
  'an unknown or live duration %s does not turn an active room into a finished film',
  async (duration) => {
    const { player, Harness } = setup();
    player.video.duration = duration;
    player.video.paused = true;
    render(<Harness />);
    await settle();
    expect(player.currentTime).toBe(200);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).not.toHaveBeenCalled();
    expect(mockRoom.roomCommand).toHaveBeenCalledWith(
      'room:ready',
      expect.objectContaining({ ready: true })
    );
  }
);
