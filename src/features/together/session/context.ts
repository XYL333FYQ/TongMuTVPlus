'use client';

/*
 * 一起看的全站会话：房间播放器（离开房间页后在小窗里继续同步）、聊天弹幕开关、语音。
 * 只由 src/features/together 使用，独立看不认识它。
 */

import { createContext, useContext } from 'react';

import type { RoomPlayerState } from '../player/useRoomPlayer';

export interface RoomVoice {
  available: boolean;
  mic: boolean;
  speaker: boolean;
  connecting: boolean;
  error: string | null;
  toggleMic(): void;
  toggleSpeaker(): void;
}

export interface TogetherSession {
  player: RoomPlayerState;
  /** 房间页的画面位置；离开房间页时传 null，画面转到小窗 */
  attachStage(element: HTMLElement | null): void;
  danmakuChat: boolean;
  setDanmakuChat(on: boolean): void;
  voice: RoomVoice;
  openChat(): void;
}

export const TogetherSessionContext = createContext<TogetherSession | null>(
  null
);

export function useTogetherSession() {
  const value = useContext(TogetherSessionContext);
  if (!value) throw new Error('TogetherSession 未挂载');
  return value;
}

export function useTogetherSessionSafe() {
  return useContext(TogetherSessionContext);
}
