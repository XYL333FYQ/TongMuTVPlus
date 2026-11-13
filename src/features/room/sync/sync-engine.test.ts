import {
  type LocalMedia,
  type PlayerEvent,
  type PlayerPort,
  type SyncInput,
  RoomSyncEngine,
} from './sync-engine';

import type { PlayState } from '@/types/watch-room';

class FakePlayer implements PlayerPort {
  currentTime = 0;
  duration = 600;
  paused = true;
  ended = false;
  readyState = 4;
  seeking = false;
  playbackRate = 1;
  notices: string[] = [];
  blockPlay = false;
  private listeners = new Map<PlayerEvent, Set<() => void>>();
  on(event: PlayerEvent, listener: () => void) {
    const set = this.listeners.get(event) || new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }
  emit(event: PlayerEvent) {
    this.listeners.get(event)?.forEach((listener) => listener());
  }
  async play() {
    if (this.blockPlay) throw new Error('NotAllowedError');
    this.paused = false;
    this.emit('play');
  }
  pause() {
    this.paused = true;
    this.emit('pause');
  }
  seek(time: number) {
    this.currentTime = time;
    this.emit('seeked');
  }
  setRate(rate: number) {
    this.playbackRate = rate;
    this.emit('ratechange');
  }
  notice(message: string) {
    this.notices.push(message);
  }
  /** 用户在播放器上操作（不是同步引擎做的） */
  userPause() {
    this.pause();
  }
  userSeek(time: number) {
    this.seek(time);
  }
}

let clock = 1_000_000;
const flush = async () => {
  for (let index = 0; index < 5; index++) await Promise.resolve();
};

function film(overrides: Partial<PlayState> = {}): PlayState {
  return {
    type: 'play',
    source: 'fixture',
    videoId: 'film-a',
    videoName: '影片 A',
    episode: 1,
    url: '',
    currentTime: 100,
    isPlaying: true,
    playbackRate: 1,
    updatedAt: clock,
    version: 1,
    ...overrides,
  };
}

function local(overrides: Partial<LocalMedia> = {}): LocalMedia {
  return {
    source: 'fixture',
    videoId: 'film-a',
    episode: 1,
    videoName: '影片 A',
    ready: true,
    ...overrides,
  };
}

function setup(input: Partial<SyncInput> = {}) {
  const player = new FakePlayer();
  const effects = {
    command: jest.fn(
      async (_event: string, payload: Record<string, unknown>) => ({
        success: true,
        payload,
      })
    ),
    follow: jest.fn(),
    stopLocal: jest.fn(),
    serverNow: () => clock,
    now: () => clock,
  };
  const engine = new RoomSyncEngine(effects);
  const state: SyncInput = {
    roomId: 'room-1',
    connected: true,
    canControl: true,
    state: film(),
    selfAccountId: 'me',
    local: local(),
    ...input,
  };
  engine.setPort(player);
  engine.update(state);
  return { engine, player, effects, state };
}

beforeEach(() => {
  clock = 1_000_000;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('following the room', () => {
  it('opens the room film when this device plays something else and never chose it', async () => {
    const { effects } = setup({ local: local({ videoId: 'film-b' }) });
    await flush();
    expect(effects.follow).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'film-a' })
    );
    expect(effects.command).not.toHaveBeenCalled();
  });

  it('jumps to the room position and plays, without echoing its own actions to the room', async () => {
    const { player, effects } = setup();
    await flush();
    expect(player.currentTime).toBe(100);
    expect(player.paused).toBe(false);
    expect(effects.command).not.toHaveBeenCalled();
  });

  it('projects the position with the server clock and tolerates small drift while playing', async () => {
    const { engine, player } = setup();
    await flush();
    clock += 10_000;
    player.currentTime = 110.8; // 0.8s off: within the playing threshold
    await engine.tick();
    expect(player.currentTime).toBe(110.8);
    clock += 4_000;
    player.currentTime = 111; // expected 114
    await engine.tick();
    expect(player.currentTime).toBe(114);
  });

  it('does not chase the room while the player is buffering', async () => {
    const { engine, player } = setup();
    await flush();
    clock += 5_000;
    player.readyState = 2;
    player.currentTime = 100;
    await engine.tick();
    expect(player.currentTime).toBe(100);
  });

  it('pauses the film when the room switches to another activity', async () => {
    const { engine, player, state } = setup();
    await flush();
    expect(player.paused).toBe(false);
    engine.update({
      ...state,
      state: {
        type: 'live',
        channelId: 'c',
        channelName: 'C',
        channelUrl: '',
      } as never,
    });
    await flush();
    expect(player.paused).toBe(true);
  });

  it('shows who changed the room, but not for this account', async () => {
    const { engine, player, state } = setup();
    await flush();
    engine.update({
      ...state,
      state: film({ isPlaying: false, version: 2, updatedBy: 'friend' }),
    });
    await flush();
    jest.advanceTimersByTime(300);
    expect(player.notices).toContain('friend 暂停了');
    engine.update({
      ...state,
      state: film({ isPlaying: true, version: 3, updatedBy: 'me' }),
    });
    jest.advanceTimersByTime(300);
    expect(player.notices.filter((n) => n.includes('继续播放'))).toHaveLength(
      0
    );
  });
});

describe('local actions become the room state', () => {
  it('sends a pause with the local position once aligned', async () => {
    const { player, effects } = setup();
    await flush();
    player.currentTime = 130;
    player.userPause();
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:pause',
      expect.objectContaining({
        currentTime: 130,
        videoId: 'film-a',
        episode: 1,
      })
    );
  });

  it('sends a seek', async () => {
    const { player, effects } = setup();
    await flush();
    clock += 5_000; // outside the expected-event window of the initial alignment
    player.userSeek(300);
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:seek',
      expect.objectContaining({ currentTime: 300, isPlaying: true })
    );
  });

  it('without control, a local pause is reverted with an explanation and nothing is sent', async () => {
    const { player, effects } = setup({ canControl: false });
    await flush();
    player.userPause();
    await flush();
    jest.advanceTimersByTime(300);
    expect(effects.command).not.toHaveBeenCalled();
    expect(player.paused).toBe(false);
    expect(player.notices).toContain(
      '房主没有开放成员控制播放，已回到房间进度'
    );
  });

  it('a local episode change after alignment becomes the room film, starting where the player is', async () => {
    const { engine, player, effects, state } = setup();
    await flush();
    player.currentTime = 0;
    engine.update({ ...state, local: local({ episode: 2 }) });
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:change',
      expect.objectContaining({ episode: 2, currentTime: 0, isPlaying: true })
    );
    expect(effects.follow).not.toHaveBeenCalled();
  });

  it('without control, a local episode change goes back to the room film', async () => {
    const { engine, player, effects, state } = setup({ canControl: false });
    await flush();
    engine.update({ ...state, local: local({ episode: 2 }) });
    await flush();
    expect(effects.command).not.toHaveBeenCalled();
    expect(player.notices).toContain('房主没有开放成员换片，已回到房间影片');
    expect(effects.follow).toHaveBeenCalledWith(
      expect.objectContaining({ episode: 1 })
    );
  });

  it('a film chosen to watch together replaces the room film even before this device was aligned', async () => {
    const { engine, effects, state } = setup({ local: null });
    await flush();
    engine.intend(null);
    engine.update({
      ...state,
      local: local({ videoId: 'film-b', queueItemId: 'q1' }),
    });
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:change',
      expect.objectContaining({
        videoId: 'film-b',
        queueItemId: 'q1',
        isPlaying: true,
      })
    );
  });
});

describe('an empty room', () => {
  it('takes over the film this device is watching, keeping its position and paused state', async () => {
    const player = new FakePlayer();
    player.currentTime = 37;
    player.paused = true;
    const effects = {
      command: jest.fn(async () => ({ success: true })),
      follow: jest.fn(),
      stopLocal: jest.fn(),
      serverNow: () => clock,
      now: () => clock,
    };
    const engine = new RoomSyncEngine(effects);
    engine.setPort(player);
    engine.update({
      roomId: 'room-1',
      connected: true,
      canControl: true,
      state: null,
      local: local(),
    });
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:change',
      expect.objectContaining({
        videoId: 'film-a',
        currentTime: 37,
        isPlaying: false,
      })
    );
  });

  it('does not take the film over again after the room was cleared', async () => {
    const { engine, effects, state } = setup();
    await flush();
    engine.update({ ...state, state: null });
    await flush();
    expect(effects.command).not.toHaveBeenCalled();
  });

  it('without control, puts the unrelated local film away once', async () => {
    const { engine, effects, state } = setup({
      canControl: false,
      state: null,
    });
    await flush();
    engine.update({ ...state });
    await flush();
    expect(effects.stopLocal).toHaveBeenCalledTimes(1);
    expect(effects.command).not.toHaveBeenCalled();
  });
});

it('a new room starts with a clean slate', async () => {
  const { engine, effects, state } = setup();
  await flush();
  engine.update({
    ...state,
    roomId: 'room-2',
    state: film({ videoId: 'film-c' }),
  });
  await flush();
  expect(effects.follow).toHaveBeenCalledWith(
    expect.objectContaining({ videoId: 'film-c' })
  );
});
