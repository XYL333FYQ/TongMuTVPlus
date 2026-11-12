import type { SearchResult } from '@/lib/types';

/** The player owns its element; room code only sees this capability interface. */
export type PlaybackOrigin = 'local' | 'remote';
export interface PlaybackMedia {
  href: string;
  detail?: SearchResult;
}
export interface PortController {
  video: EventTarget & { duration?: number };
  currentTime: number;
  playing: boolean;
  playbackRate: number;
  play(): Promise<unknown> | void;
  pause(): void;
}
export interface PlaybackSnapshot {
  ready: boolean;
  mediaHref?: string | null;
  duration?: number;
  currentTime: number;
  playing: boolean;
  playbackRate: number;
}
export interface PlaybackEvent {
  type: 'play' | 'pause' | 'seeked' | 'ratechange' | 'ended';
  origin: PlaybackOrigin;
  state: PlaybackSnapshot;
}
export interface PlaybackPort {
  load(media: PlaybackMedia, origin?: PlaybackOrigin): Promise<void>;
  play(origin?: PlaybackOrigin): Promise<void>;
  pause(origin?: PlaybackOrigin): void;
  seek(seconds: number, origin?: PlaybackOrigin): void;
  setRate(rate: number, origin?: PlaybackOrigin): void;
  read(): PlaybackSnapshot;
  subscribe(listener: (event: PlaybackEvent) => void): () => void;
}

export function createPlaybackPort(options: {
  controller: () => PortController | null;
  href?: () => string | null;
  load: (media: PlaybackMedia, origin: PlaybackOrigin) => Promise<void>;
}): PlaybackPort & { attach(controller: PortController | null): void } {
  const subscribers = new Set<(event: PlaybackEvent) => void>();
  const expected = new Map<
    string,
    { origin: PlaybackOrigin; value: number | boolean; expiresAt: number }
  >();
  let attached: PortController | null = null;
  let remove = () => undefined as void;
  const requireController = () => {
    if (!attached) throw new Error('播放器尚未就绪');
    return attached;
  };
  const read = () => ({
    duration: Number.isFinite(attached?.video.duration)
      ? attached?.video.duration
      : 0,
    mediaHref: options.href?.() || null,
    ready: !!attached,
    currentTime: attached?.currentTime || 0,
    playing: attached?.playing || false,
    playbackRate: attached?.playbackRate || 1,
  });
  const remember = (
    event: string,
    origin: PlaybackOrigin,
    value: number | boolean
  ) => {
    const marker = { origin, value, expiresAt: Date.now() + 3000 };
    expected.set(event, marker);
    return marker;
  };
  const attach = (controller: PortController | null) => {
    if (attached === controller) return;
    remove();
    expected.clear();
    attached = controller;
    if (!controller) return;
    const events = ['play', 'pause', 'seeked', 'ratechange', 'ended'] as const;
    const bindings = events.map((type) => {
      const listener = () => {
        const state = read(),
          pending = expected.get(type);
        const value =
          type === 'seeked'
            ? state.currentTime
            : type === 'ratechange'
            ? state.playbackRate
            : state.playing;
        const matches =
          pending &&
          pending.expiresAt >= Date.now() &&
          (typeof value === 'number' && typeof pending.value === 'number'
            ? Math.abs(value - pending.value) < 0.1
            : value === pending.value);
        expected.delete(type);
        for (const subscriber of subscribers)
          subscriber({
            type,
            origin: matches ? pending.origin : 'local',
            state,
          });
      };
      controller.video.addEventListener(type, listener);
      return () => controller.video.removeEventListener(type, listener);
    });
    remove = () => bindings.forEach((cleanup) => cleanup());
  };
  return {
    attach,
    read,
    async load(media, origin = 'local') {
      await options.load(media, origin);
    },
    async play(origin = 'local') {
      const controller = requireController();
      if (controller.playing) return;
      const marker = remember('play', origin, true);
      try {
        await controller.play();
      } catch (error) {
        if (expected.get('play') === marker) expected.delete('play');
        throw error;
      }
    },
    pause(origin = 'local') {
      const controller = requireController();
      if (!controller.playing) return;
      remember('pause', origin, false);
      controller.pause();
    },
    seek(seconds, origin = 'local') {
      if (!Number.isFinite(seconds) || seconds < 0)
        throw new Error('无效的播放位置');
      const controller = requireController();
      remember('seeked', origin, seconds);
      controller.currentTime = seconds;
    },
    setRate(rate, origin = 'local') {
      if (!Number.isFinite(rate) || rate <= 0 || rate > 16)
        throw new Error('无效的播放倍速');
      const controller = requireController();
      if (controller.playbackRate === rate) return;
      remember('ratechange', origin, rate);
      controller.playbackRate = rate;
    },
    subscribe(listener) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
  };
}
