'use client';

import { useCallback, useEffect, useRef } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';
import {
  anchoredPlaybackTime,
  playbackHrefFromState,
} from '@/features/playback/session';

import type { PlayState } from '@/types/watch-room';

let lastRemotePlaybackRate: number | null = null;
let remoteRateApplyUntil = 0;
let isFollowingRoom = false;

export function isRemoteRoomRateActive() {
  return isFollowingRoom && Date.now() < remoteRateApplyUntil;
}
export function getRoomRemotePlaybackRate() {
  return isFollowingRoom ? lastRemotePlaybackRate : null;
}

interface SyncPlayer {
  video: Pick<
    HTMLVideoElement,
    'readyState' | 'seeking' | 'paused' | 'duration'
  >;
  currentTime: number;
  playbackRate: number;
  notice?: { show: string };
  play: () => Promise<unknown> | void;
  pause: () => unknown;
  on: (event: string, listener: () => void) => unknown;
  off: (event: string, listener: () => void) => unknown;
}
interface UsePlaySyncOptions {
  artPlayerRef: React.MutableRefObject<SyncPlayer | null>;
  videoId: string;
  videoName: string;
  videoYear?: string;
  searchTitle?: string;
  currentEpisode?: number;
  currentSource: string;
  videoUrl: string;
  playerReady: boolean;
  mediaLoading?: boolean;
}

const mediaKey = (state: Pick<PlayState, 'source' | 'videoId' | 'episode'>) =>
  `${state.source}\u0000${state.videoId}\u0000${state.episode || 1}`;

/** Route changes never release the room, change the host or destroy the player. */
export function usePlaySync(options: UsePlaySyncOptions) {
  const watchRoom = useWatchRoomContextSafe();
  const session = usePlaybackSessionSafe();
  const latest = useRef({ options, watchRoom, session });
  latest.current = { options, watchRoom, session };
  const applyingUntil = useRef(0);
  const readyKey = useRef('');
  const readyEpoch = useRef<number | undefined>();
  const lastMatchedMedia = useRef('');
  const inFlight = useRef(false);
  const readyInFlight = useRef(false);
  const lastBroadcastAt = useRef(0);
  const serverOffset = useRef(0);
  const lastClockSample = useRef<number>();
  const isInRoom = Boolean(
    watchRoom?.currentRoom && session?.followingRoom !== false
  );
  const canControl = Boolean(isInRoom && watchRoom?.canControl);

  useEffect(() => {
    isFollowingRoom = isInRoom;
    if (!isInRoom) {
      lastRemotePlaybackRate = null;
      readyKey.current = '';
      readyEpoch.current = undefined;
      lastMatchedMedia.current = '';
    }
    return () => {
      isFollowingRoom = false;
    };
  }, [isInRoom, watchRoom?.currentRoom?.id]);

  const buildState = useCallback((): PlayState | null => {
    const { options: current } = latest.current;
    const player = current.artPlayerRef.current;
    if (
      !current.playerReady ||
      current.mediaLoading ||
      !player?.video ||
      player.video.readyState < 2 ||
      !current.videoId ||
      !current.currentSource ||
      !current.videoUrl
    )
      return null;
    return {
      type: 'play',
      url: current.videoUrl,
      videoId: current.videoId,
      videoName: current.videoName,
      videoYear: current.videoYear,
      searchTitle: current.searchTitle,
      episode: current.currentEpisode || 1,
      source: current.currentSource,
      currentTime: Math.max(0, Number(player.currentTime) || 0),
      isPlaying: !player.video.paused,
      playbackRate: Number(player.playbackRate) || 1,
    };
  }, []);

  const broadcastPlayState = useCallback(
    async (force = false) => {
      const { watchRoom: roomContext, session: playback } = latest.current;
      const room = roomContext?.currentRoom;
      if (
        !roomContext?.isConnected ||
        !roomContext.canControl ||
        !room ||
        playback?.followingRoom === false ||
        inFlight.current
      )
        return;
      if (
        Date.now() < applyingUntil.current ||
        (!force && Date.now() - lastBroadcastAt.current < 1800)
      )
        return;
      const state = buildState();
      if (!state) return;
      const authoritative =
        room.currentState?.type === 'play' ? room.currentState : null;
      const sameMedia =
        authoritative && mediaKey(authoritative) === mediaKey(state);
      const explicitSelection = playback?.roomSelectionHref;
      // Local episode/source changes require this device to have applied the current lease's snapshot.
      const localAdvance =
        authoritative &&
        readyEpoch.current === room.controllerEpoch &&
        lastMatchedMedia.current === mediaKey(authoritative);
      if (!sameMedia && !explicitSelection && !localAdvance) return;
      if (
        sameMedia &&
        readyEpoch.current !== room.controllerEpoch &&
        !explicitSelection
      )
        return;
      inFlight.current = true;
      lastBroadcastAt.current = Date.now();
      try {
        await roomContext.roomCommand(
          sameMedia ? 'play:update' : 'play:change',
          { ...state }
        );
        lastMatchedMedia.current = mediaKey(state);
        readyEpoch.current = room.controllerEpoch;
        if (explicitSelection) playback?.clearRoomSelection(explicitSelection);
      } catch {
        // Never retry a stale mutation automatically; the latest snapshot must be applied first.
        readyKey.current = '';
        readyEpoch.current = undefined;
      } finally {
        inFlight.current = false;
      }
    },
    [buildState]
  );

  useEffect(() => {
    if (!isInRoom || !options.playerReady) return;
    let disposed = false;
    const synchronize = async () => {
      const {
        options: current,
        watchRoom: roomContext,
        session: playback,
      } = latest.current;
      const room = roomContext?.currentRoom;
      const state = room?.currentState;
      const player = current.artPlayerRef.current;
      if (
        !room ||
        !roomContext?.isConnected ||
        playback?.followingRoom === false ||
        current.mediaLoading ||
        !player?.video
      )
        return;
      if (room.serverTime && room.serverTime !== lastClockSample.current) {
        serverOffset.current = room.serverTime - Date.now();
        lastClockSample.current = room.serverTime;
      }
      if (playback?.roomSelectionHref && roomContext.canControl) {
        await broadcastPlayState(true);
        return;
      }
      if (!state) return;
      if (state.type !== 'play') {
        player.pause();
        return;
      }
      const localKey = mediaKey({
        source: current.currentSource,
        videoId: current.videoId,
        episode: current.currentEpisode,
      });
      const targetKey = mediaKey(state);
      if (localKey !== targetKey) {
        if (
          roomContext.canControl &&
          readyEpoch.current === room.controllerEpoch &&
          lastMatchedMedia.current === targetKey
        ) {
          await broadcastPlayState(true);
        } else playback?.requestPlayback(playbackHrefFromState(state), 'room');
        return;
      }
      if (
        player.video.readyState < 2 ||
        player.video.seeking ||
        readyInFlight.current
      )
        return;
      const key = `${room.id}:${room.controllerEpoch}:${targetKey}`;
      const mustApply = !roomContext.canControl || readyKey.current !== key;
      if (mustApply) {
        applyingUntil.current = Date.now() + 700;
        const anchoredTarget = anchoredPlaybackTime(
          state,
          Date.now(),
          serverOffset.current
        );
        const duration = player.video.duration;
        // With no host, the server clock can outlive a finite film. Applying its
        // end must still allow readiness; unknown/live durations remain unbounded.
        const reachedEnd =
          Number.isFinite(duration) &&
          duration > 0 &&
          anchoredTarget >= duration;
        const target = reachedEnd ? duration : anchoredTarget;
        const shouldPlay = state.isPlaying && !reachedEnd;
        // Seeking can drop readyState and make Artplayer.playing false even while
        // native playback continues. Stop first so a paused snapshot cannot loop.
        if (!shouldPlay && !player.video.paused) player.pause();
        const rate = state.playbackRate || 1;
        lastRemotePlaybackRate = rate;
        if (Math.abs(player.playbackRate - rate) > 0.01) {
          remoteRateApplyUntil = Date.now() + 1000;
          player.playbackRate = rate;
        }
        const drift = Math.abs((player.currentTime || 0) - target);
        if (drift > (shouldPlay && readyKey.current === key ? 1.5 : 0.25))
          player.currentTime = target;
        if (shouldPlay && player.video.paused) {
          try {
            await player.play();
          } catch {
            if (player.notice) player.notice.show = '点击播放，加入房间同步';
            return;
          }
        }
      }
      // A seek must finish before the device claims to have applied this snapshot.
      if (player.video.seeking || player.video.readyState < 2) return;
      if (disposed || readyKey.current === key) return;
      // Returning owners acknowledge the latest state before becoming eligible to host.
      readyInFlight.current = true;
      const revision = room.revision;
      try {
        await roomContext.roomCommand('room:sync-applied', {
          appliedRevision: revision,
          controllerEpoch: room.controllerEpoch,
        });
        if (disposed) return;
        await roomContext.roomCommand('room:ready', {
          ready: true,
          appliedRevision: revision,
        });
        if (!disposed) {
          readyKey.current = key;
          readyEpoch.current = room.controllerEpoch;
          lastMatchedMedia.current = targetKey;
        }
      } catch {
        readyKey.current = '';
      } finally {
        readyInFlight.current = false;
      }
    };
    void synchronize();
    const timer = window.setInterval(() => {
      void synchronize();
    }, 500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [isInRoom, options.playerReady, watchRoom?.socket, broadcastPlayState]);

  useEffect(() => {
    if (!isInRoom || !options.playerReady) return;
    const player = options.artPlayerRef.current;
    if (!player) return;
    const notify = () => {
      void broadcastPlayState(true);
    };
    const events = [
      'video:play',
      'video:pause',
      'video:seeked',
      'video:ratechange',
    ];
    events.forEach((event) => player.on(event, notify));
    const timer = window.setInterval(() => {
      void broadcastPlayState();
    }, 2000);
    return () => {
      events.forEach((event) => player.off(event, notify));
      window.clearInterval(timer);
    };
  }, [isInRoom, options.playerReady, options.artPlayerRef, broadcastPlayState]);

  return {
    isInRoom,
    isOwner: canControl,
    shouldDisableControls: isInRoom && !canControl,
    broadcastPlayState,
  };
}
