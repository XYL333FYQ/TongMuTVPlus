'use client';

import { useCallback, useEffect, useRef } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { parseWebLiveReference } from '@/features/together/activities/room-live';

import type { LiveState } from '@/types/watch-room';

const identity = (state: LiveState | null) => {
  if (!state) return '';
  const web = parseWebLiveReference(state);
  return web
    ? JSON.stringify(['web', web.platform, web.roomId])
    : JSON.stringify(['iptv', state.channelId, state.channelUrl]);
};

/** Snapshots are inputs. Only an explicit caller action publishes an activity. */
export function useRoomLiveActivity(options: {
  kind: 'iptv' | 'web';
  selection: LiveState | null;
  onApply?: (state: LiveState) => void;
  isReady?: () => boolean;
}) {
  const watchRoom = useWatchRoomContextSafe();
  const room = watchRoom?.currentRoom;
  const state = room?.currentState?.type === 'live' ? room.currentState : null;
  const accepts =
    state && Boolean(parseWebLiveReference(state)) === (options.kind === 'web');
  const active = Boolean(room && accepts);
  const scope = JSON.stringify([
    room?.id,
    room?.controllerEpoch,
    watchRoom?.socket?.id,
    active && identity(state),
    watchRoom?.isConnected,
  ]);
  const latest = useRef({
    watchRoom,
    options,
    scope,
    state,
    active,
  });
  latest.current = { watchRoom, options, scope, state, active };
  const applied = useRef('');
  const ready = useRef('');

  useEffect(() => {
    if (!latest.current.active || !latest.current.watchRoom?.isConnected) {
      applied.current = '';
      ready.current = '';
      return;
    }
    let disposed = false;
    let inFlight = false;
    const synchronize = async () => {
      const current = latest.current;
      const currentRoom = current.watchRoom?.currentRoom;
      if (
        disposed ||
        current.scope !== scope ||
        !current.active ||
        !current.state ||
        !currentRoom ||
        !current.watchRoom?.isConnected
      )
        return;
      if (applied.current !== scope) {
        applied.current = scope;
        current.options.onApply?.(current.state);
      }
      if (
        ready.current === scope ||
        inFlight ||
        identity(current.options.selection) !== identity(current.state) ||
        !current.options.isReady?.()
      )
        return;
      inFlight = true;
      const revision = currentRoom.revision;
      const isCurrent = () => !disposed && latest.current.scope === scope;
      try {
        await current.watchRoom.roomCommand('room:sync-applied', {
          roomId: currentRoom.id,
          appliedRevision: revision,
          controllerEpoch: currentRoom.controllerEpoch,
        });
        if (!isCurrent()) return;
        await current.watchRoom.roomCommand('room:ready', {
          roomId: currentRoom.id,
          ready: true,
          appliedRevision: revision,
        });
        if (isCurrent()) ready.current = scope;
      } catch {
        // Retry only synchronization against a current snapshot, never a mutation.
      } finally {
        inFlight = false;
      }
    };
    void synchronize();
    const timer = window.setInterval(() => void synchronize(), 500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [scope]);

  const broadcast = useCallback(async (selection?: LiveState) => {
    const current = latest.current;
    const currentRoom = current.watchRoom?.currentRoom;
    const selected = selection || current.options.selection;
    if (!currentRoom || !current.watchRoom?.isConnected)
      throw Error('房间未连接，请重连后重试');
    if (!current.watchRoom.canControl)
      throw Error('房主没有开放成员切换房间活动');
    if (!selected) throw Error('请先选择频道');
    await current.watchRoom.roomCommand('live:change', {
      ...selected,
      roomId: currentRoom.id,
    });
  }, []);

  return {
    isInRoom: Boolean(room),
    hasRoom: Boolean(room),
    active,
    mediaMatches: Boolean(
      active && identity(options.selection) === identity(state)
    ),
    isOwner: Boolean(room && watchRoom?.canControl),
    canControl: Boolean(room && watchRoom?.canControl),
    shouldDisableControls: Boolean(active && !watchRoom?.canControl),
    broadcast,
  };
}
