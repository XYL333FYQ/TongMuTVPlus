/*
 * 一起看的同步引擎（参照 SyncTV）。纯逻辑，不依赖 React，也不认识具体播放器。
 *
 * 输入：房间当前活动、本机权限、本机播放器实际在放什么（LocalMedia）、播放器接口（PlayerPort）。
 * 输出：通过 SyncEffects 发房间命令、让本机打开房间影片、或收起本机影片。
 *
 * 规则：
 * 1. 房间里只有一份播放状态，最后操作的人说了算（有控制权的人：房主 / 管理员 /
 *    房间开放成员控制时的所有成员）。
 * 2. 本机影片和房间不同：
 *    - 本机是“从房间影片换过去的”（切集、换源、自动连播），或用户刚明确要一起看
 *      这一部（intend），且有控制权 → 这部成为房间影片；
 *    - 否则跟随房间（打开房间影片）。没有控制权还换片的，提示后回到房间影片。
 * 3. 空房间：本机正放着影片且有控制权 → 带进房间（接着当前进度）；
 *    没有控制权 → 收起本机影片，等房间开始播放。
 * 4. 同一部影片：按服务器时钟推算位置，偏差超过阈值才跳；缓冲中不追。
 * 5. 本机为对齐房间做的播放/暂停/跳转/倍速会产生同样的播放器事件，用“预期事件”
 *    抵消，避免回声。只有对齐过之后的本机事件才算用户操作。
 */

import {
  AUTO_SEEK_COOLDOWN_MS,
  CHANGED_DRIFT_SECONDS,
  expectedRoomTime,
  mediaKey,
  PAUSED_DRIFT_SECONDS,
  PLAYING_DRIFT_SECONDS,
} from './drift';

import type { PlayState, Room } from '@/types/watch-room';

export type PlayerEvent = 'play' | 'pause' | 'seeked' | 'ratechange';

/** 同步引擎需要的最小播放器能力。 */
export interface PlayerPort {
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly readyState: number;
  readonly seeking: boolean;
  readonly playbackRate: number;
  play(): Promise<unknown> | void;
  pause(): void;
  seek(time: number): void;
  setRate(rate: number): void;
  notice(message: string): void;
  on(event: PlayerEvent, listener: () => void): () => void;
}

/** 本机播放器实际在放的影片（由播放页上报）。 */
export interface LocalMedia {
  source: string;
  videoId: string;
  episode: number;
  videoName: string;
  videoYear?: string;
  searchTitle?: string;
  poster?: string;
  url?: string;
  queueItemId?: string;
  /** 影片已解析并装进播放器，可以读位置、可以对齐 */
  ready: boolean;
}

export interface SyncInput {
  roomId: string | null;
  connected: boolean;
  canControl: boolean;
  state: Room['currentState'] | null | undefined;
  /** 本机账号，用于不提示自己的操作 */
  selfAccountId?: string;
  local: LocalMedia | null;
}

export interface SyncEffects {
  command(event: string, payload: Record<string, unknown>): Promise<unknown>;
  /** 本机打开房间这部影片 */
  follow(state: PlayState): void;
  /** 本机收起与房间无关的影片 */
  stopLocal(): void;
  /** 服务器时间（毫秒） */
  serverNow(): number;
  /** 本机时间（毫秒），用于冷却与预期事件 */
  now(): number;
}

type ExpectKind = 'play' | 'pause' | 'seek' | 'rate';
const NO_ROOM: SyncInput = {
  roomId: null,
  connected: false,
  canControl: false,
  state: null,
  local: null,
};

const keyOf = (media: { source: string; videoId: string; episode?: number }) =>
  mediaKey(media);

function shareableUrl(value: string | undefined) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : '';
  } catch {
    return '';
  }
}

export class RoomSyncEngine {
  private input: SyncInput = NO_ROOM;
  private port: PlayerPort | null = null;
  private unsubscribe: Array<() => void> = [];

  /** 本机已经和房间对齐过的影片 */
  private alignedKey = '';
  /** 已经请求本机打开的房间影片（同一组房间/本机影片只请求一次） */
  private followedPair = '';
  /** 用户明确要一起看的影片：key 为空表示“接下来本机换上的那一部” */
  private intent: { key: string | null; until: number } | null = null;
  private stoppedForRoom = '';
  private appliedVersion: number | undefined;
  private lastAutoSeekAt = 0;
  /** 本机命令在途：这段时间不按房间旧状态纠偏 */
  private pendingUntil = 0;
  private changeInFlight = false;
  private autoplayBlocked = false;
  private noticedVersion: number | undefined;
  private previousState: PlayState | null = null;
  private generation = 0;
  private expected: Record<ExpectKind, { until: number; count: number }> = {
    play: { until: 0, count: 0 },
    pause: { until: 0, count: 0 },
    seek: { until: 0, count: 0 },
    rate: { until: 0, count: 0 },
  };
  /** 最近一次跟随的房间倍速；播放器恢复个人倍速时用 */
  remoteRate: number | null = null;
  private remoteRateUntil = 0;

  constructor(private readonly effects: SyncEffects) {}

  // ---------------------------------------------------------------- 输入

  setPort(port: PlayerPort | null) {
    if (port === this.port) return;
    this.unsubscribe.forEach((off) => off());
    this.unsubscribe = [];
    this.port = port;
    if (!port) return;
    this.unsubscribe = [
      port.on('play', () => this.onPlay()),
      port.on('pause', () => this.onPause()),
      port.on('seeked', () => this.onSeeked()),
      port.on('ratechange', () => this.onRate()),
    ];
    void this.tick(true);
  }

  update(input: SyncInput) {
    const previous = this.input;
    if (previous.roomId !== input.roomId) this.reset();
    this.input = input;
    const state = input.state;
    if (state?.type === 'play') {
      this.announce(state, this.previousState);
      this.previousState = state;
    } else this.previousState = null;
    void this.tick();
  }

  /** 用户明确要一起看某一部（选片 / 片单开播）。key 未知时传 null。 */
  intend(key: string | null) {
    this.intent = { key, until: this.effects.now() + 30000 };
  }

  get inRoom() {
    return Boolean(this.input.roomId);
  }

  /** 正在跟随房间倍速的短时间窗口：播放器不要把它记成个人偏好 */
  isApplyingRemoteRate() {
    return this.inRoom && this.effects.now() < this.remoteRateUntil;
  }

  dispose() {
    this.setPort(null);
    this.reset();
    this.input = NO_ROOM;
  }

  // ---------------------------------------------------------------- 主循环

  async tick(force = false) {
    const { roomId, connected, canControl, state, local } = this.input;
    const port = this.port;
    if (!roomId || !connected) return;

    // 1. 空房间
    if (!state) {
      if (!local) return;
      if (canControl) {
        if (local.ready && port && this.isLocalIntent(local, ''))
          // 带进房间：保持本机此刻的播放/暂停；明确选片则直接开播
          await this.sendChange(local, port, this.hasIntent() || !port.paused);
        return;
      }
      if (this.stoppedForRoom !== roomId) {
        this.stoppedForRoom = roomId;
        this.effects.stopLocal();
      }
      return;
    }

    // 2. 房间在直播 / 音乐 / 屏幕共享：电影停下，避免两路声音
    if (state.type !== 'play') {
      if (port && !port.paused) {
        this.expect('pause');
        port.pause();
      }
      return;
    }

    const roomKey = keyOf(state);
    const localKey = local ? keyOf(local) : '';

    // 3. 本机影片和房间不同
    if (localKey !== roomKey) {
      if (local?.ready && port && this.isLocalIntent(local, roomKey)) {
        if (canControl) {
          await this.sendChange(local, port, true);
          return;
        }
        port.notice('房主没有开放成员换片，已回到房间影片');
        this.intent = null;
      }
      const pair = `${roomKey}|${localKey}`;
      if (this.followedPair !== pair || force) {
        this.followedPair = pair;
        this.effects.follow(state);
      }
      return;
    }

    // 4. 同一部影片：纠偏
    if (!local?.ready || !port || port.readyState < 1) return;
    if (!force && this.effects.now() < this.pendingUntil) return;
    await this.apply(state, force);
    this.alignedKey = roomKey;
    this.followedPair = '';
  }

  // ---------------------------------------------------------------- 规则

  /** 本机这部影片是用户自己的意图（而不是还没跟上房间）。 */
  private isLocalIntent(local: LocalMedia, roomKey: string) {
    const key = keyOf(local);
    const intent = this.intent;
    if (intent && this.effects.now() <= intent.until) {
      if (intent.key === null || intent.key === key) return true;
    }
    // 从房间影片换出去的（切集 / 换源 / 自动连播）
    if (this.alignedKey && this.alignedKey === roomKey && key !== roomKey)
      return true;
    // 空房间：进来时手上就有影片，或在空房间里换上了新影片
    if (!roomKey) return key !== this.alignedKey;
    return false;
  }

  private hasIntent() {
    return Boolean(this.intent && this.effects.now() <= this.intent.until);
  }

  private async sendChange(
    local: LocalMedia,
    port: PlayerPort,
    isPlaying: boolean
  ) {
    if (this.changeInFlight) return;
    this.changeInFlight = true;
    const generation = this.generation;
    this.pendingUntil = this.effects.now() + 4000;
    const payload: PlayState = {
      type: 'play',
      source: local.source,
      videoId: local.videoId,
      episode: local.episode || 1,
      videoName: local.videoName,
      videoYear: local.videoYear,
      searchTitle: local.searchTitle,
      url: shareableUrl(local.url),
      ...(local.poster && /^https?:\/\//i.test(local.poster)
        ? { poster: local.poster }
        : {}),
      ...(local.queueItemId ? { queueItemId: local.queueItemId } : {}),
      currentTime: Math.max(0, Number(port.currentTime) || 0),
      isPlaying,
      playbackRate: Number(port.playbackRate) || 1,
    };
    try {
      await this.effects.command('play:change', { ...payload });
      if (generation !== this.generation) return;
      this.alignedKey = keyOf(local);
      this.intent = null;
    } catch (error) {
      if (generation !== this.generation) return;
      this.intent = null;
      // 不能再按“从房间影片换出去”重试：以房间为准
      this.alignedKey = '';
      const code = (error as { code?: string } | null)?.code;
      if (code === 'NO_CONTROL_PERMISSION')
        port.notice('房主没有开放成员换片，已回到房间影片');
    } finally {
      if (generation === this.generation) {
        this.changeInFlight = false;
        this.pendingUntil = this.effects.now() + 300;
      }
    }
  }

  /** 把本机播放器对齐到房间状态。 */
  private async apply(state: PlayState, force: boolean) {
    const port = this.port;
    if (!port) return;
    const versionChanged = state.version !== this.appliedVersion;
    this.appliedVersion = state.version;

    const rate = state.playbackRate || 1;
    this.remoteRate = rate;
    if (Math.abs((port.playbackRate || 1) - rate) > 0.01) {
      this.remoteRateUntil = this.effects.now() + 1500;
      this.expect('rate');
      port.setRate(rate);
    }

    const duration = Number(port.duration);
    let target = expectedRoomTime(state, this.effects.serverNow());
    const finite = Number.isFinite(duration) && duration > 0;
    const reachedEnd = finite && target >= duration - 0.25;
    if (finite) target = Math.min(target, Math.max(0, duration - 0.05));
    const shouldPlay = state.isPlaying && !reachedEnd;

    if (!shouldPlay && !port.paused) {
      this.expect('pause');
      port.pause();
    }
    const drift = Math.abs((Number(port.currentTime) || 0) - target);
    const threshold = !shouldPlay
      ? PAUSED_DRIFT_SECONDS
      : versionChanged || force
      ? CHANGED_DRIFT_SECONDS
      : PLAYING_DRIFT_SECONDS;
    // 缓冲中不追：位置本来就落后，追了只会反复卡住
    const buffering = port.seeking || port.readyState < 3;
    const cooled =
      force ||
      versionChanged ||
      this.effects.now() - this.lastAutoSeekAt > AUTO_SEEK_COOLDOWN_MS;
    if (
      drift > threshold &&
      (!shouldPlay || !buffering || versionChanged || force) &&
      cooled
    ) {
      this.lastAutoSeekAt = this.effects.now();
      this.expect('seek');
      port.seek(target);
    }
    if (shouldPlay && port.paused) {
      this.expect('play');
      try {
        await port.play();
        this.autoplayBlocked = false;
      } catch {
        // 浏览器不允许无交互自动播放：提示一次，用户点播放后会自动对齐
        this.consume('play');
        if (!this.autoplayBlocked) {
          this.autoplayBlocked = true;
          port.notice('点击播放，加入房间同步');
        }
      }
    }
  }

  /** 别人操作后在画面上提示是谁做了什么。 */
  private announce(state: PlayState, previous: PlayState | null) {
    if (state.version === undefined) return;
    if (this.noticedVersion === state.version) return;
    const first = this.noticedVersion === undefined;
    this.noticedVersion = state.version;
    if (first || !previous || !state.updatedBy) return;
    if (state.updatedBy === this.input.selfAccountId) return;
    if (keyOf(previous) !== keyOf(state)) return;
    let message = '';
    if (previous.isPlaying !== state.isPlaying)
      message = `${state.updatedBy} ${state.isPlaying ? '继续播放' : '暂停了'}`;
    else if (
      Math.abs(
        expectedRoomTime(previous, state.updatedAt || 0) - state.currentTime
      ) > 2
    )
      message = `${state.updatedBy} 调整了进度`;
    else if ((previous.playbackRate || 1) !== (state.playbackRate || 1))
      message = `${state.updatedBy} 把倍速调为 ${state.playbackRate || 1}x`;
    // 播放器自己会先弹“播放 / 暂停”，稍后再显示是谁做的
    if (message) setTimeout(() => this.port?.notice(message), 250);
  }

  // ---------------------------------------------------------------- 本机操作 -> 房间

  private roomPlayState() {
    const state = this.input.state;
    return state?.type === 'play' ? state : null;
  }

  /** 只有对齐过同一部影片，本机事件才算用户操作（加载、自动播放都在对齐之前）。 */
  private ownsEvent() {
    const state = this.roomPlayState();
    const local = this.input.local;
    return Boolean(
      this.input.roomId &&
        this.input.connected &&
        state &&
        local &&
        this.alignedKey === keyOf(state) &&
        keyOf(local) === this.alignedKey
    );
  }

  private async sendTransport(
    event: string,
    extra: Record<string, unknown> = {}
  ) {
    const state = this.roomPlayState();
    const port = this.port;
    const local = this.input.local;
    if (!state || !port || !local) return;
    if (!this.input.canControl) {
      setTimeout(
        () => this.port?.notice('房主没有开放成员控制播放，已回到房间进度'),
        250
      );
      void this.apply(state, true);
      return;
    }
    const generation = this.generation;
    this.pendingUntil = this.effects.now() + 3000;
    try {
      await this.effects.command(event, {
        currentTime: Math.max(0, Number(port.currentTime) || 0),
        playbackRate: Number(port.playbackRate) || 1,
        source: local.source,
        videoId: local.videoId,
        episode: local.episode || 1,
        ...extra,
      });
      if (generation === this.generation)
        this.pendingUntil = this.effects.now() + 300;
    } catch {
      // 断线或影片已被别人切换：以房间为准重新对齐
      if (generation === this.generation) {
        this.pendingUntil = 0;
        void this.tick(true);
      }
    }
  }

  private onPlay() {
    if (this.consume('play') || !this.ownsEvent()) return;
    this.autoplayBlocked = false;
    // 房间本来就在播（例如自动播放被拦截后用户点了播放）：追上房间即可
    if (this.roomPlayState()?.isPlaying) {
      void this.tick(true);
      return;
    }
    void this.sendTransport('play:play');
  }

  private onPause() {
    if (this.consume('pause') || !this.ownsEvent()) return;
    // 播到结尾的自然暂停不是用户操作
    if (this.port?.ended) return;
    if (this.roomPlayState()?.isPlaying === false) return;
    void this.sendTransport('play:pause');
  }

  private onSeeked() {
    if (this.consume('seek') || !this.ownsEvent() || !this.port) return;
    void this.sendTransport('play:seek', { isPlaying: !this.port.paused });
  }

  private onRate() {
    if (this.consume('rate') || !this.ownsEvent() || !this.port) return;
    const roomRate = this.roomPlayState()?.playbackRate || 1;
    if (Math.abs(roomRate - (this.port.playbackRate || 1)) < 0.01) return;
    void this.sendTransport('play:rate');
  }

  // ---------------------------------------------------------------- 工具

  private expect(kind: ExpectKind, ms = 2500) {
    const entry = this.expected[kind];
    const now = this.effects.now();
    entry.count = now > entry.until ? 1 : entry.count + 1;
    entry.until = now + ms;
  }

  private consume(kind: ExpectKind) {
    const entry = this.expected[kind];
    if (entry.count > 0 && this.effects.now() <= entry.until) {
      entry.count -= 1;
      return true;
    }
    entry.count = 0;
    return false;
  }

  private reset() {
    this.generation += 1;
    this.alignedKey = '';
    this.followedPair = '';
    this.intent = null;
    this.stoppedForRoom = '';
    this.appliedVersion = undefined;
    this.noticedVersion = undefined;
    this.previousState = null;
    this.pendingUntil = 0;
    this.changeInFlight = false;
    this.autoplayBlocked = false;
    this.remoteRate = null;
    this.remoteRateUntil = 0;
  }
}
