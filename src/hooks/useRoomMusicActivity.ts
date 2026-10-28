'use client';

import { useCallback, useRef } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';

import type { MusicSyncState } from '@/types/watch-room';

type PublishKind = 'update' | 'play' | 'pause' | 'seek' | 'change';
const EVENTS: Record<PublishKind, string> = {
  update: 'music:update',
  play: 'music:play',
  pause: 'music:pause',
  seek: 'music:seek',
  change: 'music:change',
};

/**
 * 音乐和房间的唯一连接点：
 * - 房间快照只是输入，这里没有任何“收到快照就发命令”的路径；
 * - 浏览和本地听歌不会改变房间，只有 share() 才把房间切成音乐活动；
 * - 谁能发命令看“当前设备的控制权 + 是否跟随”，不看房主账号；
 * - 命令都带上发出时的房间 ID，服务端会拒绝已切换的房间。
 */
export function useRoomMusicActivity() {
  const watchRoom = useWatchRoomContextSafe();
  const session = usePlaybackSessionSafe();
  const following = session?.followingRoom !== false;
  const room = watchRoom?.currentRoom;
  const active = Boolean(
    room && following && room.currentState?.type === 'music'
  );
  const canControl = Boolean(room && following && watchRoom?.canControl);
  const publishing = active && canControl;

  const latest = useRef({ watchRoom, session, following, publishing });
  latest.current = { watchRoom, session, following, publishing };
  // 同一房间的音乐命令一条一条发：前一条确认后，下一条才带上它产生的新房间版本，
  // 否则换歌后紧跟的进度更新必然带着旧版本被拒绝
  const publishQueue = useRef<Promise<unknown>>(Promise.resolve());

  /** 显式共享：把房间切成这首歌（房间还不是音乐活动也可以）。 */
  const share = useCallback(async (state: MusicSyncState | null) => {
    const current = latest.current;
    const currentRoom = current.watchRoom?.currentRoom;
    if (!current.following) throw Error('请先返回房间恢复一起看，再共享歌曲');
    if (!currentRoom || !current.watchRoom?.isConnected)
      throw Error('房间未连接，请重连后重试');
    if (!current.watchRoom.canControl)
      throw Error('当前设备没有房间播放控制权');
    if (!state) throw Error('请先选择歌曲');
    await current.watchRoom.roomCommand('music:change', {
      ...state,
      roomId: currentRoom.id,
    });
  }, []);

  /** 已共享且本设备有控制权时，同步进度 / 播放 / 暂停 / 拖动 / 换歌；否则什么都不发。 */
  const publish = useCallback((kind: PublishKind, state: MusicSyncState) => {
    const run = async () => {
      const current = latest.current;
      const currentRoom = current.watchRoom?.currentRoom;
      if (!current.publishing || !currentRoom || !current.watchRoom)
        return false;
      await current.watchRoom.roomCommand(EVENTS[kind], {
        ...state,
        roomId: currentRoom.id,
      });
      return true;
    };
    const result = publishQueue.current.then(run, run);
    publishQueue.current = result.catch(() => undefined);
    return result;
  }, []);

  /**
   * 本机要开始出声：不是正在给房间发布时，先退出跟随（房间和消息保留），
   * 再让房间电影停下，避免两路声音。退出失败就返回 false，调用方不要播放。
   */
  const beginLocalPlayback = useCallback(async () => {
    const current = latest.current;
    if (
      current.watchRoom?.currentRoom &&
      current.following &&
      !current.publishing
    ) {
      if (!(await current.session?.enterPersonalViewing())) return false;
    }
    if (!latest.current.publishing) latest.current.session?.controller?.pause();
    return true;
  }, []);

  return {
    hasRoom: Boolean(room),
    isInRoom: Boolean(room && following),
    active,
    canControl,
    publishing,
    share,
    publish,
    beginLocalPlayback,
  };
}
