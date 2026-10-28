'use client';

import { createContext, useContext, useMemo } from 'react';

export type PlaybackPresentation = 'full' | 'docked' | 'mini' | 'folded';
export interface PlaybackController {
  video: HTMLVideoElement;
  readonly template?: { readonly $player: HTMLElement };
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
}
export interface PlaybackSession {
  href: string | null;
  presentation: PlaybackPresentation;
  followingRoom: boolean;
  controller: PlaybackController | null;
  metadata: PlaybackMetadata;
  roomSelectionHref: string | null;
  roomSelectionKey?: string | null;
  shareCurrentPlayback: (roomId?: string) => void;
  clearRoomSelection: (href: string) => void;
  reloadPlayback: () => void;
  requestPlayback: (
    href: string,
    origin?: 'user' | 'room' | 'personal' | 'together'
  ) => void;
  updateHref: (href: string) => boolean;
  setMetadata: (metadata: PlaybackMetadata) => void;
  attachController: (controller: PlaybackController | null) => void;
  registerSlot: (element: HTMLElement | null) => void;
  minimize: () => void;
  restore: () => void;
  endSession: () => void;
  resumeRoom: () => void;
  enterPersonalViewing: () => Promise<boolean>;
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
