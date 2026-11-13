/*
 * 房间播放状态的时间推算（参照 SyncTV）。
 *
 * 房间只记录一份状态：在服务器时间 updatedAt 时播放到 currentTime、是否在播、倍速。
 * 任何一端都用服务器时钟推算“此刻应当在哪”，偏差超过阈值才跳转。
 */

import type { PlayState } from '@/types/watch-room';

/** 播放中允许的最大偏差：超过才跳转，避免反复卡顿。 */
export const PLAYING_DRIFT_SECONDS = 1.2;
/** 刚收到别人的操作（版本变化）时更严格地对齐。 */
export const CHANGED_DRIFT_SECONDS = 0.4;
/** 暂停时位置应当基本一致。 */
export const PAUSED_DRIFT_SECONDS = 0.3;
/** 自动纠偏跳转的最小间隔，避免弱网下反复跳转。 */
export const AUTO_SEEK_COOLDOWN_MS = 3000;

export interface MediaIdentity {
  source: string;
  videoId: string;
  episode?: number;
}

/** 同一部影片的同一集；换片源 / 换集都会改变它。 */
export function mediaKey(media: MediaIdentity) {
  return `${media.source}\u0000${media.videoId}\u0000${media.episode || 1}`;
}

/** 房间状态在服务器时间 now 时应当播放到的位置（秒）。 */
export function expectedRoomTime(state: PlayState, now: number) {
  const base = Math.max(0, state.currentTime || 0);
  if (!state.isPlaying || !state.updatedAt) return base;
  return (
    base +
    (Math.max(0, now - state.updatedAt) / 1000) * (state.playbackRate || 1)
  );
}
