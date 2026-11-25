/*
 * 房间播放器对外的样子：发给房间的命令接口、房间会话拿到的播放器状态。
 */

import type { SearchResult } from '@/lib/types';

import type { DanmakuController, WatchPlayer } from '@/features/player';

import type { ChatDanmaku } from './chat-danmaku';

export interface RoomCommands {
  roomCommand(
    event: string,
    payload?: Record<string, unknown>
  ): Promise<unknown>;
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
  shoot(text: string, self?: boolean, name?: string): void;
  /** 房间聊天弹幕：飘过画面，全屏时控制条里可以发 */
  chat: ChatDanmaku;
}
