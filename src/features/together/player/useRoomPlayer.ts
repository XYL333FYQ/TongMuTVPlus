'use client';

/*
 * 房间的播放器：只在房间页存在，离开房间页就销毁（不做小窗）。
 * 播放器永远跟着房间状态走；换片、换集、下一集都是发给服务器的命令，
 * 服务器广播新状态后本机再跟上。同步由 RoomSyncEngine 完成（时钟校准、变速追赶、等缓冲）。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { getDanmakuFilterConfig } from '@/lib/db.client';
import {
  DEFAULT_SEEK_STEP_SECONDS,
  loadStoredSeconds,
  SEEK_STEP_STORAGE_KEY,
} from '@/lib/player-seek-settings';
import { roomServerNow } from '@/lib/room-clock';
import type { SearchResult } from '@/lib/types';
import { base58Decode } from '@/lib/utils';

import { mediaKey } from '@/features/together/sync/drift';
import {
  type LocalMedia,
  RoomSyncEngine,
} from '@/features/together/sync/sync-engine';
import { fetchSourceDetail } from '@/features/together/media/catalog';
import { resolvePlayback } from '@/features/together/media/playback-url';
import {
  iosOrientationPlugin,
  playbackRatePlugin,
  progressThumbPlugin,
  seekButtonsPlugin,
  wakeLockPlugin,
} from '@/features/together/player/core/plugins/basics';
import { DanmakuController } from '@/features/together/player/core/plugins/danmaku';
import { heatmapPlugin } from '@/features/together/player/core/plugins/heatmap';
import { bindKeyboard } from '@/features/together/player/core/plugins/keyboard';
import {
  SourceSubtitle,
  SubtitleController,
} from '@/features/together/player/core/plugins/subtitles';
import { WatchPlayer } from '@/features/together/player/core/WatchPlayer';

import { portFor } from './port';

import type { PlayState, Room } from '@/types/watch-room';

export interface RoomCommands {
  roomCommand(
    event: string,
    payload?: Record<string, unknown>
  ): Promise<unknown>;
}

/** 房间影片的详情（选集、标题）：同一片源同一影片只取一次 */
const detailCache = new Map<string, Promise<SearchResult | null>>();

export function roomDetail(
  state: Pick<
    PlayState,
    'source' | 'videoId' | 'videoName' | 'searchTitle' | 'poster'
  >
) {
  const key = `${state.source}\u0000${state.videoId}`;
  let pending = detailCache.get(key);
  if (!pending) {
    if (state.source === 'directplay') {
      let url = '';
      try {
        url = base58Decode(state.videoId);
      } catch {
        url = '';
      }
      pending = Promise.resolve(
        url
          ? ({
              id: state.videoId,
              title: state.videoName || '直链播放',
              poster: state.poster || '',
              episodes: [url],
              episodes_titles: ['直链'],
              source: 'directplay',
              source_name: '直链',
              class: '',
              year: '',
              desc: '',
              type_name: '',
              douban_id: 0,
            } as SearchResult)
          : null
      );
    } else
      pending = fetchSourceDetail(
        state.source,
        state.videoId,
        state.searchTitle || state.videoName || ''
      ).catch(() => null);
    detailCache.set(key, pending);
    void pending.then((value) => {
      if (!value) detailCache.delete(key);
    });
  }
  return pending;
}

export interface RoomPlayerState {
  player: WatchPlayer | null;
  detail: SearchResult | null;
  /** 正在放的集（从 0 开始） */
  episodeIndex: number;
  loading: boolean;
  error: string | null;
  danmaku: DanmakuController;
  /** 在播放器上飘一条聊天弹幕 */
  shoot(text: string, self?: boolean): void;
}

export function useRoomPlayer(options: {
  container: HTMLElement | null;
  room: Room | null;
  connected: boolean;
  /** 可以播放 / 暂停 / 拖动 */
  canPlayback: boolean;
  commands: RoomCommands;
  /** 只在房间页启用快捷键（小窗里不抢别的页面的按键） */
  keyboard?: boolean;
}): RoomPlayerState {
  const { container, room } = options;
  const state =
    room?.currentState?.type === 'play'
      ? (room.currentState as PlayState)
      : null;
  const [player, setPlayer] = useState<WatchPlayer | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const [local, setLocal] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const notice = useCallback(
    (text: string) => playerRef.current?.notice(text),
    []
  );
  const playerRef = useRef<WatchPlayer | null>(null);
  const danmaku = useMemo(() => new DanmakuController(notice), [notice]);
  const subtitles = useMemo(
    () =>
      new SubtitleController(
        () => undefined,
        () => undefined
      ),
    []
  );
  const loadingKey = useRef('');

  const engine = useMemo(
    () =>
      new RoomSyncEngine({
        command: (event, payload) =>
          latest.current.commands.roomCommand(event, payload),
        // 跟随由下面的加载逻辑按房间状态完成
        follow: () => undefined,
        stopLocal: () => {
          playerRef.current?.pause();
        },
        serverNow: roomServerNow,
        now: () => Date.now(),
      }),
    []
  );
  useEffect(() => () => engine.dispose(), [engine]);

  // ------------------------------------------------------------ 播放器
  useEffect(() => {
    if (!container) return;
    let disposed = false;
    let instance: WatchPlayer | null = null;
    void Promise.all([import('artplayer-plugin-danmuku')]).then(
      ([danmakuModule]) => {
        if (disposed) return;
        instance = new WatchPlayer({
          container,
          // 一起看至少提前缓冲 2 分钟，网络时快时慢也不拖住整个房间
          minBufferAhead: 120,
          autoplay: false,
          rateControl: true,
          artPlugins: () => [danmaku.artPlugin((danmakuModule as any).default)],
          plugins: [
            wakeLockPlugin,
            playbackRatePlugin(() =>
              engine.inRoom ? engine.remoteRate : null
            ),
            progressThumbPlugin,
            iosOrientationPlugin,
            seekButtonsPlugin(() =>
              loadStoredSeconds(
                SEEK_STEP_STORAGE_KEY,
                DEFAULT_SEEK_STEP_SECONDS
              )
            ),
            ({ art }) => danmaku.attach(art),
            ({ art }) => subtitles.attach(art, [], ''),
            heatmapPlugin(() => danmaku.list()),
            ({ art }) => {
              art.on('video:canplay', () => {
                setLoading(false);
                setError(null);
              });
            },
          ],
          onError: (message) => {
            setLoading(false);
            setError(message);
          },
        });
        playerRef.current = instance;
        setPlayer(instance);
      }
    );
    void getDanmakuFilterConfig()
      .then((config) => danmaku.setFilter(config || { rules: [] }))
      .catch(() => undefined);
    return () => {
      disposed = true;
      engine.setPort(null);
      instance?.destroy();
      playerRef.current = null;
      setPlayer(null);
    };
  }, [container, danmaku, subtitles, engine]);

  useEffect(() => {
    engine.setPort(player ? portFor(player) : null);
  }, [engine, player]);

  // ------------------------------------------------------------ 跟随房间影片
  const roomKey = state ? mediaKey(state) : '';
  useEffect(() => {
    if (!player) return;
    if (!state) {
      loadingKey.current = '';
      setLocal(null);
      setDetail(null);
      setError(null);
      player.pause();
      return;
    }
    if (loadingKey.current === roomKey) return;
    loadingKey.current = roomKey;
    const key = roomKey;
    const stale = () => loadingKey.current !== key;
    setLoading(true);
    setError(null);
    setLocal(null);
    (async () => {
      const found = await roomDetail(state);
      if (stale()) return;
      if (!found) throw new Error('这部影片的片源打不开了，可以换一部');
      setDetail(found);
      const index = Math.max(0, (state.episode || 1) - 1);
      const resolved = await resolvePlayback(found, index, {
        canUseServerOffline: false,
        stale,
      });
      if (stale()) return;
      if (!resolved?.url) throw new Error('这一集没有播放地址');
      const multi = (found.episodes?.length || 0) > 1;
      await player.load({
        url: resolved.url,
        source: found.source,
        mediaType: resolved.mediaType,
        title: `${found.title}${
          multi
            ? ` · ${found.episodes_titles?.[index] || `第 ${index + 1} 集`}`
            : ''
        }`,
        poster: found.poster,
        qualities: resolved.qualities,
      });
      if (stale()) return;
      subtitles.setTracks(
        (found.subtitles?.[index] || []) as SourceSubtitle[],
        `${found.id}:${index}`
      );
      danmaku.setMedia(
        found.source === 'directplay'
          ? null
          : {
              title: found.title,
              year: found.year,
              episodeIndex: index,
              episodeTitles: found.episodes_titles,
              episodeCount: found.episodes?.length || 0,
            }
      );
      setLocal({
        source: state.source,
        videoId: state.videoId,
        episode: state.episode || 1,
        videoName: state.videoName,
        videoYear: state.videoYear,
        searchTitle: state.searchTitle,
        poster: state.poster,
        ready: true,
      });
    })().catch((reason) => {
      if (stale()) return;
      setLoading(false);
      setError(reason instanceof Error ? reason.message : '加载失败');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, roomKey]);

  // ------------------------------------------------------------ 同步
  const roomId = room?.id || null;
  useEffect(() => {
    engine.update({
      roomId,
      connected: options.connected,
      canControl: options.canPlayback,
      state: room?.currentState ?? null,
      local,
      selfAccountId: getAuthInfoFromBrowserCookie()?.username,
    });
  }, [
    engine,
    roomId,
    options.connected,
    options.canPlayback,
    room?.currentState,
    local,
  ]);

  useEffect(() => {
    if (!roomId) return;
    const timer = window.setInterval(() => void engine.tick(), 1000);
    const onVisible = () =>
      document.visibilityState === 'visible' && void engine.tick(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [engine, roomId]);

  // 没有播放权限：禁止拖动和暂停（播放器控制栏仍可调音量、全屏、弹幕）
  useEffect(() => {
    const art = player?.art;
    const element = art?.template?.$player as HTMLElement | undefined;
    if (element)
      element.dataset.tmLocked = options.canPlayback ? 'false' : 'true';
  }, [player, options.canPlayback, local]);

  // 快捷键
  const keyboard = options.keyboard !== false;
  useEffect(() => {
    if (!player || !keyboard) return;
    return bindKeyboard({
      player,
      seekStep: () =>
        loadStoredSeconds(SEEK_STEP_STORAGE_KEY, DEFAULT_SEEK_STEP_SECONDS),
      quickForward: () => 90,
      locked: () =>
        latest.current.canPlayback ? null : '房主没有开放成员控制播放',
      rateControl: () => latest.current.canPlayback,
    });
  }, [player, keyboard]);

  const shoot = useCallback(
    (text: string, self = false) => {
      const plugin = danmaku.plugin;
      if (!plugin || !text) return;
      try {
        plugin.emit({ text, color: '#ffffff', border: self, mode: 0 });
      } catch {
        // 弹幕插件未就绪时忽略
      }
    },
    [danmaku]
  );

  return {
    player,
    detail,
    episodeIndex: Math.max(0, (state?.episode || 1) - 1),
    loading: Boolean(state) && loading,
    error: state ? error : null,
    danmaku,
    shoot,
  };
}
