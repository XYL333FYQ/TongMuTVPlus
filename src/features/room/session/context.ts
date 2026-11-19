'use client';

/*
 * 一起看的全站会话：房间播放器（离开房间页后在小窗里继续同步）、聊天弹幕开关、语音。
 * 只由 src/features/room 使用，独立看不认识它。
 */

import { createContext, useContext } from 'react';

import type { RoomPlayerState } from '../player/useRoomPlayer';

export interface RoomVoice {
  available: boolean;
  /** 有“语音发言”权限，能开麦克风 */
  canSpeak: boolean;
  mic: boolean;
  speaker: boolean;
  connecting: boolean;
  error: string | null;
  toggleMic(): void;
  toggleSpeaker(): void;
}

export interface RoomSession {
  player: RoomPlayerState;
  /** 房间页的画面位置；离开房间页时传 null，画面转到小窗 */
  attachStage(element: HTMLElement | null): void;
  danmakuChat: boolean;
  setDanmakuChat(on: boolean): void;
  voice: RoomVoice;
  openChat(): void;
}

export const RoomSessionContext = createContext<RoomSession | null>(null);

export function useRoomSession() {
  const value = useContext(RoomSessionContext);
  if (!value) throw new Error('RoomSession 未挂载');
  return value;
}

export function useRoomSessionSafe() {
  return useContext(RoomSessionContext);
}
