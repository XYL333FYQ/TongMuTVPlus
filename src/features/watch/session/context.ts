'use client';

import { createContext, useContext } from 'react';

import type { ToastProps } from '@/components/feedback/Toast';

import type { PlaybackBadge } from '../media/playback-url';
import type { MediaMetadata } from '../media/useMediaMetadata';
import type { WatchMedia } from '../media/useWatchMedia';
import type {
  Anime4KController,
  Anime4KState,
} from '../player/plugins/anime4k';
import type {
  DanmakuController,
  DanmakuState,
} from '../player/plugins/danmaku';
import type { SubtitleController } from '../player/plugins/subtitles';
import type { WatchPlayer } from '../player/WatchPlayer';

/** 播放器上弹出的设置面板（全屏时也能用） */
export type PlayerSheet =
  | 'skip'
  | 'quick-forward'
  | 'seek-step'
  | 'ios-fullscreen'
  | 'shortcuts'
  | null;

export interface PlaybackState {
  /** 正在解析地址 / 换集 / 换线 */
  loading: boolean;
  loadingLabel: string;
  error: string | null;
  /** 直链跨域失败：可以把这个域名加入代理 */
  corsFailedUrl: string | null;
  badge: PlaybackBadge;
  /** 当前实际播放的地址（外部播放器、转码用） */
  url: string;
  playing: boolean;
  aspectRatio: string;
}

export interface WatchEngineApi {
  media: WatchMedia;
  player: WatchPlayer | null;
  playback: PlaybackState;
  danmaku: DanmakuController;
  danmakuState: DanmakuState;
  subtitles: SubtitleController;
  anime4k: Anime4KController;
  anime4kState: Anime4KState;
  webgpu: boolean;
  adBlock: boolean;
  setAdBlock(enabled: boolean): void;
  /** 外部播放器 / 复制链接是否走去广告代理 */
  externalAdBlock: boolean;
  setExternalAdBlock(enabled: boolean): void;
  harmonyNative: boolean;
  setHarmonyNative(enabled: boolean): void;
  netdiskNative: boolean;
  setNetdiskNative(enabled: boolean): void;
  quickForward: number;
  setQuickForward(seconds: number): void;
  seekStep: number;
  setSeekStep(seconds: number): void;
  sheet: PlayerSheet;
  openSheet(sheet: PlayerSheet): void;
  retry(): void;
  proxyDirectDomain(): void;
  transcode(): Promise<void>;
  transcoding: boolean;
  toast(message: string, type?: ToastProps['type']): void;
  /** 本地字幕文件选择 */
  pickSubtitle(): void;
  metadata: MediaMetadata;
  /** iOS 全屏方式选择结果 */
  chooseFullscreen(choice: 'web' | 'native'): void;
}

export type WatchPresentation = 'page' | 'mini' | 'hidden';

export interface WatchSession {
  href: string | null;
  presentation: WatchPresentation;
  engine: WatchEngineApi | null;
  /** 打开一部影片（同一部只更新地址） */
  open(href: string): void;
  /** 关掉小窗，结束播放 */
  close(): void;
  /** 进入一起看房间等：暂停并收起小窗 */
  suspend(): void;
  registerSlot(element: HTMLElement | null): void;
}

export const WatchSessionContext = createContext<WatchSession | null>(null);

export function useWatchSession() {
  const value = useContext(WatchSessionContext);
  if (!value) throw new Error('WatchSessionProvider is required');
  return value;
}

export function useWatchSessionSafe() {
  return useContext(WatchSessionContext);
}
