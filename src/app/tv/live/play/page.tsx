'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Heart,
  Maximize,
  Radio,
  RotateCcw,
  Search,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { deleteFavorite, isFavorited, saveFavorite } from '@/lib/db.client';

import TVNativeVideo from '@/components/tv/player/TVNativeVideo';
import TVVirtualRemote from '@/components/tv/TVVirtualRemote';

const TV_CINEMA_STYLE = {
  '--tm-bg': 'var(--tm-room-cinema-bg)',
  '--tm-surface':
    'color-mix(in srgb,var(--tm-room-cinema-bg) 92%,var(--tm-room-player-text))',
  '--tm-surface-raised':
    'color-mix(in srgb,var(--tm-room-cinema-bg) 85%,var(--tm-room-player-text))',
  '--tm-text': 'var(--tm-room-player-text)',
  '--tm-muted':
    'color-mix(in srgb,var(--tm-room-player-text) 72%,var(--tm-room-cinema-bg))',
  '--tm-line':
    'color-mix(in srgb,var(--tm-room-player-text) 15%,var(--tm-room-cinema-bg))',
  '--tm-accent-contrast': 'var(--tm-room-cinema-bg)',
} as CSSProperties;

type LiveSource = {
  key: string;
  name: string;
  proxyMode?: 'full' | 'm3u8-only' | 'direct';
};
type LiveChannel = {
  id: string;
  tvgId?: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
};
type EpgProgram = { start: string; end: string; title: string };
type TVPlayerSourceType = 'm3u8' | 'flv' | 'native';

const TV_LIVE_LAST_CHANNEL_KEY = 'tv_live_last_channel';
const TV_VOLUME_KEY = 'tv_player_volume';
const TV_MUTED_KEY = 'tv_player_muted';
const REMOTE_KEY_DEDUPE_MS = 350;

function loadTVVolumeState() {
  if (typeof window === 'undefined') return { volume: 1, muted: false };

  const savedVolume = localStorage.getItem(TV_VOLUME_KEY);
  const parsedVolume = savedVolume === null ? NaN : Number(savedVolume);
  const volume = Number.isFinite(parsedVolume)
    ? Math.max(0, Math.min(1, parsedVolume))
    : 1;
  const savedMuted = localStorage.getItem(TV_MUTED_KEY);

  return {
    volume,
    muted: savedMuted === null ? volume <= 0 : savedMuted === 'true',
  };
}

function getLogoUrl(logo?: string, source?: string) {
  if (!logo) return '';
  const sourceParam = source ? `&source=${encodeURIComponent(source)}` : '';
  return `/api/proxy/logo?url=${encodeURIComponent(logo)}${sourceParam}`;
}

function getUrlSourceType(rawUrl: string): TVPlayerSourceType | 'unknown' {
  const lower = rawUrl.toLowerCase();
  const path = lower.split('?')[0];
  if (
    path.endsWith('.m3u8') ||
    path.endsWith('.m3u') ||
    lower.includes('.m3u8') ||
    lower.includes('.m3u')
  )
    return 'm3u8';
  if (path.endsWith('.flv') || lower.includes('.flv?')) return 'flv';
  if (/\.(mp4|webm|ogv|ogg|mov)(\?.*)?$/.test(path)) return 'native';
  return 'unknown';
}

async function resolveLiveUrl(
  rawUrl: string,
  source?: LiveSource | null
): Promise<{ url: string; type: TVPlayerSourceType }> {
  const proxyMode = source?.proxyMode || 'full';
  const sourceType = getUrlSourceType(rawUrl);

  if (sourceType === 'm3u8') {
    return {
      type: 'm3u8',
      url:
        proxyMode === 'direct'
          ? rawUrl
          : `/api/proxy/m3u8?url=${encodeURIComponent(
              rawUrl
            )}&moontv-source=${encodeURIComponent(source?.key || '')}${
              proxyMode === 'm3u8-only' ? '&allowCORS=true' : ''
            }`,
    };
  }
  if (sourceType === 'flv') return { type: 'flv', url: rawUrl };
  if (sourceType === 'native') return { type: 'native', url: rawUrl };

  if (!source?.key) throw new Error('未知直播流格式');

  const precheckRes = await fetch(
    `/api/live/precheck?url=${encodeURIComponent(
      rawUrl
    )}&moontv-source=${encodeURIComponent(source.key)}`,
    { cache: 'no-store' }
  );
  if (!precheckRes.ok) throw new Error('不支持的直播流格式');
  const precheck = await precheckRes.json();

  if (precheck?.type === 'flv') return { type: 'flv', url: rawUrl };
  if (precheck?.type === 'mp4') return { type: 'native', url: rawUrl };
  if (precheck?.type === 'm3u8') {
    return {
      type: 'm3u8',
      url:
        proxyMode === 'direct'
          ? rawUrl
          : `/api/proxy/m3u8?url=${encodeURIComponent(
              rawUrl
            )}&moontv-source=${encodeURIComponent(source.key)}${
              proxyMode === 'm3u8-only' ? '&allowCORS=true' : ''
            }`,
    };
  }

  throw new Error('不支持的直播流格式');
}

function TVLivePlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const needSource = searchParams.get('source');
  const needChannel = searchParams.get('id');

  const [sources, setSources] = useState<LiveSource[]>([]);
  const [source, setSource] = useState<LiveSource | null>(null);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [channel, setChannel] = useState<LiveChannel | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoType, setVideoType] = useState<TVPlayerSourceType | undefined>();
  const [unsupportedError, setUnsupportedError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [query, setQuery] = useState('');
  const [digitBuffer, setDigitBuffer] = useState('');
  const [playbackError, setPlaybackError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [epgPrograms, setEpgPrograms] = useState<EpgProgram[]>([]);
  const [epgLoading, setEpgLoading] = useState(false);
  const [initialVolumeState] = useState(loadTVVolumeState);
  const [muted, setMuted] = useState(initialVolumeState.muted);
  const [volume, setVolume] = useState(initialVolumeState.volume);
  const [showVolumeHint, setShowVolumeHint] = useState(false);
  const [channelHint, setChannelHint] = useState<{
    number: number;
    name: string;
  } | null>(null);
  const channelButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {}
  );
  const digitTimerRef = useRef<number | null>(null);
  const volumeHintTimerRef = useRef<number | null>(null);
  const channelHintTimerRef = useRef<number | null>(null);
  const menuKeyTimeRef = useRef(0);
  const backKeyTimeRef = useRef(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/live/sources')
      .then((r) => {
        if (r.status === 401 || r.status === 403)
          throw new Error('无权限访问电视直播，请先登录或检查权限');
        if (!r.ok) throw new Error('获取直播源失败');
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        const list = data.data || [];
        setSources(list);
        const selected =
          list.find((s: LiveSource) => s.key === needSource) || list[0] || null;
        setSource(selected);
        if (!selected) setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '获取直播源失败');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [needSource]);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    setLoading(true);
    setError('');
    fetch(`/api/live/channels?source=${encodeURIComponent(source.key)}`)
      .then((r) => {
        if (r.status === 401 || r.status === 403)
          throw new Error('无权限访问电视直播，请先登录或检查权限');
        if (!r.ok) throw new Error('获取频道列表失败');
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        const list = (data.data || []).map((item: any) => ({
          id: item.id,
          tvgId: item.tvgId || item.name,
          name: item.name,
          logo: item.logo,
          group: item.group || '其他',
          url: item.url,
        }));
        setChannels(list);
        const selected =
          list.find((c: LiveChannel) => c.id === needChannel) ||
          list[0] ||
          null;
        setChannel(selected);
        setSelectedGroup(selected?.group || list[0]?.group || '');
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : '获取频道列表失败')
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [source, needChannel]);

  useEffect(() => {
    let alive = true;
    if (!channel) return;
    setVideoUrl('');
    setVideoType(undefined);
    setUnsupportedError('');
    setPlaybackError(false);
    setRetryCount(0);
    resolveLiveUrl(channel.url, source)
      .then(({ url, type }) => {
        if (!alive) return;
        setVideoType(type);
        setVideoUrl(url);
      })
      .catch((err) => {
        if (!alive) return;
        setUnsupportedError(
          err instanceof Error ? err.message : '不支持的直播流格式'
        );
      });
    return () => {
      alive = false;
    };
  }, [channel, source]);

  useEffect(() => {
    if (!source || !channel) return;
    isFavorited(`live_${source.key}`, `live_${channel.id}`)
      .then(setFavorited)
      .catch(() => undefined);
  }, [channel, source]);

  useEffect(() => {
    if (!source || !channel?.tvgId) {
      setEpgPrograms([]);
      return;
    }
    let alive = true;
    setEpgLoading(true);
    fetch(
      `/api/live/epg?source=${encodeURIComponent(
        source.key
      )}&tvgId=${encodeURIComponent(channel.tvgId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        setEpgPrograms((data?.data?.programs || []).slice(0, 12));
      })
      .catch(() => alive && setEpgPrograms([]))
      .finally(() => alive && setEpgLoading(false));
    return () => {
      alive = false;
    };
  }, [channel?.tvgId, source]);

  useEffect(() => {
    if (!source || !channel) return;
    try {
      localStorage.setItem(
        TV_LIVE_LAST_CHANNEL_KEY,
        JSON.stringify({
          source: source.key,
          sourceName: source.name,
          id: channel.id,
          title: channel.name,
          group: channel.group || '',
          logo: channel.logo || '',
          updatedAt: Date.now(),
        })
      );
    } catch {
      // ignore storage failures
    }
  }, [channel, source]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TV_VOLUME_KEY, String(volume));
    localStorage.setItem(TV_MUTED_KEY, String(muted));
  }, [muted, volume]);

  useEffect(() => {
    if (!playbackError || !channel || retryCount >= 3) return;
    const timer = window.setTimeout(() => {
      setRetryCount((value) => value + 1);
      setPlaybackError(false);
      setVideoUrl('');
      setVideoType(undefined);
      setUnsupportedError('');
      resolveLiveUrl(channel.url, source)
        .then(({ url, type }) => {
          setVideoType(type);
          setVideoUrl(url);
        })
        .catch((err) =>
          setUnsupportedError(
            err instanceof Error ? err.message : '不支持的直播流格式'
          )
        );
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [channel, playbackError, retryCount, source]);

  const groups = useMemo(
    () => Array.from(new Set(channels.map((item) => item.group || '其他'))),
    [channels]
  );
  const filteredChannels = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return channels.filter((item) => {
      const groupMatched = (item.group || '其他') === selectedGroup;
      const queryMatched =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        (item.group || '').toLowerCase().includes(keyword);
      return groupMatched && queryMatched;
    });
  }, [channels, query, selectedGroup]);

  const precheckChannel = async (next: LiveChannel) => {
    if (!source) return;
    try {
      await fetch(
        `/api/live/precheck?url=${encodeURIComponent(
          next.url
        )}&moontv-source=${encodeURIComponent(source.key)}`,
        { cache: 'no-store' }
      );
    } catch {
      // 预检查失败不阻止切台，播放器错误层会给出重试/换台。
    }
  };

  const switchChannel = (next: LiveChannel, revealControls = true) => {
    precheckChannel(next);
    setChannel(next);
    setSelectedGroup(next.group || '其他');
    if (revealControls) setShowPanel(true);
    const number = channels.findIndex((item) => item.id === next.id) + 1;
    setChannelHint({ number: number > 0 ? number : 1, name: next.name });
    if (channelHintTimerRef.current)
      window.clearTimeout(channelHintTimerRef.current);
    channelHintTimerRef.current = window.setTimeout(
      () => setChannelHint(null),
      5000
    );
  };

  const switchSource = (next: LiveSource) => {
    setSource(next);
    setChannel(null);
    setChannels([]);
    setSelectedGroup('');
    setQuery('');
    setShowPanel(true);
    router.replace(`/tv/live/play?source=${encodeURIComponent(next.key)}`);
  };

  const toggleFavorite = async () => {
    if (!source || !channel) return;
    if (favorited) {
      await deleteFavorite(`live_${source.key}`, `live_${channel.id}`);
      setFavorited(false);
    } else {
      await saveFavorite(`live_${source.key}`, `live_${channel.id}`, {
        title: channel.name,
        source_name: source.name,
        year: '',
        cover: getLogoUrl(channel.logo, source.key),
        total_episodes: 1,
        save_time: Date.now(),
        search_title: channel.name,
        origin: 'live',
      });
      setFavorited(true);
    }
  };

  const setVideoVolume = (next: number) => {
    const safe = Math.max(0, Math.min(1, next));
    const video = document.querySelector<HTMLVideoElement>(
      '[data-tv-player-root] video'
    );
    if (video) {
      video.volume = safe;
      video.muted = safe <= 0;
    }
    setVolume(safe);
    setMuted(safe <= 0);
    setShowVolumeHint(true);
    if (volumeHintTimerRef.current)
      window.clearTimeout(volumeHintTimerRef.current);
    volumeHintTimerRef.current = window.setTimeout(
      () => setShowVolumeHint(false),
      1200
    );
  };

  const toggleMute = () => {
    const video = document.querySelector<HTMLVideoElement>(
      '[data-tv-player-root] video'
    );
    const next = !muted;
    if (video) video.muted = next;
    setMuted(next);
  };

  const toggleFullscreen = () => {
    const root = document.querySelector<HTMLElement>('[data-tv-player-root]');
    if (!root) return;
    if (document.fullscreenElement)
      document.exitFullscreen().catch(() => undefined);
    else root.requestFullscreen?.().catch(() => undefined);
  };

  useEffect(() => {
    if (!videoUrl) return;
    window.requestAnimationFrame(() => {
      const video = document.querySelector<HTMLVideoElement>(
        '[data-tv-player-root] video'
      );
      if (!video) return;
      video.volume = volume;
      video.muted = muted;
    });
  }, [muted, videoUrl, volume]);

  useEffect(() => {
    const togglePanelByRemoteKey = (event: { preventDefault: () => void }) => {
      const now = Date.now();
      if (now - menuKeyTimeRef.current < REMOTE_KEY_DEDUPE_MS) return;
      menuKeyTimeRef.current = now;
      event.preventDefault();
      setShowPanel((value) => !value);
    };

    const onKey = (event: KeyboardEvent) => {
      const isMenuKey =
        event.key === 'ContextMenu' ||
        event.key === 'Menu' ||
        event.key === 'BrowserContextMenu' ||
        event.code === 'ContextMenu' ||
        event.code === 'Menu' ||
        event.keyCode === 93 ||
        event.keyCode === 82;
      if (isMenuKey) {
        event.stopImmediatePropagation();
        togglePanelByRemoteKey(event);
        return;
      }

      if (event.type === 'keyup') return;

      if (/^[0-9]$/.test(event.key) && channels.length) {
        event.preventDefault();
        const nextBuffer = `${digitBuffer}${event.key}`.slice(-4);
        setDigitBuffer(nextBuffer);
        if (digitTimerRef.current) window.clearTimeout(digitTimerRef.current);
        digitTimerRef.current = window.setTimeout(() => {
          const target = Number(nextBuffer);
          const next = channels[target - 1];
          if (next) switchChannel(next);
          setDigitBuffer('');
        }, 850);
      }
      if (event.key === 'Enter') {
        const active = document.activeElement;
        const isControlFocused =
          active instanceof HTMLElement &&
          Boolean(active.closest('[data-tv-live-control]'));
        if (!showPanel) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setShowPanel(true);
          return;
        }
        if (!isControlFocused) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setShowPanel((v) => !v);
          return;
        }
      }
      if (
        !showPanel &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const currentIndex = channels.findIndex(
          (item) => item.id === channel?.id
        );
        if (currentIndex >= 0) {
          const nextIndex =
            event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
          const next =
            channels[Math.max(0, Math.min(channels.length - 1, nextIndex))];
          if (next && next.id !== channel?.id) switchChannel(next, false);
        }
        return;
      }
      if (
        !showPanel &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setVideoVolume(volume + (event.key === 'ArrowRight' ? 0.05 : -0.05));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const now = Date.now();
        if (showPanel) {
          backKeyTimeRef.current = now;
          setShowPanel(false);
        } else if (now - backKeyTimeRef.current >= 250) {
          router.back();
        }
        return;
      }
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        const currentIndex = channels.findIndex(
          (item) => item.id === channel?.id
        );
        if (currentIndex >= 0) {
          const nextIndex =
            event.key === 'PageUp' ? currentIndex - 1 : currentIndex + 1;
          const next =
            channels[Math.max(0, Math.min(channels.length - 1, nextIndex))];
          if (next) switchChannel(next);
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [channel?.id, channels, digitBuffer, router, showPanel, source, volume]);

  useEffect(() => {
    if (!showPanel || !channel?.id) return;
    window.requestAnimationFrame(() => {
      channelButtonRefs.current[channel.id]?.focus({ preventScroll: true });
      channelButtonRefs.current[channel.id]?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
      });
    });
  }, [channel?.id, selectedGroup, showPanel]);

  if (loading) {
    return (
      <main className='fixed inset-0 flex items-center justify-center bg-surface text-3xl font-bold text-fg'>
        <span aria-hidden className='tm-skeleton mr-4 h-10 w-10 text-fg' />
        正在进入电视直播...
      </main>
    );
  }

  if (error || !channel) {
    return (
      <main className='fixed inset-0 flex items-center justify-center bg-surface p-10 text-center text-fg'>
        <section
          role='alert'
          className='max-w-3xl rounded-md border border-danger bg-raised p-10 shadow-2xl shadow-ink/40'
        >
          <AlertTriangle className='mx-auto mb-5 h-16 w-16 text-danger' />
          <h1 className='text-fg text-[28px] font-bold md:text-[32px]'>
            {error || '没有可播放频道'}
          </h1>
          <div className='mt-8 flex justify-center gap-4'>
            <button
              onClick={() => window.location.reload()}
              className='tv-focusable flex cursor-pointer items-center gap-3 rounded-2xl bg-fg px-7 py-4 text-base font-medium focus:ring-fg text-inverse min-h-[44px] tm-press min-w-[44px]'
            >
              <RotateCcw className='h-7 w-7' />
              重试
            </button>
            <button
              onClick={() => router.back()}
              className='tv-focusable rounded-2xl bg-raised px-7 py-4 text-base font-medium focus:ring-[color-mix(in_srgb,var(--tm-text)_40%,transparent)] min-h-[44px] tm-press min-w-[44px]'
            >
              返回
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      data-tv-player-root
      style={TV_CINEMA_STYLE}
      data-tv-controls-open={showPanel ? 'true' : 'false'}
      className='fixed inset-0 overflow-hidden bg-surface text-fg'
      onContextMenu={(event) => {
        const now = Date.now();
        if (now - menuKeyTimeRef.current < REMOTE_KEY_DEDUPE_MS) return;
        menuKeyTimeRef.current = now;
        event.preventDefault();
        setShowPanel((value) => !value);
      }}
    >
      <style jsx global>{`
        [data-tv-player-root] .tv-focusable,
        [data-tv-player-root] .tv-focusable:active {
          scale: 1;
          transition-property: transform, opacity;
        }
        [data-tv-player-root] .tv-focusable:focus,
        [data-tv-player-root] .tv-focusable:focus-visible,
        [data-tv-player-root] .tv-focused {
          outline: 2px solid var(--tm-text) !important;
          outline-offset: 2px;
          scale: 1;
          background-color: var(--tm-surface-raised) !important;
          color: var(--tm-text) !important;
          box-shadow: none !important;
        }
        [data-tv-player-root] .tv-focusable[class~='bg-fg']:focus,
        [data-tv-player-root] .tv-focusable[class~='bg-fg']:focus-visible {
          background-color: var(--tm-text) !important;
          color: var(--tm-accent-contrast) !important;
        }
        [data-tv-player-root] .tv-focusable:focus::after,
        [data-tv-player-root] .tv-focusable:focus-visible::after,
        [data-tv-player-root] .tv-focused::after {
          background: none;
          opacity: 0;
        }
        html[data-tm-reduced-motion='true'] [data-tv-player-root] * {
          transition: none !important;
          animation: none !important;
          scroll-behavior: auto !important;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-tv-player-root] * {
            transition: none !important;
            animation: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      {unsupportedError ? (
        <div
          role='alert'
          className='flex h-full items-center justify-center bg-surface p-10 text-center text-fg'
        >
          <section className='max-w-3xl rounded-md border border-line bg-surface p-9 shadow-2xl shadow-ink/70'>
            <AlertTriangle className='mx-auto mb-5 h-14 w-14 text-fg' />
            <h2 className='text-xl font-medium md:text-2xl'>
              当前直播流格式不支持
            </h2>
            <p className='mt-3 text-base text-muted'>{unsupportedError}</p>
            <button
              onClick={() => setShowPanel(true)}
              className='tv-focusable mt-8 rounded-2xl bg-raised px-7 py-4 text-base font-medium focus:ring-[color-mix(in_srgb,var(--tm-text)_40%,transparent)] min-h-[44px] tm-press min-w-[44px]'
            >
              频道列表
            </button>
          </section>
        </div>
      ) : videoUrl ? (
        <TVNativeVideo
          key={`${videoType || 'auto'}:${videoUrl}`}
          url={videoUrl}
          sourceType={videoType}
          poster={getLogoUrl(channel.logo, source?.key)}
          live
          title={channel.name}
          onError={() => setPlaybackError(true)}
        />
      ) : (
        <div className='flex h-full items-center justify-center text-3xl font-bold'>
          <span aria-hidden className='tm-skeleton mr-4 h-10 w-10 text-fg' />
          正在解析直播地址...
        </div>
      )}

      {playbackError && (
        <div
          role='alert'
          className='absolute inset-0 z-30 flex items-center justify-center bg-ink/70 p-8 text-fg'
        >
          <section className='max-w-3xl rounded-md border border-line bg-surface p-9 text-center shadow-2xl shadow-ink/70'>
            <AlertTriangle className='mx-auto mb-5 h-14 w-14 text-fg' />
            <h2 className='text-xl font-medium md:text-2xl'>
              当前频道播放失败
            </h2>
            <p className='mt-3 text-base text-muted'>
              {retryCount < 3
                ? `正在自动重连（${retryCount + 1}/3）...`
                : '可以重试当前频道，或打开频道面板切换频道/直播源。'}
            </p>
            <div className='mt-8 flex justify-center gap-4'>
              <button
                onClick={() => {
                  setPlaybackError(false);
                  setUnsupportedError('');
                  setVideoUrl('');
                  setVideoType(undefined);
                  if (channel)
                    resolveLiveUrl(channel.url, source)
                      .then(({ url, type }) => {
                        setVideoType(type);
                        setVideoUrl(url);
                      })
                      .catch((err) =>
                        setUnsupportedError(
                          err instanceof Error
                            ? err.message
                            : '不支持的直播流格式'
                        )
                      );
                }}
                className='tv-focusable flex cursor-pointer items-center gap-3 rounded-2xl bg-fg px-7 py-4 text-base font-medium focus:ring-fg text-inverse min-h-[44px] tm-press min-w-[44px]'
              >
                <RotateCcw className='h-7 w-7' />
                重试
              </button>
              <button
                onClick={() => {
                  setPlaybackError(false);
                  setShowPanel(true);
                }}
                className='tv-focusable rounded-2xl bg-raised px-7 py-4 text-base font-medium focus:ring-[color-mix(in_srgb,var(--tm-text)_40%,transparent)] min-h-[44px] tm-press min-w-[44px]'
              >
                频道列表
              </button>
            </div>
          </section>
        </div>
      )}

      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          showPanel ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className='absolute inset-x-0 top-0 h-44 bg-surface to-transparent' />
        <div className='absolute inset-y-0 left-0 w-[560px] bg-surface to-transparent' />
      </div>

      <div
        className={`absolute left-4 right-4 top-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 md:left-8 md:right-8 md:top-8 xl:flex xl:justify-between xl:gap-3 transition-opacity duration-300 ${
          showPanel ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={() => {
            if (showPanel) setShowPanel(false);
            else router.back();
          }}
          data-tv-live-control
          className='tv-focusable flex cursor-pointer items-center gap-2 rounded-2xl bg-ink/70 px-3 py-2 md:px-5 md:py-4 text-base font-medium focus:ring-fg min-h-[44px] tm-press min-w-[44px]'
        >
          <ArrowLeft className='h-7 w-7' />
          返回
        </button>
        <div className='flex min-w-0 items-center gap-2 rounded-2xl bg-ink/70 px-3 py-2 md:gap-4 md:px-6'>
          {channel.logo ? (
            <img
              src={getLogoUrl(channel.logo, source?.key)}
              alt=''
              className='h-7 w-7 shrink-0 rounded-xl object-contain md:h-10 md:w-10'
            />
          ) : (
            <Radio className='h-7 w-7 shrink-0 text-fg md:h-10 md:w-10' />
          )}
          <div className='min-w-0'>
            <div className='truncate text-lg font-medium md:text-2xl'>
              {channel.name}
            </div>
            <div className='truncate text-sm text-muted'>
              {source?.name} · {channel.group}
            </div>
          </div>
        </div>
        <div className='col-span-2 flex max-w-full flex-wrap items-center justify-end gap-2 xl:col-span-1'>
          <button
            onClick={toggleMute}
            aria-label={muted ? '取消静音' : '静音'}
            data-tv-live-control
            className='tv-focusable rounded-2xl bg-ink/70 p-2 md:p-4 focus:ring-fg min-h-[44px] tm-press min-w-[44px]'
          >
            {muted ? (
              <VolumeX className='h-7 w-7' />
            ) : (
              <Volume2 className='h-7 w-7' />
            )}
          </button>
          <input
            aria-label='直播音量'
            data-tv-live-control
            type='range'
            min='0'
            max='1'
            step='0.05'
            value={muted ? 0 : volume}
            onChange={(e) => setVideoVolume(Number(e.target.value))}
            className='tv-focusable h-11 w-28 rounded accent-fg'
          />
          <button
            onClick={toggleFullscreen}
            aria-label='全屏'
            data-tv-live-control
            className='tv-focusable rounded-2xl bg-ink/70 p-2 md:p-4 focus:ring-fg min-h-[44px] tm-press min-w-[44px]'
          >
            <Maximize className='h-7 w-7' />
          </button>
          <button
            onClick={toggleFavorite}
            aria-pressed={favorited}
            data-tv-live-control
            className={`tv-focusable flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 md:px-5 md:py-4 text-base font-medium outline-none focus:ring-fg ${
              favorited
                ? 'bg-fg text-inverse min-h-[44px] tm-press min-w-[44px]'
                : 'bg-ink/70 min-h-[44px] tm-press min-w-[44px]'
            }`}
          >
            <Heart className={`h-7 w-7 ${favorited ? 'fill-current' : ''}`} />
            收藏
          </button>
        </div>
      </div>

      {showPanel && (
        <aside
          data-tv-live-control
          className='absolute bottom-4 left-4 right-4 top-40 grid grid-cols-[88px_minmax(0,1fr)] gap-2 md:bottom-8 md:left-8 md:right-auto md:top-48 xl:top-28 md:w-[720px] md:grid-cols-[220px_minmax(0,1fr)] md:gap-4 rounded-md border border-line bg-surface p-4 md:p-5 shadow-2xl shadow-ink/70'
        >
          <div className='overflow-y-auto px-2 py-2'>
            {sources.length > 1 && (
              <>
                <h2 className='mb-3 text-xl font-medium md:text-2xl'>直播源</h2>
                <div className='mb-5 space-y-3'>
                  {sources.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => switchSource(item)}
                      className={`tv-focusable w-full cursor-pointer rounded-2xl px-4 py-4 text-left text-base font-medium outline-none focus:ring-fg ${
                        source?.key === item.key
                          ? 'bg-fg text-inverse min-h-[44px] tm-press min-w-[44px]'
                          : 'bg-raised min-h-[44px] tm-press min-w-[44px]'
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <h2 className='mb-4 text-xl font-medium md:text-2xl'>分类</h2>
            <div className='space-y-3'>
              {groups.map((group) => (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`tv-focusable w-full cursor-pointer rounded-2xl px-4 py-4 text-left text-base font-medium outline-none focus:ring-fg ${
                    selectedGroup === group
                      ? 'bg-fg text-inverse min-h-[44px] tm-press min-w-[44px]'
                      : 'bg-raised min-h-[44px] tm-press min-w-[44px]'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
          <div className='overflow-y-auto px-2 py-2'>
            <h2 className='mb-4 flex items-center gap-2 text-xl font-medium md:text-2xl'>
              <Star className='h-6 w-6 text-fg' />
              频道
            </h2>
            <section className='mb-4 rounded-2xl bg-raised p-4'>
              <h3 className='mb-3 flex items-center gap-2 text-lg font-medium text-fg'>
                <Clock className='h-5 w-5 text-fg' />
                节目单
              </h3>
              {epgLoading ? (
                <div className='text-lg text-muted'>正在加载 EPG...</div>
              ) : epgPrograms.length > 0 ? (
                <div className='max-h-36 space-y-2 overflow-y-auto pr-2'>
                  {epgPrograms.map((program, index) => (
                    <div
                      key={`${program.start}-${index}`}
                      className='rounded-xl bg-ink/25 px-3 py-2 text-base text-fg'
                    >
                      <span className='mr-2 text-muted'>
                        {program.start?.slice(8, 12)}-
                        {program.end?.slice(8, 12)}
                      </span>
                      {program.title}
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-lg text-muted'>暂无节目单</div>
              )}
            </section>
            <label className='mb-4 flex h-14 items-center gap-3 rounded-2xl border border-line bg-raised px-4 focus-within:border-line'>
              <Search className='h-6 w-6 text-muted' />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='搜索频道'
                className='tv-focusable h-12 min-w-0 flex-1 bg-transparent text-xl font-bold text-fg outline-none placeholder:text-muted'
              />
            </label>
            <div className='grid grid-cols-1 gap-3'>
              {filteredChannels.map((item) => {
                const absoluteIndex =
                  channels.findIndex((c) => c.id === item.id) + 1;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      channelButtonRefs.current[item.id] = el;
                    }}
                    onClick={() => switchChannel(item)}
                    className={`tv-focusable flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-medium outline-none focus:ring-fg ${
                      item.id === channel.id
                        ? 'bg-fg text-inverse min-h-[44px] tm-press min-w-[44px]'
                        : 'bg-raised min-h-[44px] tm-press min-w-[44px]'
                    }`}
                  >
                    {item.logo ? (
                      <img
                        src={getLogoUrl(item.logo, source?.key)}
                        alt=''
                        className='h-9 w-9 rounded-lg object-contain'
                      />
                    ) : (
                      <Radio className='h-5 w-5 shrink-0 text-inherit md:h-8 md:w-8' />
                    )}
                    <span
                      className={`min-w-8 text-[13px] md:min-w-12 md:text-base ${
                        item.id === channel.id ? 'text-inherit' : 'text-muted'
                      }`}
                    >
                      #{absoluteIndex}
                    </span>
                    <span className='line-clamp-1'>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      )}
      {digitBuffer && (
        <div className='absolute right-10 top-32 z-[90] rounded-3xl bg-ink/75 px-7 py-5 text-5xl font-bold text-fg shadow-2xl'>
          频道 {digitBuffer}
        </div>
      )}
      {channelHint && (
        <div className='absolute right-20 top-24 z-[70] max-w-[520px] rounded-3xl bg-ink/80 px-7 py-5 text-right text-fg shadow-2xl'>
          <div className='text-2xl font-bold text-fg'>
            #{channelHint.number}
          </div>
          <div className='mt-1 line-clamp-1 text-4xl font-bold'>
            {channelHint.name}
          </div>
        </div>
      )}
      {showVolumeHint && !showPanel && (
        <div className='absolute right-10 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4 rounded-3xl bg-ink/80 px-6 py-7 text-3xl font-bold text-fg shadow-2xl'>
          {muted || volume <= 0 ? (
            <VolumeX className='h-10 w-10' />
          ) : (
            <Volume2 className='h-10 w-10' />
          )}
          <div className='relative h-56 w-4 overflow-hidden rounded-full bg-raised'>
            <div
              className='absolute bottom-0 left-0 right-0 rounded-full bg-fg'
              style={{ height: `${Math.round((muted ? 0 : volume) * 100)}%` }}
            />
          </div>
          <div className='min-w-16 text-center'>
            {Math.round((muted ? 0 : volume) * 100)}
          </div>
        </div>
      )}
      <TVVirtualRemote />
    </main>
  );
}

export default function TVLivePlayPage() {
  return (
    <Suspense fallback={null}>
      <TVLivePlayClient />
    </Suspense>
  );
}
