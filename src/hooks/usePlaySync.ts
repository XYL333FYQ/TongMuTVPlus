'use client';

/*
 * 一起看：本机播放器 <-> 房间播放状态的双向同步（参照 SyncTV 的做法）。
 *
 * - 房间状态只有一份：{ currentTime, isPlaying, playbackRate, updatedAt, version }。
 *   本机按服务器时钟推算“此刻应在哪”，偏差超过阈值才跳转，避免反复卡顿。
 * - 有控制权的人（房主 / 管理员 / 房间开放成员控制时的所有成员）在播放器上
 *   播放、暂停、拖动、改倍速、切集，都会立即成为整个房间的状态。
 * - 没有控制权的人操作会被拉回房间进度，并提示原因，而不是悄悄被覆盖。
 * - 本机为了跟随房间而做的播放/暂停/跳转会产生同样的播放器事件，
 *   这里用“预期事件”抵消，避免回声把房间来回拉扯。
 */

import { useCallback, useEffect, useRef } from 'react';

import { roomServerNow } from '@/lib/room-clock';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';
import { roomActivityKey } from '@/features/playback/room-activity';
import {
  playbackHrefFromState,
  playbackIdentity,
} from '@/features/playback/session';

import type { PlayState } from '@/types/watch-room';

let lastRemotePlaybackRate: number | null = null;
let remoteRateApplyUntil = 0;
let isFollowingRoom = false;

/** 播放器内部恢复倍速时用：正在跟随房间倍速的短时间窗口内不要覆盖。 */
export function isRemoteRoomRateActive() {
  return isFollowingRoom && Date.now() < remoteRateApplyUntil;
}
export function getRoomRemotePlaybackRate() {
  return isFollowingRoom ? lastRemotePlaybackRate : null;
}

interface SyncPlayer {
  video: Pick<
    HTMLVideoElement,
    'readyState' | 'seeking' | 'paused' | 'duration'
  > &
    Partial<Pick<HTMLVideoElement, 'ended'>>;
  currentTime: number;
  playbackRate: number;
  notice?: { show: string };
  play: () => Promise<unknown> | void;
  pause: () => unknown;
  on: (event: string, listener: () => void) => unknown;
  off: (event: string, listener: () => void) => unknown;
}
interface UsePlaySyncOptions {
  artPlayerRef: React.MutableRefObject<SyncPlayer | null>;
  videoId: string;
  videoName: string;
  videoYear?: string;
  searchTitle?: string;
  poster?: string;
  currentEpisode?: number;
  currentSource: string;
  videoUrl: string;
  playerReady: boolean;
  mediaLoading?: boolean;
}

/** 播放中允许的最大偏差：超过才跳转。 */
export const PLAYING_DRIFT_SECONDS = 1.2;
/** 刚收到别人的操作（版本变化）时更严格地对齐。 */
export const CHANGED_DRIFT_SECONDS = 0.4;
/** 暂停时位置应当基本一致。 */
export const PAUSED_DRIFT_SECONDS = 0.3;
/** 自动纠偏跳转的最小间隔，避免弱网下反复跳转。 */
const AUTO_SEEK_COOLDOWN_MS = 3000;

export const roomMediaKey = (
  state: Pick<PlayState, 'source' | 'videoId' | 'episode'>
) => `${state.source}\u0000${state.videoId}\u0000${state.episode || 1}`;

/** 房间状态在服务器时间 now 时应当播放到的位置。 */
export function expectedRoomTime(state: PlayState, now = roomServerNow()) {
  const base = Math.max(0, state.currentTime || 0);
  if (!state.isPlaying || !state.updatedAt) return base;
  return (
    base +
    (Math.max(0, now - state.updatedAt) / 1000) * (state.playbackRate || 1)
  );
}

type Expected = { until: number; count: number };
type ExpectKind = 'play' | 'pause' | 'seek' | 'rate';

export function usePlaySync(options: UsePlaySyncOptions) {
  const watchRoom = useWatchRoomContextSafe();
  const session = usePlaybackSessionSafe();
  const latest = useRef({ options, watchRoom, session });
  latest.current = { options, watchRoom, session };

  const isInRoom = Boolean(
    watchRoom?.currentRoom && session?.followingRoom !== false
  );
  const canControl = Boolean(isInRoom && watchRoom?.canControl);

  // 已经与房间对齐过的影片（只有对齐过，本机的操作才算用户意图）
  const syncedKey = useRef('');
  // 已经请求跟随的房间影片，避免每次检查都重复请求换片
  const requestedKey = useRef('');
  const appliedVersion = useRef<number | undefined>();
  const lastAutoSeekAt = useRef(0);
  const pendingUntil = useRef(0);
  const changeInFlight = useRef(false);
  const expected = useRef<Record<ExpectKind, Expected>>({
    play: { until: 0, count: 0 },
    pause: { until: 0, count: 0 },
    seek: { until: 0, count: 0 },
    rate: { until: 0, count: 0 },
  });
  const autoplayBlocked = useRef(false);
  const lastNoticeVersion = useRef<number | undefined>();
  const scope = useRef(0);

  const requestedFor = useRef('');

  const expect = useCallback((kind: ExpectKind, ms = 2500) => {
    const entry = expected.current[kind];
    entry.count = Date.now() > entry.until ? 1 : entry.count + 1;
    entry.until = Date.now() + ms;
  }, []);
  const consume = useCallback((kind: ExpectKind) => {
    const entry = expected.current[kind];
    if (entry.count > 0 && Date.now() <= entry.until) {
      entry.count -= 1;
      return true;
    }
    entry.count = 0;
    return false;
  }, []);

  const notice = useCallback((message: string) => {
    const player = latest.current.options.artPlayerRef.current;
    if (player?.notice) player.notice.show = message;
  }, []);
  // 播放器自己会在播放/暂停时弹出“播放”“暂停”，稍后再显示是谁操作的，避免被覆盖。
  const deferredNotice = useCallback(
    (message: string) => {
      window.setTimeout(() => notice(message), 250);
    },
    [notice]
  );

  const localKey = useCallback(() => {
    const { options: current } = latest.current;
    if (!current.videoId || !current.currentSource) return '';
    return roomMediaKey({
      source: current.currentSource,
      videoId: current.videoId,
      episode: current.currentEpisode,
    });
  }, []);

  const localPlayState = useCallback(
    (overrides: Partial<PlayState> = {}): PlayState | null => {
      const { options: current, session: playback } = latest.current;
      const player = current.artPlayerRef.current;
      if (!current.videoId || !current.currentSource) return null;
      let sharedUrl = '';
      try {
        // 本机缓存 / blob 地址对别人没有意义；只分享可直接访问的 HTTP(S) 地址，
        // 其他成员会按 source/id/集数自己解析片源。
        const parsed = new URL(current.videoUrl, window.location.origin);
        if (
          ['http:', 'https:'].includes(parsed.protocol) &&
          !parsed.username &&
          !parsed.password
        )
          sharedUrl = parsed.href;
      } catch {
        // 保留稳定的影片引用即可
      }
      const queueItemId =
        new URL(
          playback?.href || '/play',
          window.location.origin
        ).searchParams.get('queueId') || undefined;
      return {
        type: 'play',
        queueItemId,
        url: sharedUrl,
        videoId: current.videoId,
        videoName: current.videoName,
        videoYear: current.videoYear,
        searchTitle: current.searchTitle,
        ...(current.poster && /^https?:\/\//i.test(current.poster)
          ? { poster: current.poster }
          : {}),
        episode: current.currentEpisode || 1,
        source: current.currentSource,
        currentTime: Math.max(0, Number(player?.currentTime) || 0),
        isPlaying: player ? !player.video.paused : true,
        playbackRate: Number(player?.playbackRate) || 1,
        ...overrides,
      };
    },
    []
  );

  /** 把本机播放器对齐到房间状态。force：忽略纠偏冷却。 */
  const applyRoomState = useCallback(
    async (state: PlayState, force = false) => {
      const player = latest.current.options.artPlayerRef.current;
      if (!player?.video) return;
      const video = player.video;
      const versionChanged = state.version !== appliedVersion.current;
      appliedVersion.current = state.version;

      const rate = state.playbackRate || 1;
      lastRemotePlaybackRate = rate;
      if (Math.abs((player.playbackRate || 1) - rate) > 0.01) {
        remoteRateApplyUntil = Date.now() + 1500;
        expect('rate');
        player.playbackRate = rate;
      }

      const duration = Number(video.duration);
      let target = expectedRoomTime(state);
      const finite = Number.isFinite(duration) && duration > 0;
      const reachedEnd = finite && target >= duration - 0.25;
      if (finite) target = Math.min(target, Math.max(0, duration - 0.05));
      const shouldPlay = state.isPlaying && !reachedEnd;

      if (!shouldPlay && !video.paused) {
        expect('pause');
        player.pause();
      }
      const drift = Math.abs((Number(player.currentTime) || 0) - target);
      const threshold = !shouldPlay
        ? PAUSED_DRIFT_SECONDS
        : versionChanged || force
        ? CHANGED_DRIFT_SECONDS
        : PLAYING_DRIFT_SECONDS;
      // 正在缓冲时不追：缓冲中的播放器位置本来就落后，追了只会反复卡住。
      const buffering = video.seeking || video.readyState < 3;
      const cooled =
        force ||
        versionChanged ||
        Date.now() - lastAutoSeekAt.current > AUTO_SEEK_COOLDOWN_MS;
      if (
        drift > threshold &&
        (!shouldPlay || !buffering || versionChanged || force) &&
        cooled
      ) {
        lastAutoSeekAt.current = Date.now();
        expect('seek');
        player.currentTime = target;
      }
      if (shouldPlay && video.paused) {
        expect('play');
        try {
          await player.play();
          autoplayBlocked.current = false;
        } catch {
          // 浏览器不允许无交互自动播放：提示一次，用户点播放后会自动对齐房间进度。
          consume('play');
          if (!autoplayBlocked.current) {
            autoplayBlocked.current = true;
            notice('点击播放，加入房间同步');
          }
        }
      }
    },
    [notice, expect, consume]
  );

  /** 别人操作后在画面上提示一下是谁做了什么（SyncTV 风格）。 */
  const announce = useCallback(
    (state: PlayState, previous: PlayState | null) => {
      if (state.version === undefined) return;
      if (lastNoticeVersion.current === state.version) return;
      const first = lastNoticeVersion.current === undefined;
      lastNoticeVersion.current = state.version;
      if (first || !previous || !state.updatedBy) return;
      const me = latest.current.watchRoom?.members.find(
        (member) => member.id === latest.current.watchRoom?.socket?.id
      )?.accountId;
      if (state.updatedBy === me) return;
      if (roomMediaKey(previous) !== roomMediaKey(state)) return;
      if (previous.isPlaying !== state.isPlaying)
        deferredNotice(
          `${state.updatedBy} ${state.isPlaying ? '继续播放' : '暂停了'}`
        );
      else if (
        Math.abs(
          expectedRoomTime(previous, state.updatedAt) - state.currentTime
        ) > 2
      )
        deferredNotice(`${state.updatedBy} 调整了进度`);
      else if ((previous.playbackRate || 1) !== (state.playbackRate || 1))
        deferredNotice(
          `${state.updatedBy} 把倍速调为 ${state.playbackRate || 1}x`
        );
    },
    [deferredNotice]
  );

  /** 发送换片：本机切集/换源，或在房间里明确选择了一部影片。 */
  const sendChange = useCallback(
    async (state: PlayState, selection?: string) => {
      const { watchRoom: roomContext, session: playback } = latest.current;
      if (!roomContext?.currentRoom || changeInFlight.current) return;
      changeInFlight.current = true;
      const generation = scope.current;
      pendingUntil.current = Date.now() + 4000;
      try {
        await roomContext.roomCommand('play:change', { ...state });
        if (generation !== scope.current) return;
        syncedKey.current = roomMediaKey(state);
        requestedKey.current = syncedKey.current;
        if (selection) playback?.clearRoomSelection(selection);
      } catch (error) {
        if (generation !== scope.current) return;
        const code = (error as { code?: string } | null)?.code;
        // 选中的待看项已被移除，或没有权限：放弃这次选择，回到房间当前影片。
        if (selection) playback?.clearRoomSelection(selection);
        if (code === 'NO_CONTROL_PERMISSION')
          notice('房主没有开放成员换片，已回到房间影片');
        requestedKey.current = '';
      } finally {
        if (generation === scope.current) {
          changeInFlight.current = false;
          pendingUntil.current = Date.now() + 300;
        }
      }
    },
    [notice]
  );

  /** 主循环：决定跟随房间、上报换片，还是只做纠偏。 */
  const synchronize = useCallback(
    async (force = false) => {
      const {
        options: current,
        watchRoom: roomContext,
        session: playback,
      } = latest.current;
      const room = roomContext?.currentRoom;
      const player = current.artPlayerRef.current;
      if (
        !room ||
        !roomContext?.isConnected ||
        playback?.followingRoom === false ||
        !player?.video
      )
        return;
      const state = room.currentState;

      // 1. 在房间里明确选了一部影片（立即一起看 / 分享当前影片）
      const selection = playback?.roomSelectionHref;
      if (selection && roomContext.canControl) {
        const matches = playback.roomSelectionKey
          ? playback.roomSelectionKey === roomActivityKey(room)
          : true;
        if (!matches) {
          playback.clearRoomSelection(selection);
          return;
        }
        const ready =
          current.playerReady &&
          !current.mediaLoading &&
          player.video.readyState >= 1 &&
          playback.href &&
          playbackIdentity(playback.href) === playbackIdentity(selection);
        if (!ready) return;
        const fromQueue = new URL(
          selection,
          window.location.origin
        ).searchParams.has('queueId');
        const next = localPlayState({
          // 从片单开播从头开始；分享自己正在看的影片则接着当前进度。
          currentTime: fromQueue ? 0 : Math.max(0, player.currentTime || 0),
          isPlaying: true,
        });
        if (next) {
          if (fromQueue && player.currentTime > 1) {
            expect('seek');
            player.currentTime = 0;
          }
          await sendChange(next, selection);
        }
        return;
      }

      if (!state) return;
      if (state.type !== 'play') {
        // 房间切到直播/音乐/共享：电影播放器停下，避免两路声音。
        if (!player.video.paused) {
          expect('pause');
          player.pause();
        }
        return;
      }
      const roomKey = roomMediaKey(state);
      const local = localKey();

      // 2. 本机影片和房间不同
      if (local !== roomKey) {
        const localAdvance =
          Boolean(local) &&
          syncedKey.current !== '' &&
          syncedKey.current !== local &&
          syncedKey.current === roomKey;
        if (localAdvance && current.playerReady && !current.mediaLoading) {
          if (roomContext.canControl) {
            // 本机切了集（含自动连播）：从头开始；只换了片源（同一集）：接着当前进度。
            const sameEpisode =
              (current.currentEpisode || 1) === (state.episode || 1);
            const startAt = sameEpisode
              ? Math.max(0, player.currentTime || 0)
              : 0;
            if (!sameEpisode && player.currentTime > 1) {
              expect('seek');
              player.currentTime = 0;
            }
            const next = localPlayState({
              currentTime: startAt,
              isPlaying: true,
              queueItemId: undefined,
            });
            if (next) await sendChange(next);
            return;
          }
          notice('房主没有开放成员换片，已回到房间影片');
        }
        // 同一组（房间影片, 本机影片）只请求一次跟随，避免加载期间反复换片
        const pair = `${roomKey}|${local}`;
        if (requestedFor.current !== pair || force) {
          requestedFor.current = pair;
          requestedKey.current = roomKey;
          playback?.requestPlayback(playbackHrefFromState(state), 'room');
        }
        return;
      }

      // 3. 同一部影片：纠偏
      if (
        !current.playerReady ||
        current.mediaLoading ||
        player.video.readyState < 1
      )
        return;
      if (!force && Date.now() < pendingUntil.current) return;
      requestedKey.current = roomKey;
      await applyRoomState(state, force);
      syncedKey.current = roomKey;
    },
    [applyRoomState, localKey, localPlayState, sendChange, notice, expect]
  );

  // 房间或跟随状态变化：重置本机同步记录
  const roomId = watchRoom?.currentRoom?.id;
  useEffect(() => {
    scope.current += 1;
    syncedKey.current = '';
    requestedKey.current = '';
    requestedFor.current = '';
    appliedVersion.current = undefined;
    lastNoticeVersion.current = undefined;
    pendingUntil.current = 0;
    changeInFlight.current = false;
    isFollowingRoom = isInRoom;
    if (!isInRoom) lastRemotePlaybackRate = null;
    return () => {
      isFollowingRoom = false;
    };
  }, [isInRoom, roomId]);

  // 房间状态一变化就立即对齐（不等定时器），并提示是谁做的操作
  const roomState = watchRoom?.currentRoom?.currentState;
  const previousState = useRef<PlayState | null>(null);
  useEffect(() => {
    if (!isInRoom || !options.playerReady) return;
    if (roomState?.type === 'play') {
      announce(roomState, previousState.current);
      previousState.current = roomState;
    } else previousState.current = null;
    void synchronize();
  }, [isInRoom, options.playerReady, roomState, announce, synchronize]);

  // 定时检查：弥补缓冲、标签页后台、时钟漂移带来的偏差
  useEffect(() => {
    if (!isInRoom || !options.playerReady) return;
    const timer = window.setInterval(() => void synchronize(), 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void synchronize(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isInRoom, options.playerReady, synchronize]);

  // 本机播放器上的操作 -> 房间
  useEffect(() => {
    if (!isInRoom || !options.playerReady) return;
    const player = options.artPlayerRef.current;
    if (!player) return;

    const send = async (event: string, extra: Partial<PlayState> = {}) => {
      const { watchRoom: roomContext, options: current } = latest.current;
      const room = roomContext?.currentRoom;
      const state = room?.currentState;
      const instance = current.artPlayerRef.current;
      if (!roomContext || !room || state?.type !== 'play' || !instance) return;
      if (!roomContext.canControl) {
        // 没有控制权：回到房间进度并说明原因
        deferredNotice('房主没有开放成员控制播放，已回到房间进度');
        void applyRoomState(state, true);
        return;
      }
      const generation = scope.current;
      pendingUntil.current = Date.now() + 3000;
      try {
        await roomContext.roomCommand(event, {
          currentTime: Math.max(0, Number(instance.currentTime) || 0),
          playbackRate: Number(instance.playbackRate) || 1,
          source: current.currentSource,
          videoId: current.videoId,
          episode: current.currentEpisode || 1,
          ...extra,
        });
      } catch {
        // 命令失败（断线、影片已被别人切换）：以房间为准重新对齐
        if (generation === scope.current) {
          pendingUntil.current = 0;
          void synchronize(true);
        }
        return;
      }
      if (generation === scope.current) pendingUntil.current = Date.now() + 300;
    };

    // 只有已经和房间对齐过同一部影片，本机事件才算用户的操作；
    // 加载、自动播放、恢复个人进度等内部动作都发生在对齐之前。
    const ownsEvent = () => {
      const { watchRoom: roomContext } = latest.current;
      const state = roomContext?.currentRoom?.currentState;
      return (
        Boolean(roomContext?.isConnected) &&
        state?.type === 'play' &&
        syncedKey.current === roomMediaKey(state) &&
        localKey() === syncedKey.current
      );
    };
    const roomPlayState = () => {
      const state = latest.current.watchRoom?.currentRoom?.currentState;
      return state?.type === 'play' ? state : null;
    };
    const onPlay = () => {
      if (consume('play') || !ownsEvent()) return;
      autoplayBlocked.current = false;
      // 房间本来就在播放（例如自动播放被拦截后用户点了播放）：
      // 追上房间进度即可，不能拿本机过时的位置把所有人拉回去。
      if (roomPlayState()?.isPlaying) {
        void synchronize(true);
        return;
      }
      void send('play:play');
    };
    const onPause = () => {
      const instance = latest.current.options.artPlayerRef.current;
      // 播到结尾的自然暂停不是用户操作
      if (consume('pause') || !ownsEvent() || instance?.video.ended) return;
      if (roomPlayState()?.isPlaying === false) return;
      void send('play:pause');
    };
    const onSeeked = () => {
      const instance = latest.current.options.artPlayerRef.current;
      if (consume('seek') || !ownsEvent() || !instance) return;
      void send('play:seek', { isPlaying: !instance.video.paused });
    };
    const onRate = () => {
      const instance = latest.current.options.artPlayerRef.current;
      if (consume('rate') || !ownsEvent() || !instance) return;
      if (
        Math.abs(
          (roomPlayState()?.playbackRate || 1) - (instance.playbackRate || 1)
        ) < 0.01
      )
        return;
      void send('play:rate');
    };
    player.on('video:play', onPlay);
    player.on('video:pause', onPause);
    player.on('video:seeked', onSeeked);
    player.on('video:ratechange', onRate);
    return () => {
      player.off('video:play', onPlay);
      player.off('video:pause', onPause);
      player.off('video:seeked', onSeeked);
      player.off('video:ratechange', onRate);
    };
  }, [
    isInRoom,
    options.playerReady,
    options.artPlayerRef,
    applyRoomState,
    localKey,
    deferredNotice,
    synchronize,
    consume,
  ]);

  const broadcastPlayState = useCallback(
    async (force = false) => {
      await synchronize(force);
    },
    [synchronize]
  );

  return {
    isInRoom,
    isOwner: canControl,
    canControl,
    shouldDisableControls: isInRoom && !canControl,
    broadcastPlayState,
  };
}
