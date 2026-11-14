'use client';

import { createContext, useContext, useMemo } from 'react';

export type PlaybackPresentation = 'full' | 'docked' | 'mini' | 'folded';
export interface PlaybackController {
  video: HTMLVideoElement;
  readonly template?: { readonly $player: HTMLElement };
  readonly notice?: { show: string };
  currentTime: number;
  playing: boolean;
  muted: boolean;
  playbackRate: number;
  play: () => Promise<unknown> | void;
  pause: () => void;
}
export interface PlaybackMetadata {
  title: string;
  episode?: number;
  poster?: string;
  loading?: boolean;
  error?: string | null;
  /** 当前影片的全部分集名称（长度即总集数；没有名称的为空字符串） */
  episodeTitles?: string[];
}
/** 播放页实际在放的影片（解析完片源之后），与地址里的参数不一定相同。 */
/** 播放页上报的“实际在放的影片” */
export interface PlaybackMedia {
  source: string;
  videoId: string;
  episode: number;
  videoName: string;
  videoYear?: string;
  searchTitle?: string;
  poster?: string;
  url?: string;
  queueItemId?: string;
  ready: boolean;
}

/**
 * 播放请求的拦截器。返回 false 表示拦截（拦截方自己负责后续界面）。
 * 播放会话本身不认识房间：房间模块通过它决定“这部影片在房间里怎么看”。
 */
export type PlaybackGuard = (href: string) => boolean;

/**
 * 全站唯一的播放会话：放什么（href）、在哪显示（presentation）、播放器控制器。
 * 不包含任何房间逻辑。
 */
export interface PlaybackSession {
  href: string | null;
  presentation: PlaybackPresentation;
  controller: PlaybackController | null;
  metadata: PlaybackMetadata;
  media: PlaybackMedia | null;
  /**
   * 打开一部影片。
   * - user：用户操作，先经过拦截器（例如房间里的选片对话框）；
   * - system：已经决定好的（房间跟随、对话框里的选择），不再拦截。
   */
  requestPlayback: (href: string, origin?: 'user' | 'system') => void;
  updateHref: (href: string) => boolean;
  setMetadata: (metadata: PlaybackMetadata) => void;
  reportMedia: (media: PlaybackMedia | null) => void;
  attachController: (controller: PlaybackController | null) => void;
  registerSlot: (element: HTMLElement | null) => void;
  setPlaybackGuard: (guard: PlaybackGuard | null) => void;
  minimize: () => void;
  restore: () => void;
  endSession: () => void;
  reloadPlayback: () => void;
}

export const PlaybackSessionContext = createContext<PlaybackSession | null>(
  null
);
export function usePlaybackSessionSafe() {
  return useContext(PlaybackSessionContext);
}
export function usePlaybackSession() {
  const context = usePlaybackSessionSafe();
  if (!context) throw new Error('PlaybackSessionProvider is required');
  return context;
}
export function usePlaybackSearchParams() {
  const { href } = usePlaybackSession();
  return useMemo(
    () => new URL(href || '/play', 'https://tongmu.invalid').searchParams,
    [href]
  );
}
