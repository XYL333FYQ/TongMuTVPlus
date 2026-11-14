'use client';

/*
 * 独立看的播放引擎：一部影片一个实例（换片时重建），挂在全站布局里，
 * 所以离开播放页也能继续放（小窗）。界面只读它暴露的 api。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { getDanmakuFilterConfig } from '@/lib/db.client';
import { isNetdiskSource } from '@/lib/netdisk/source';
import {
  DEFAULT_QUICK_FORWARD_SECONDS,
  DEFAULT_SEEK_STEP_SECONDS,
  loadStoredSeconds,
  QUICK_FORWARD_STORAGE_KEY,
  SEEK_STEP_STORAGE_KEY,
} from '@/lib/player-seek-settings';
import { CUSTOM_SUBTITLE_ACCEPT } from '@/lib/subtitle-converter';

import Toast, { type ToastProps } from '@/components/feedback/Toast';

import { useAudioFocus } from '@/features/playback/useAudioFocus';

import type { PlaybackState, PlayerSheet, WatchEngineApi } from './context';
import { createTranscodeSession } from '../media/external';
import {
  addDirectplayProxyDomain,
  offlineDownloadAllowed,
  PlaybackBadge,
  resolvePlayback,
} from '../media/playback-url';
import { useMediaMetadata } from '../media/useMediaMetadata';
import { useWatchMedia } from '../media/useWatchMedia';
import { syncCustomAdFilter } from '../player/ad-filter';
import { playerEnvironment } from '../player/env';
import {
  Anime4KController,
  Anime4KState,
  checkWebGPU,
} from '../player/plugins/anime4k';
import {
  iosFullscreenControl,
  iosOrientationPlugin,
  playbackRatePlugin,
  progressThumbPlugin,
  seekButtonsPlugin,
  wakeLockPlugin,
} from '../player/plugins/basics';
import { DanmakuController, DanmakuState } from '../player/plugins/danmaku';
import { formatDuration } from '../player/plugins/format';
import {
  HEATMAP_ENABLED_KEY,
  heatmapEnabled,
  heatmapPlugin,
} from '../player/plugins/heatmap';
import { bindKeyboard } from '../player/plugins/keyboard';
import { LinkRefresher } from '../player/plugins/link-refresh';
import {
  autoNextPlugin,
  preloadNextPlugin,
  progressSavePlugin,
  resumePromptPlugin,
  skipIntroPlugin,
} from '../player/plugins/playback-flow';
import {
  SourceSubtitle,
  SubtitleController,
} from '../player/plugins/subtitles';
import { WatchPlayer } from '../player/WatchPlayer';

function readBool(key: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function writeValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 忽略
  }
}

const NEXT_ICON =
  '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z"/></svg></i>';
const FORWARD_ICON =
  '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 19l9-7-9-7v14z"/><path d="M2 19l9-7-9-7v14z"/></svg></i>';
const CAMERA_ICON =
  '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></i>';

export interface WatchEngineProps {
  href: string;
  /** 播放器节点：在播放页 / 小窗之间搬动，视频元素不重建 */
  mount: HTMLElement;
  replaceHref(href: string): void;
  onApi(api: WatchEngineApi | null): void;
  /** 当前在不在播放页（快捷键只在播放页生效） */
  onPage: boolean;
  suspended: boolean;
}

function WatchEngine(props: WatchEngineProps) {
  const playerRef = useRef<WatchPlayer | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [toastState, setToastState] = useState<ToastProps | null>(null);
  const toast = useCallback(
    (message: string, type: ToastProps['type'] = 'info') => {
      setToastState({ message, type, onClose: () => setToastState(null) });
    },
    []
  );
  const notice = useCallback(
    (text: string) => playerRef.current?.notice(text),
    []
  );

  const media = useWatchMedia({
    href: props.href,
    replaceHref: props.replaceHref,
    snapshot: () => ({
      time: playerRef.current?.currentTime || 0,
      duration: playerRef.current?.duration || 0,
    }),
  });
  const mediaRef = useRef(media);
  mediaRef.current = media;

  // ------------------------------------------------------------ 控制器（每部影片一份）
  const danmaku = useMemo(() => new DanmakuController(notice), [notice]);
  const subtitles = useMemo(
    () =>
      new SubtitleController(
        (message, tone) => toast(message, tone),
        () => fileInput.current?.click()
      ),
    [toast]
  );
  const anime4k = useMemo(() => new Anime4KController(), []);
  const [danmakuState, setDanmakuState] = useState<DanmakuState>(danmaku.state);
  const [anime4kState, setAnime4kState] = useState<Anime4KState>(anime4k.state);
  useEffect(() => {
    const stop = danmaku.subscribe(setDanmakuState);
    return () => {
      stop();
    };
  }, [danmaku]);
  useEffect(() => {
    const stop = anime4k.subscribe(setAnime4kState);
    return () => {
      stop();
    };
  }, [anime4k]);
  const [webgpu, setWebgpu] = useState(false);
  useEffect(() => {
    void checkWebGPU().then(setWebgpu);
    void getDanmakuFilterConfig()
      .then((config) => danmaku.setFilter(config || { rules: [] }))
      .catch(() => undefined);
    void syncCustomAdFilter(
      Number((window as any).RUNTIME_CONFIG?.CUSTOM_AD_FILTER_VERSION) || 0
    );
  }, [danmaku]);

  // ------------------------------------------------------------ 设置
  const env = playerEnvironment();
  const [adBlock, setAdBlockState] = useState(() =>
    readBool('enable_blockad', true)
  );
  const [externalAdBlock, setExternalAdBlockState] = useState(() =>
    readBool('external_player_adblock', false)
  );
  const [harmonyNative, setHarmonyNativeState] = useState(() => {
    try {
      return (
        env.harmony &&
        localStorage.getItem('harmony_hls_playback_mode') === 'native'
      );
    } catch {
      return false;
    }
  });
  const [netdiskNative, setNetdiskNativeState] = useState(() => {
    if (!env.nativeHls) return false;
    try {
      return localStorage.getItem('netdisk_hls_playback_mode') !== 'hlsjs';
    } catch {
      return true;
    }
  });
  const [quickForward, setQuickForwardState] = useState(() =>
    loadStoredSeconds(QUICK_FORWARD_STORAGE_KEY, DEFAULT_QUICK_FORWARD_SECONDS)
  );
  const [seekStep, setSeekStepState] = useState(() =>
    loadStoredSeconds(SEEK_STEP_STORAGE_KEY, DEFAULT_SEEK_STEP_SECONDS)
  );
  const [sheet, setSheet] = useState<PlayerSheet>(null);
  const settingsRef = useRef({ quickForward, seekStep });
  settingsRef.current = { quickForward, seekStep };

  // ------------------------------------------------------------ 播放状态
  const [playback, setPlayback] = useState<PlaybackState>({
    loading: true,
    loadingLabel: '正在准备播放',
    error: null,
    corsFailedUrl: null,
    badge: null,
    url: '',
    playing: false,
    aspectRatio: '16 / 9',
  });
  const patchPlayback = useCallback(
    (patch: Partial<PlaybackState>) =>
      setPlayback((state) => ({ ...state, ...patch })),
    []
  );

  const metadata = useMediaMetadata({
    title: media.detail?.title || media.params.title,
    searchTitle: media.params.searchTitle,
    doubanId: media.detail?.douban_id || 0,
    detail: media.detail,
    danmakuEpisodes: danmakuState.episodes,
    danmakuSettled: danmakuState.settled,
    enabled: media.detail?.source !== 'directplay',
  });
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  // 网盘源：用 TMDB 补海报、年份、简介
  useEffect(() => {
    const detail = media.detail;
    const tmdb = metadata.tmdb;
    if (!detail || !tmdb || !isNetdiskSource(detail.source)) return;
    const year = tmdb.releaseDate?.split('-')[0] || '';
    const temporary =
      !detail.desc ||
      detail.desc.startsWith('临时播放目录：') ||
      detail.desc.startsWith('移动云盘分享：');
    const tmdbId =
      typeof tmdb.tmdbId === 'string'
        ? Number(String(tmdb.tmdbId).split(':')[1] || 0)
        : tmdb.tmdbId;
    if (
      (detail.poster || !tmdb.poster) &&
      (detail.year || !year) &&
      !temporary &&
      detail.tmdb_id
    )
      return;
    media.patchDetail({
      poster: detail.poster || tmdb.poster || '',
      year: detail.year || year,
      desc: temporary ? tmdb.overview || detail.desc : detail.desc,
      tmdb_id: detail.tmdb_id || tmdbId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.detail?.id, metadata.tmdb]);

  const linkRefresher = useMemo(
    () =>
      new LinkRefresher({
        video: () => playerRef.current?.video || null,
        notice,
        fail: (message) => patchPlayback({ error: message }),
      }),
    [notice, patchPlayback]
  );

  // 声音归属：多个标签页同时播放时只有一个出声
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null
  );
  const { claimSound } = useAudioFocus(videoElement, false);

  // ------------------------------------------------------------ 创建播放器
  const container = useMemo(() => {
    const element = document.createElement('div');
    element.className = 'tm-watch-player';
    return element;
  }, []);
  useEffect(() => {
    props.mount.appendChild(container);
    return () => container.remove();
  }, [props.mount, container]);

  const [libsReady, setLibsReady] = useState<{
    danmaku: any;
    thumbnail: any;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('artplayer-plugin-danmuku'),
      import('@/lib/artplayer-plugin-auto-thumbnail'),
    ]).then(([danmakuModule, thumbnailModule]) => {
      if (!cancelled)
        setLibsReady({
          danmaku: danmakuModule.default as any,
          thumbnail: thumbnailModule.default as any,
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [playerInstance, setPlayerInstance] = useState<WatchPlayer | null>(
    null
  );
  const iosChoice = useRef<((choice: 'web' | 'native' | null) => void) | null>(
    null
  );

  const subtitleTracks = useCallback((): SourceSubtitle[] => {
    const { detail, episodeIndex } = mediaRef.current;
    return (
      ((detail?.subtitles?.[episodeIndex] || []) as SourceSubtitle[]) || []
    );
  }, []);

  useEffect(() => {
    if (!libsReady) return;
    const thumbnailsOn = (() => {
      try {
        const saved = localStorage.getItem('disablePlaybackThumbnail');
        return saved !== null && saved !== 'true';
      } catch {
        return false;
      }
    })();
    const saveInterval =
      process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash' ? 20000 : 5000;
    const getArt = () => playerRef.current?.art;
    const player = new WatchPlayer({
      container,
      adBlock,
      hlsModes: {
        harmonyNative,
        harmonyAdBlock: externalAdBlock,
        netdiskNative,
      },
      artPlugins: () => [
        ...(thumbnailsOn
          ? [libsReady.thumbnail({ width: 160, number: 100, scale: 1 })]
          : []),
        danmaku.artPlugin(libsReady.danmaku),
      ],
      controls: [
        {
          name: 'tm-screenshot',
          position: 'right',
          index: 20,
          html: CAMERA_ICON,
          tooltip: '截图',
          click: () =>
            getArt()
              ?.screenshot()
              .catch(() => notice('这个片源不允许截图，可以换个线路再试')),
        },
        {
          name: 'tm-next',
          position: 'left',
          index: 13,
          html: NEXT_ICON,
          tooltip: '下一集',
          click: () => {
            if (!mediaRef.current.next()) notice('已经是最后一集');
          },
        },
        {
          name: 'tm-quick-forward',
          position: 'left',
          index: 40,
          html: FORWARD_ICON,
          tooltip: '快捷快进',
          click: () => {
            const art = getArt();
            if (!art) return;
            const seconds = settingsRef.current.quickForward;
            art.currentTime = Math.min(
              art.duration || Infinity,
              (art.currentTime || 0) + seconds
            );
            notice(`快进 ${formatDuration(seconds)}`);
          },
        },
        ...(env.ios
          ? [
              iosFullscreenControl(getArt, () => {
                setSheet('ios-fullscreen');
                return new Promise((resolve) => {
                  iosChoice.current = resolve;
                });
              }),
            ]
          : []),
      ],
      settings: [
        {
          name: 'tm-adblock',
          html: '去广告',
          switch: adBlock,
          onSwitch: (item: any) => {
            setAdBlock(!item.switch);
            return !item.switch;
          },
        },
        {
          name: 'tm-skip',
          html: '跳过片头片尾',
          switch: mediaRef.current.skip.enable,
          onSwitch: (item: any) => {
            void mediaRef.current.setSkip({
              ...mediaRef.current.skip,
              enable: !item.switch,
            });
            return !item.switch;
          },
        },
        {
          name: 'tm-skip-config',
          html: '片头片尾时间',
          tooltip: '设置',
          onClick: () => {
            setSheet('skip');
            return '设置';
          },
        },
        {
          name: 'tm-heatmap',
          html: '弹幕热力',
          switch: heatmapEnabled(),
          onSwitch: (item: any) => {
            writeValue(HEATMAP_ENABLED_KEY, String(!item.switch));
            window.dispatchEvent(
              new StorageEvent('storage', { key: HEATMAP_ENABLED_KEY })
            );
            return !item.switch;
          },
        },
        {
          name: 'tm-seek-config',
          html: '快进时长',
          tooltip: '设置',
          onClick: () => {
            setSheet('seek-step');
            return '设置';
          },
        },
      ],
      plugins: [
        wakeLockPlugin,
        playbackRatePlugin(),
        progressThumbPlugin,
        iosOrientationPlugin,
        seekButtonsPlugin(() => settingsRef.current.seekStep),
        ({ art }) => danmaku.attach(art),
        ({ art }) =>
          subtitles.attach(
            art,
            subtitleTracks(),
            `${mediaRef.current.detail?.id}:${mediaRef.current.episodeIndex}`
          ),
        ({ art }) => anime4k.attach(art),
        heatmapPlugin(() => danmaku.list()),
        skipIntroPlugin({
          config: () => mediaRef.current.skip,
          onOutro: () => {
            if (!mediaRef.current.next()) playerRef.current?.pause();
          },
        }),
        autoNextPlugin(() => {
          const current = mediaRef.current;
          const total = current.detail?.episodes?.length || 0;
          if (current.episodeIndex >= total - 1) return;
          window.setTimeout(() => {
            if (!mediaRef.current.next()) notice('后面的集都被屏蔽了，已停止');
          }, 1000);
        }),
        progressSavePlugin(() => {
          const current = playerRef.current;
          if (current)
            void mediaRef.current.saveProgress({
              time: current.currentTime,
              duration: current.duration,
            });
        }, saveInterval),
        resumePromptPlugin({
          lookup: () => mediaRef.current.recordedTime(),
          suppressed: () =>
            mediaRef.current.suppressResumePrompt ||
            mediaRef.current.params.duanju,
        }),
        preloadNextPlugin({
          nextUrl: () => {
            const { detail, episodeIndex } = mediaRef.current;
            return detail?.episodes?.[episodeIndex + 1] || null;
          },
          preloadDanmaku: () => void danmaku.preloadNext(),
        }),
        ({ art }) => {
          const onPlay = () => {
            patchPlayback({ playing: true });
            claimSound();
          };
          const onPause = () => patchPlayback({ playing: false });
          const measure = () => {
            const video = art.video as HTMLVideoElement;
            if (video?.videoWidth && video.videoHeight)
              patchPlayback({
                aspectRatio: `${video.videoWidth} / ${video.videoHeight}`,
              });
          };
          art.on('play', onPlay);
          art.on('pause', onPause);
          art.on('video:loadedmetadata', measure);
          setVideoElement(art.video);
          return () => setVideoElement(null);
        },
      ],
      onManifest: () => linkRefresher.start(),
      onForbidden: () => linkRefresher.onForbidden(),
      onError: (message, info) =>
        patchPlayback({
          error: message,
          corsFailedUrl: info?.corsFailedUrl || null,
          loading: false,
        }),
      onCanPlay: () =>
        patchPlayback({ loading: false, error: null, corsFailedUrl: null }),
    });
    playerRef.current = player;
    setPlayerInstance(player);
    return () => {
      void mediaRef.current.saveProgress({
        time: player.currentTime,
        duration: player.duration,
      });
      linkRefresher.clear();
      player.destroy();
      playerRef.current = null;
      setPlayerInstance(null);
    };
    // 播放器只建一次；设置变化走各自的更新路径
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libsReady]);

  // ------------------------------------------------------------ 加载当前集
  const requestRef = useRef(0);
  const reloadToken = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    const player = playerInstance;
    const detail = media.detail;
    if (!player || !detail || media.phase !== 'ready') return;
    const index = media.episodeIndex;
    const request = ++requestRef.current;
    const title = detail.title;
    const multi = (detail.episodes?.length || 0) > 1;
    const label =
      detail.source === 'directplay'
        ? ''
        : multi
        ? ` · ${detail.episodes_titles?.[index] || `第 ${index + 1} 集`}`
        : '';
    patchPlayback({
      loading: true,
      loadingLabel: '正在加载视频',
      error: null,
      corsFailedUrl: null,
    });
    linkRefresher.clear();
    danmaku.setMedia(
      detail.source === 'directplay'
        ? null
        : {
            title: detail.title,
            year: detail.year,
            episodeIndex: index,
            episodeTitles: detail.episodes_titles,
            episodeCount: detail.episodes?.length || 0,
          }
    );
    const auth = getAuthInfoFromBrowserCookie();
    void resolvePlayback(detail, index, {
      canUseServerOffline:
        offlineDownloadAllowed() &&
        (auth?.role === 'owner' || auth?.role === 'admin'),
      stale: () => request !== requestRef.current,
    }).then(async (resolved) => {
      if (!resolved || request !== requestRef.current) return;
      if (!resolved.url) {
        patchPlayback({ loading: false, error: '这一集没有播放地址' });
        return;
      }
      linkRefresher.setLink(
        resolved.lazyUrl,
        resolved.openlistRefresh,
        resolved.url
      );
      const resume = mediaRef.current.takeResumeTime();
      await player.load({
        url: resolved.url,
        source: detail.source,
        mediaType: resolved.mediaType,
        title: `${title}${label}`,
        poster: detail.poster,
        qualities: resolved.qualities,
      });
      if (request !== requestRef.current) return;
      if (resume && resume > 0) {
        const art = player.art;
        const apply = () => {
          const duration = art?.duration || 0;
          if (art)
            art.currentTime =
              duration && resume >= duration - 2
                ? Math.max(0, duration - 5)
                : resume;
        };
        if (art?.video?.readyState >= 1) apply();
        else art?.once?.('video:loadedmetadata', apply);
      }
      subtitles.setTracks(subtitleTracks(), `${detail.id}:${index}`);
      patchPlayback({
        url: resolved.url,
        badge: resolved.badge as PlaybackBadge,
      });
      if (props.suspended) player.pause();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playerInstance,
    media.detail?.source,
    media.detail?.id,
    media.episodeIndex,
    media.phase,
    reloadTick,
  ]);

  // HLS 模式 / 去广告变化：重建实例
  const firstModes = useRef(true);
  useEffect(() => {
    if (firstModes.current) {
      firstModes.current = false;
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    player.setHlsModes({
      harmonyNative,
      harmonyAdBlock: externalAdBlock,
      netdiskNative,
    });
    player.setOptions({ adBlock });
    void player.rebuild();
  }, [adBlock, harmonyNative, netdiskNative, externalAdBlock]);

  // 快捷键
  useEffect(() => {
    const player = playerInstance;
    if (!player) return;
    return bindKeyboard({
      player,
      active: () => props.onPage,
      seekStep: () => settingsRef.current.seekStep,
      quickForward: () => settingsRef.current.quickForward,
      previous: () => mediaRef.current.previous(),
      next: () => mediaRef.current.next(),
    });
  }, [playerInstance, props.onPage]);

  // 进房间等：暂停
  useEffect(() => {
    if (props.suspended) playerRef.current?.pause();
  }, [props.suspended]);

  // 离开页面 / 切到后台：保存进度
  useEffect(() => {
    const save = () => {
      const player = playerRef.current;
      if (player)
        void mediaRef.current.saveProgress({
          time: player.currentTime,
          duration: player.duration,
        });
    };
    const onVisibility = () => document.visibilityState === 'hidden' && save();
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const title = media.detail?.title || media.params.title;
    if (title && props.onPage) document.title = title;
  }, [media.detail?.title, media.params.title, props.onPage]);

  // ------------------------------------------------------------ 操作
  const setAdBlock = useCallback((enabled: boolean) => {
    writeValue('enable_blockad', String(enabled));
    setAdBlockState(enabled);
  }, []);
  const [transcoding, setTranscoding] = useState(false);

  const api: WatchEngineApi = {
    media,
    player: playerInstance,
    playback,
    danmaku,
    danmakuState,
    subtitles,
    anime4k,
    anime4kState,
    webgpu,
    adBlock,
    setAdBlock,
    externalAdBlock,
    setExternalAdBlock: (enabled) => {
      writeValue('external_player_adblock', String(enabled));
      setExternalAdBlockState(enabled);
    },
    harmonyNative,
    setHarmonyNative: (enabled) => {
      writeValue('harmony_hls_playback_mode', enabled ? 'native' : 'hlsjs');
      setHarmonyNativeState(enabled);
    },
    netdiskNative,
    setNetdiskNative: (enabled) => {
      writeValue('netdisk_hls_playback_mode', enabled ? 'native' : 'hlsjs');
      setNetdiskNativeState(enabled);
    },
    quickForward,
    setQuickForward: (seconds) => {
      writeValue(QUICK_FORWARD_STORAGE_KEY, String(seconds));
      setQuickForwardState(seconds);
      notice(`快捷快进已设为 ${formatDuration(seconds)}`);
    },
    seekStep,
    setSeekStep: (seconds) => {
      writeValue(SEEK_STEP_STORAGE_KEY, String(seconds));
      setSeekStepState(seconds);
      notice(`快进 / 快退已设为 ${formatDuration(seconds)}`);
    },
    sheet,
    openSheet: (next) => {
      if (sheet === 'ios-fullscreen' && next === null) {
        iosChoice.current?.(null);
        iosChoice.current = null;
      }
      setSheet(next);
    },
    retry: () => {
      reloadToken.current++;
      setReloadTick((tick) => tick + 1);
    },
    proxyDirectDomain: () => {
      if (!playback.corsFailedUrl) return;
      addDirectplayProxyDomain(playback.corsFailedUrl);
      setReloadTick((tick) => tick + 1);
    },
    transcode: async () => {
      if (transcoding || !playback.url) return;
      setTranscoding(true);
      try {
        const source = /^https?:\/\//.test(playback.url)
          ? playback.url
          : `${window.location.origin}${playback.url}`;
        const url = await createTranscodeSession(source);
        const player = playerRef.current;
        const detail = mediaRef.current.detail;
        if (!player || !detail) return;
        const time = player.currentTime;
        linkRefresher.clear();
        await player.load({
          url,
          source: detail.source,
          title: detail.title,
          poster: detail.poster,
        });
        if (time > 0)
          player.art?.once?.('video:loadedmetadata', () => player.seek(time));
        patchPlayback({ url, badge: null });
        toast('已切换到转码地址', 'success');
      } catch (error) {
        toast(
          error instanceof Error ? error.message : '创建转码任务失败',
          'error'
        );
      } finally {
        setTranscoding(false);
      }
    },
    transcoding,
    toast,
    pickSubtitle: () => fileInput.current?.click(),
    metadata,
    chooseFullscreen: (choice) => {
      iosChoice.current?.(choice);
      iosChoice.current = null;
      setSheet(null);
    },
  };

  const onApi = props.onApi;
  useEffect(() => {
    onApi(api);
  });
  useEffect(() => () => onApi(null), [onApi]);

  return (
    <>
      <input
        ref={fileInput}
        type='file'
        accept={CUSTOM_SUBTITLE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void subtitles.loadFile(file);
        }}
      />
      {toastState && <Toast {...toastState} />}
    </>
  );
}

/** 会话层重渲染时不重渲染引擎，否则 onApi 会形成循环 */
export default memo(WatchEngine);
