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
  bufferedAhead = 30;
  pauseUnconfirmed = false;
  notices: string[] = [];
  blockPlay = false;
  private listeners = new Map<PlayerEvent, Set<() => void>>();
  on(event: PlayerEvent, listener: () => void) {
    const set = this.listeners.get(event) || new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }
  /**
   * 真实播放器的事件不一定立刻到、也不一定到：慢网下 seeked 要等缓冲；
   * 跳转被下一次跳转打断时只有最后一次有 seeked；暂停后马上又播，
   * 房间播放器接口的暂停防抖会把这次 pause 丢掉。held 时事件先攒着，release() 再发。
   */
  held: PlayerEvent[] | null = null;
  emit(event: PlayerEvent) {
    if (this.held) {
      this.held.push(event);
      return;
    }
    this.listeners.get(event)?.forEach((listener) => listener());
  }
  hold() {
    this.held = [];
  }
  /** 发出攒着的事件；drop 列出的事件丢掉（模拟被打断或被防抖丢掉） */
  release(drop: PlayerEvent[] = []) {
    const events = this.held || [];
    this.held = null;
    events
      .filter((event) => !drop.includes(event))
      .forEach((event) => this.emit(event));
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
  userRate(rate: number) {
    this.setRate(rate);
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
    player.currentTime = 111; // expected 114: 3s behind -> catch up by speed
    await engine.tick();
    expect(player.currentTime).toBe(111);
    expect(player.playbackRate).toBeCloseTo(1.08);
  });

  it('asks the user to press play once when the browser blocks autoplay', async () => {
    const player = new FakePlayer();
    player.blockPlay = true;
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
      canControl: false,
      state: film(),
      selfAccountId: 'me',
      local: local(),
    });
    await flush();
    await engine.tick();
    await flush();
    expect(player.paused).toBe(true);
    expect(
      player.notices.filter((notice) => notice === '点击播放，加入房间同步')
    ).toHaveLength(1);
    // 用户点了播放：追上房间，不替房间发命令
    player.blockPlay = false;
    await player.play();
    await flush();
    expect(player.paused).toBe(false);
    expect(effects.command).not.toHaveBeenCalled();
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

describe('slow networks', () => {
  it('catches up a small lag by speeding up slightly instead of jumping', async () => {
    const { engine, player } = setup();
    await flush();
    clock += 10_000;
    player.currentTime = 107.5; // expected 110: 2.5s behind
    await engine.tick();
    expect(player.currentTime).toBe(107.5);
    expect(player.playbackRate).toBeCloseTo(1.08);
    // 追上后恢复原倍速
    player.currentTime = 110.1;
    clock += 0;
    await engine.tick();
    expect(player.playbackRate).toBe(1);
  });

  it('still jumps when far behind', async () => {
    const { engine, player } = setup();
    await flush();
    clock += 10_000;
    player.currentTime = 100;
    await engine.tick();
    expect(player.currentTime).toBe(110);
  });

  it('tells the room when this device is stuck buffering, and when it has buffered enough', async () => {
    const { engine, player, effects } = setup();
    await flush();
    player.readyState = 2;
    player.bufferedAhead = 0;
    await engine.tick();
    expect(effects.command).not.toHaveBeenCalledWith(
      'play:buffering',
      expect.anything()
    );
    clock += 2000;
    await engine.tick();
    expect(effects.command).toHaveBeenCalledWith('play:buffering', {
      buffering: true,
    });
    player.readyState = 4;
    player.bufferedAhead = 8;
    player.paused = true;
    await engine.tick();
    expect(effects.command).toHaveBeenLastCalledWith('play:buffering', {
      buffering: false,
    });
  });
});

describe('telling own alignment apart from user actions', () => {
  it('a user seek right after an interrupted alignment seek still reaches the room', async () => {
    const { engine, player, effects, state } = setup();
    await flush();
    // 别人拖到 200：本机跳过去，但这次跳转被下一次跳转打断，没有 seeked
    player.hold();
    engine.update({
      ...state,
      state: film({ currentTime: 200, version: 2, updatedAt: clock }),
    });
    await flush();
    expect(player.currentTime).toBe(200);
    player.release(['seeked']);
    clock += 500;
    player.userSeek(400);
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:seek',
      expect.objectContaining({ currentTime: 400 })
    );
    expect(player.currentTime).toBe(400);
  });

  it('a user pause right after a room buffering pause and resume still reaches the room', async () => {
    const { engine, player, effects, state } = setup();
    await flush();
    // 房间等别人缓冲：暂停，0.2 秒后继续。暂停防抖把这次 pause 丢了
    player.hold();
    engine.update({
      ...state,
      state: film({
        currentTime: 100,
        isPlaying: false,
        autoPaused: true,
        version: 2,
        updatedAt: clock,
      }),
    });
    await flush();
    clock += 200;
    engine.update({
      ...state,
      state: film({ currentTime: 100, version: 3, updatedAt: clock }),
    });
    await flush();
    player.release(['pause']);
    await flush();
    expect(player.paused).toBe(false);
    clock += 1000;
    player.currentTime = 101;
    player.userPause();
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:pause',
      expect.objectContaining({ currentTime: 101 })
    );
    // 本机没有被拉回播放
    await engine.tick();
    expect(player.paused).toBe(true);
  });

  it('the seeked of its own alignment seek is not sent, even when it arrives late on a slow network', async () => {
    const { engine, player, effects, state } = setup();
    await flush();
    player.hold();
    engine.update({
      ...state,
      state: film({
        currentTime: 300,
        isPlaying: false,
        version: 2,
        updatedAt: clock,
      }),
    });
    await flush();
    clock += 6_000; // 缓冲了好几秒才跳到
    player.release();
    await flush();
    expect(effects.command).not.toHaveBeenCalled();
    expect(player.currentTime).toBe(300);
  });

  it('a late ratechange from catching up is not sent as a speed change', async () => {
    const { engine, player, effects } = setup();
    await flush();
    player.hold();
    clock += 10_000;
    player.currentTime = 107.5; // 落后 2.5 秒：变速追赶
    await engine.tick();
    clock += 5_000;
    player.release();
    await flush();
    expect(player.playbackRate).toBeCloseTo(1.08);
    expect(effects.command).not.toHaveBeenCalled();
  });

  it('a user speed change is sent', async () => {
    const { player, effects } = setup();
    await flush();
    player.userRate(1.5);
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:rate',
      expect.objectContaining({ playbackRate: 1.5 })
    );
  });

  it('a pause right after pressing play goes to the room', async () => {
    const { engine, player, effects, state } = setup({
      state: film({ isPlaying: false }),
    });
    await flush();
    expect(player.paused).toBe(true);
    await player.play(); // 用户点播放
    await flush();
    expect(effects.command).toHaveBeenLastCalledWith(
      'play:play',
      expect.anything()
    );
    engine.update({
      ...state,
      state: film({ isPlaying: true, version: 2, updatedAt: clock }),
    });
    await flush();
    clock += 300;
    player.userPause();
    await flush();
    expect(effects.command).toHaveBeenLastCalledWith(
      'play:pause',
      expect.anything()
    );
  });

  it('does not restart a pause the player is still confirming as a user pause', async () => {
    const { engine, player, effects } = setup();
    await flush();
    // 用户按了暂停：视频已停，播放器接口还在等 0.3 秒确认不是切后台
    player.paused = true;
    player.pauseUnconfirmed = true;
    clock += 1000;
    await engine.tick();
    expect(player.paused).toBe(true);
    // 确认了：pause 事件到达，送给房间
    player.pauseUnconfirmed = false;
    player.emit('pause');
    await flush();
    expect(effects.command).toHaveBeenCalledWith(
      'play:pause',
      expect.anything()
    );
  });

  it('resumes at once after its own pause, even while the player is still confirming it', async () => {
    const { engine, player, state } = setup();
    await flush();
    engine.update({
      ...state,
      state: film({
        isPlaying: false,
        autoPaused: true,
        version: 2,
        updatedAt: clock,
      }),
    });
    await flush();
    expect(player.paused).toBe(true);
    player.pauseUnconfirmed = true; // 播放器接口还在确认这次（引擎自己的）暂停
    clock += 200;
    engine.update({
      ...state,
      state: film({ isPlaying: true, version: 3, updatedAt: clock }),
    });
    await flush();
    expect(player.paused).toBe(false);
  });
});
