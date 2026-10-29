'use client';

import {
  ArrowUpRight,
  ChevronsDown,
  Film,
  Maximize2,
  MessageCircle,
  Minus,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  getStoredRoomViewing,
  saveRoomViewingPreference,
} from '@/hooks/useWatchRoom';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import RoomPlaybackButton from '@/features/rooms/RoomPlaybackButton';

import {
  type PlaybackController,
  type PlaybackMetadata,
  type PlaybackPresentation,
  PlaybackSessionContext,
} from './context';
import { roomActivityKey } from './room-activity';
import PlaybackRoomMessages from './RoomLiveMessages';
import {
  normalizePlaybackHref,
  playbackHrefFromState,
  playbackIdentity,
  queueItemFromHref,
} from './session';
import { useAudioFocus } from './useAudioFocus';
import { useMiniPlayerDrag } from './useMiniPlayerDrag';

import type { Room } from '@/types/watch-room';

const PlaybackSurface = dynamic(() => import('./LegacyPlaybackSurface'), {
  ssr: false,
});

function withoutQueueItem(href: string) {
  const url = new URL(href, 'https://tongmu.invalid');
  url.searchParams.delete('queueId');
  return `${url.pathname}${url.search}`;
}

/** 房间空闲或正在放电影，才算这个电影窗口就是当前共同活动。 */
function isFilmActivity(state: Room['currentState'] | undefined) {
  return !state || state.type === 'play';
}

export default function PlaybackSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const watchRoom = useWatchRoomContextSafe();
  const roomRef = useRef(watchRoom);
  roomRef.current = watchRoom;
  const [href, setHref] = useState<string | null>(null);
  const [surfaceVersion, setSurfaceVersion] = useState(0);
  const hrefRef = useRef(href);
  hrefRef.current = href;
  const [folded, setFolded] = useState(false);
  const [followingRoom, setFollowingRoom] = useState(
    () => getStoredRoomViewing()?.following !== false
  );
  const followingRef = useRef(followingRoom);
  followingRef.current = followingRoom;
  const [controller, attachController] = useState<PlaybackController | null>(
    null
  );
  const [metadata, setMetadata] = useState<PlaybackMetadata>({
    title: '正在准备影片',
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const [slot, registerSlot] = useState<HTMLElement | null>(null);
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [roomSelectionHref, setRoomSelectionHref] = useState<string | null>(
    null
  );
  const [roomSelectionKey, setRoomSelectionKey] = useState<string | null>(null);
  const selectionRoom = useRef<string>();
  const operation = useRef(0);
  const personalIntent = useRef(!followingRoom);
  const personalRoom = useRef(getStoredRoomViewing()?.roomId);
  const requestPersonal = useRef<(selected: string) => void>(() => undefined);
  const requestTogether = useRef<(selected: string) => void>(() => undefined);
  const [actionError, setActionError] = useState('');
  // 仅界面：用户手动收起的失败提示文案；出现新的错误文案时会重新显示
  const [dismissedError, setDismissedError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const queueAttempt = useRef<{
    roomId: string;
    href: string;
    commandId: string;
  } | null>(null);
  const [queueNotice, setQueueNotice] = useState('');
  const choicePending = useRef(false);
  choicePending.current = Boolean(pendingHref) || actionPending;
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { ownsSound, claimSound } = useAudioFocus(controller?.video || null);

  const updateHref = useCallback((nextHref: string) => {
    if (choicePending.current) return false;
    const normalized = normalizePlaybackHref(nextHref);
    if (normalized) {
      const previous = hrefRef.current;
      setRoomSelectionHref((selection) =>
        selection &&
        previous &&
        playbackIdentity(selection) === playbackIdentity(previous)
          ? normalized
          : selection
      );
      setHref(normalized);
      return true;
    }
    return false;
  }, []);

  const requestPlayback = useCallback(
    (
      nextHref: string,
      origin: 'user' | 'room' | 'personal' | 'together' = 'user'
    ) => {
      let normalized = normalizePlaybackHref(nextHref);
      if (!normalized) return;
      if (origin === 'personal') normalized = withoutQueueItem(normalized);
      if (origin === 'together') {
        requestTogether.current(normalized);
        return;
      }
      if (origin === 'room' && !followingRef.current) return;
      const current = hrefRef.current;
      if (origin === 'personal') {
        personalIntent.current = true;
        personalRoom.current =
          roomRef.current?.currentRoom?.id || getStoredRoomViewing()?.roomId;
        if (roomRef.current?.currentRoom) {
          requestPersonal.current(normalized);
          return;
        }
        operation.current += 1;
        followingRef.current = false;
        setFollowingRoom(false);
        setRoomSelectionHref(null);
        setRoomSelectionKey(null);
        selectionRoom.current = undefined;
        saveRoomViewingPreference(undefined, false, normalized);
      } else if (origin === 'user') {
        operation.current += 1;
        setActionPending(false);
      }
      if (
        origin === 'user' &&
        roomRef.current?.currentRoom &&
        (roomRef.current.currentRoom.currentState ||
          !roomRef.current.canControl) &&
        followingRef.current &&
        (!current || playbackIdentity(current) !== playbackIdentity(normalized))
      ) {
        choicePending.current = true;
        setPendingHref(normalized);
        setActionError('');
        return;
      }
      if (
        origin === 'user' &&
        roomRef.current?.currentRoom &&
        roomRef.current.canControl &&
        followingRef.current
      ) {
        selectionRoom.current = roomRef.current.currentRoom.id;
        setRoomSelectionHref(normalized);
        setRoomSelectionKey(roomActivityKey(roomRef.current.currentRoom));
      }
      if (
        !current ||
        playbackIdentity(current) !== playbackIdentity(normalized)
      )
        setSurfaceVersion((previous) => previous + 1);
      setHref(normalized);
    },
    []
  );

  const emitFollowing = useCallback(async (following: boolean) => {
    const current = roomRef.current;
    if (!current?.currentRoom) return;
    await current.roomCommand('room:following', { following });
  }, []);

  const resumeRoom = useCallback(async () => {
    const generation = ++operation.current;
    const target = roomRef.current?.currentRoom?.id;
    if (!target) return;
    setActionError('');
    try {
      await emitFollowing(true);
      if (
        operation.current !== generation ||
        roomRef.current?.currentRoom?.id !== target
      )
        return;
      personalIntent.current = false;
      personalRoom.current = undefined;
      saveRoomViewingPreference(target, true);
      setRoomSelectionHref(null);
      setRoomSelectionKey(null);
      followingRef.current = true;
      setFollowingRoom(true);
      const state = roomRef.current?.currentRoom?.currentState;
      if (state?.type === 'play') {
        const nextHref = playbackHrefFromState(state);
        if (
          !hrefRef.current ||
          playbackIdentity(hrefRef.current) !== playbackIdentity(nextHref)
        )
          setSurfaceVersion((previous) => previous + 1);
        setHref(nextHref);
      }
      if (!state) {
        const current = roomRef.current;
        const revision = current?.currentRoom?.revision;
        await current?.roomCommand('room:sync-applied', {
          roomId: target,
          appliedRevision: revision,
          controllerEpoch: current.currentRoom?.controllerEpoch,
        });
        if (
          operation.current !== generation ||
          roomRef.current?.currentRoom?.id !== target ||
          roomRef.current.currentRoom.currentState
        )
          return;
        await roomRef.current.roomCommand('room:ready', {
          roomId: target,
          ready: true,
          appliedRevision: revision,
        });
        if (operation.current !== generation) return;
      }
      setFolded(false);
    } catch (error) {
      if (operation.current !== generation) return;
      setActionError(
        error instanceof Error ? error.message : '无法回到同步，请重连后重试'
      );
    }
  }, [emitFollowing]);

  const previousRoomRef = useRef<string | undefined>();
  const roomId = watchRoom?.currentRoom?.id;
  useEffect(() => {
    if (previousRoomRef.current !== roomId) {
      const hadRoom = Boolean(previousRoomRef.current);
      previousRoomRef.current = roomId;
      operation.current += 1;
      const generation = operation.current;
      const saved = getStoredRoomViewing(roomId);
      const keepPersonal = Boolean(
        roomId &&
          !hadRoom &&
          ((personalIntent.current &&
            (!personalRoom.current || personalRoom.current === roomId)) ||
            saved?.following === false)
      );
      followingRef.current = !keepPersonal;
      setFollowingRoom(!keepPersonal);
      personalIntent.current = keepPersonal;
      personalRoom.current = keepPersonal ? roomId : undefined;
      setPendingHref(null);
      setActionPending(false);
      choicePending.current = false;
      queueAttempt.current = null;
      setQueueNotice('');
      if (hadRoom && selectionRoom.current !== roomId) {
        setRoomSelectionHref(null);
        setRoomSelectionKey(null);
        selectionRoom.current = undefined;
      }
      if (keepPersonal)
        void emitFollowing(false).catch((error: unknown) => {
          if (operation.current === generation)
            setActionError(
              error instanceof Error ? error.message : '无法退出房间同步'
            );
        });
      if (keepPersonal && !hrefRef.current && saved?.personalHref) {
        const restored = normalizePlaybackHref(saved.personalHref);
        if (restored) setHref(restored);
      }
    }
  }, [roomId, emitFollowing]);

  // 重连后服务端给的是全新会话，默认“跟随”；本机还在个人观看时要重新声明，
  // 否则这台设备会被当成跟随者（选主持、算就绪），而界面却是个人观看。
  const rejoinCount = watchRoom?.rejoinCount ?? 0;
  const seenRejoin = useRef(rejoinCount);
  useEffect(() => {
    if (seenRejoin.current === rejoinCount) return;
    seenRejoin.current = rejoinCount;
    if (!roomId || followingRef.current) return;
    const generation = operation.current;
    void emitFollowing(false).catch((error: unknown) => {
      if (operation.current === generation)
        setActionError(
          error instanceof Error ? error.message : '无法退出房间同步'
        );
    });
  }, [rejoinCount, roomId, emitFollowing]);

  const roomState = watchRoom?.currentRoom?.currentState;
  const activityKey = watchRoom?.currentRoom
    ? roomActivityKey(watchRoom.currentRoom)
    : null;
  useEffect(() => {
    if (
      selectionRoom.current === roomId &&
      roomSelectionKey &&
      roomSelectionKey !== activityKey
    ) {
      setRoomSelectionHref(null);
      setRoomSelectionKey(null);
      selectionRoom.current = undefined;
    }
  }, [activityKey, roomSelectionKey, roomId]);
  const roomMediaKey =
    roomState?.type === 'play'
      ? `${roomId}:${roomState.source}:${roomState.videoId}:${
          roomState.episode || 1
        }`
      : null;
  useEffect(() => {
    const state = roomRef.current?.currentRoom?.currentState;
    if (state?.type === 'play' && followingRef.current)
      requestPlayback(playbackHrefFromState(state), 'room');
  }, [roomMediaKey, requestPlayback]);

  useEffect(() => {
    if (!slot) {
      setSlotRect(null);
      return;
    }
    const measure = () => setSlotRect(slot.getBoundingClientRect());
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    // Notices above the stage move the slot without changing its own size.
    const roomContainer = slot.closest('.tm-rooms');
    if (roomContainer) observer.observe(roomContainer);

    // 滚动时：每帧直接把占位框的位置写到样式变量上，不走 React 状态（否则整页每次滚动都重渲），
    // 并临时关掉位置过渡，窗口才会紧贴页面；停下后再同步一次状态。
    // 用户在显示设置里打开“缓动跟随”时保留过渡。
    const mount = () =>
      hostRef.current?.querySelector<HTMLElement>('[data-tm-player-mount]') ||
      null;
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const follow = () => {
      frame = 0;
      const rect = slot.getBoundingClientRect();
      const style = hostRef.current?.style;
      if (!style) return;
      style.setProperty('--tm-slot-left', `${rect.left}px`);
      style.setProperty('--tm-slot-top', `${rect.top}px`);
      style.setProperty('--tm-slot-width', `${rect.width}px`);
      style.setProperty('--tm-slot-height', `${rect.height}px`);
    };
    const onScroll = () => {
      if (document.documentElement.dataset.tmPlayerEase !== 'true') {
        const element = mount();
        if (element) element.style.transition = 'none';
      }
      if (!frame) frame = requestAnimationFrame(follow);
      clearTimeout(idle);
      idle = setTimeout(() => {
        const element = mount();
        if (element) element.style.transition = '';
        measure();
      }, 160);
    };
    // Element scroll events do not bubble; capture BODY and nested page scrolling too.
    window.addEventListener('scroll', onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(idle);
      const element = mount();
      if (element) element.style.transition = '';
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', measure);
    };
  }, [slot]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height || window.innerHeight;
      document.documentElement.style.setProperty(
        '--tm-visual-height',
        `${height}px`
      );
      const inputFocused = /^(INPUT|TEXTAREA)$/.test(
        document.activeElement?.tagName || ''
      );
      setKeyboardVisible(inputFocused && window.innerHeight - height > 120);
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  const presentation: PlaybackPresentation =
    pathname === '/play' && href
      ? 'full'
      : slot && slotRect && followingRoom && !folded
      ? 'docked'
      : folded || keyboardVisible
      ? 'folded'
      : 'mini';

  useEffect(() => {
    document.documentElement.dataset.tmPlaybackActive = href ? 'true' : 'false';
    document.documentElement.dataset.tmPlaybackPresentation = presentation;
    window.dispatchEvent(
      new CustomEvent('tm-playback-state', {
        detail: { active: Boolean(href) },
      })
    );
    return () => {
      delete document.documentElement.dataset.tmPlaybackActive;
      delete document.documentElement.dataset.tmPlaybackPresentation;
    };
  }, [href, presentation]);

  useEffect(() => {
    if (!controller?.video) return;
    const video = controller.video;
    const update = () => setMuted(video.muted);
    video.addEventListener('volumechange', update);
    update();
    return () => video.removeEventListener('volumechange', update);
  }, [controller]);

  // 小窗里藏起了播放器自带的控制栏，这里自己跟踪播放状态，给小窗工具栏的播放/暂停按钮用
  useEffect(() => {
    if (!controller?.video) return;
    const video = controller.video;
    const update = () => setPaused(video.paused);
    const events = ['play', 'playing', 'pause', 'ended', 'emptied'] as const;
    events.forEach((name) => video.addEventListener(name, update));
    update();
    return () =>
      events.forEach((name) => video.removeEventListener(name, update));
  }, [controller]);

  const minimize = useCallback(() => setFolded(true), []);
  const restore = useCallback(() => setFolded(false), []);
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  // 把播放器彻底收掉：暂停、卸载画面、回到没有任何播放会话的状态
  const stopPlayback = useCallback(() => {
    operation.current += 1;
    controllerRef.current?.pause();
    setHref(null);
    attachController(null);
    setFolded(false);
    setPendingHref(null);
    choicePending.current = false;
    setRoomSelectionHref(null);
    setRoomSelectionKey(null);
    selectionRoom.current = undefined;
    setActionError('');
    // 只记当前真实的跟随状态：只关旧电影窗口时人仍在跟随房间，不能存成“仅自己看”
    saveRoomViewingPreference(
      roomRef.current?.currentRoom?.id,
      followingRef.current,
      null
    );
  }, []);
  // 用户主动关闭小窗。电影正是房间当前活动且正在跟随时，先退出同步（房间和消息保留），
  // 之后可以从“回到一起看”回去；退出失败就不关，免得房间那边还当他在看。
  // 房间已经切到直播/音乐/共享时，这个电影窗口只是旧窗口：只关窗口，
  // 不动“跟随”状态，否则会把正在看当前活动的人一起退出同步。
  const endSession = useCallback(() => {
    const generation = ++operation.current;
    const target = roomRef.current?.currentRoom?.id;
    void (async () => {
      const current = roomRef.current;
      if (
        current?.currentRoom &&
        followingRef.current &&
        isFilmActivity(current.currentRoom.currentState)
      ) {
        try {
          await emitFollowing(false);
          if (
            operation.current !== generation ||
            roomRef.current?.currentRoom?.id !== target
          )
            return;
        } catch (error) {
          if (operation.current !== generation) return;
          setActionError(
            error instanceof Error ? error.message : '无法退出同步，请稍后重试'
          );
          return;
        }
        followingRef.current = false;
        setFollowingRoom(false);
        personalIntent.current = true;
        personalRoom.current = target;
      }
      stopPlayback();
    })();
  }, [emitFollowing, stopPlayback]);

  // 房间被删除：还在跟随这个房间的人，画面跟着收掉；“仅自己看”的人继续看自己的
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  useEffect(() => {
    const onDeleted = () => {
      if (!followingRef.current || !hrefRef.current) return;
      // 正在 /play 整页看的人，页面本身就是播放器，不能把页面掏空
      if (pathnameRef.current === '/play') return;
      stopPlayback();
    };
    window.addEventListener('tongmu:room-deleted', onDeleted);
    return () => window.removeEventListener('tongmu:room-deleted', onDeleted);
  }, [stopPlayback]);

  const shareCurrentPlayback = useCallback((targetRoomId?: string) => {
    const target = targetRoomId || roomRef.current?.currentRoom?.id;
    if (hrefRef.current && target) {
      const current = roomRef.current?.currentRoom;
      const queueId = new URL(
        hrefRef.current,
        'https://tongmu.invalid'
      ).searchParams.get('queueId');
      const sharedHref =
        queueId &&
        !(
          current &&
          current.id === target &&
          current.queue?.some((item) => item.id === queueId)
        )
          ? withoutQueueItem(hrefRef.current)
          : hrefRef.current;
      personalIntent.current = false;
      personalRoom.current = undefined;
      followingRef.current = true;
      setFollowingRoom(true);
      saveRoomViewingPreference(target, true);
      selectionRoom.current = target;
      setHref(sharedHref);
      setRoomSelectionHref(sharedHref);
      setRoomSelectionKey(
        roomRef.current?.currentRoom?.id === target
          ? roomActivityKey(roomRef.current.currentRoom)
          : roomActivityKey({ id: target, currentState: null })
      );
    }
  }, []);
  const clearRoomSelection = useCallback(
    (selected: string) =>
      setRoomSelectionHref((previous) =>
        previous === selected ? null : previous
      ),
    []
  );
  const reloadPlayback = useCallback(() => {
    setMetadata((previous) => ({ ...previous, loading: true, error: null }));
    setSurfaceVersion((previous) => previous + 1);
  }, []);

  const choosePlayback = useCallback(
    async (
      choice: 'queue' | 'room' | 'personal',
      selectedHref = pendingHref
    ) => {
      if (!selectedHref && choice !== 'personal') return;
      if (choice === 'personal' && selectedHref)
        selectedHref = withoutQueueItem(selectedHref);
      const generation = ++operation.current;
      const target = roomRef.current?.currentRoom?.id;
      const isCurrent = () =>
        generation === operation.current &&
        target === roomRef.current?.currentRoom?.id;
      choicePending.current = true;
      setActionPending(true);
      setActionError('');
      try {
        if (choice === 'queue') {
          if (!selectedHref) return;
          const current = roomRef.current;
          if (!current?.isConnected || !target)
            throw new Error('房间连接中断，请重连后再添加');
          if (
            queueAttempt.current?.roomId !== target ||
            queueAttempt.current.href !== selectedHref
          )
            queueAttempt.current = {
              roomId: target,
              href: selectedHref,
              commandId: crypto.randomUUID(),
            };
          await current.roomCommand('queue:add', {
            ...queueItemFromHref(selectedHref),
            roomId: target,
            commandId: queueAttempt.current.commandId,
          });
          if (!isCurrent()) return;
          queueAttempt.current = null;
          setQueueNotice('已加入待看，当前影片继续播放');
        } else {
          if (choice === 'personal') {
            if (followingRef.current) await emitFollowing(false);
            if (!isCurrent()) return;
            personalIntent.current = true;
            personalRoom.current = target;
            saveRoomViewingPreference(target, false, selectedHref);
            followingRef.current = false;
            setFollowingRoom(false);
            setRoomSelectionHref(null);
            setRoomSelectionKey(null);
            selectionRoom.current = undefined;
          } else {
            if (!selectedHref) return;
            const selectedRoom = roomRef.current?.currentRoom;
            if (!selectedRoom || !roomRef.current?.canControl)
              throw new Error('主持已更新，请加入片单或仅自己看');
            if (!followingRef.current)
              throw new Error('请先回到一起看，再切换房间影片');
            personalIntent.current = false;
            personalRoom.current = undefined;
            saveRoomViewingPreference(target, true);
            selectionRoom.current = selectedRoom.id;
            setRoomSelectionHref(selectedHref);
            setRoomSelectionKey(roomActivityKey(selectedRoom));
          }
          if (selectedHref) {
            if (
              !hrefRef.current ||
              playbackIdentity(hrefRef.current) !==
                playbackIdentity(selectedHref)
            )
              setSurfaceVersion((previous) => previous + 1);
            setHref(selectedHref);
          }
        }
        setPendingHref(null);
      } catch (error) {
        if (!isCurrent()) return;
        setActionError(
          error instanceof Error ? error.message : '操作失败，请重试'
        );
      } finally {
        if (isCurrent()) setActionPending(false);
      }
    },
    [pendingHref, emitFollowing]
  );
  requestPersonal.current = (selected) => {
    void choosePlayback('personal', selected);
  };
  requestTogether.current = (selected) => {
    void choosePlayback('room', selected);
  };

  const enterPersonalViewing = useCallback(async () => {
    const generation = operation.current + 1;
    const target = roomRef.current?.currentRoom?.id;
    await choosePlayback('personal', hrefRef.current);
    return (
      operation.current === generation &&
      roomRef.current?.currentRoom?.id === target &&
      !followingRef.current
    );
  }, [choosePlayback]);

  const value = useMemo(
    () => ({
      href,
      presentation,
      followingRoom,
      controller,
      metadata,
      requestPlayback,
      updateHref,
      setMetadata,
      attachController,
      registerSlot,
      minimize,
      restore,
      endSession,
      resumeRoom,
      roomSelectionHref:
        selectionRoom.current && selectionRoom.current !== roomId
          ? null
          : roomSelectionHref,
      roomSelectionKey:
        selectionRoom.current && selectionRoom.current !== roomId
          ? null
          : roomSelectionKey,
      shareCurrentPlayback,
      clearRoomSelection,
      reloadPlayback,
      enterPersonalViewing,
    }),
    [
      href,
      presentation,
      followingRoom,
      controller,
      metadata,
      requestPlayback,
      updateHref,
      minimize,
      restore,
      endSession,
      resumeRoom,
      roomSelectionHref,
      roomSelectionKey,
      roomId,
      shareCurrentPlayback,
      clearRoomSelection,
      reloadPlayback,
      enterPersonalViewing,
    ]
  );

  const openFull = () => {
    setFolded(false);
    if (roomId && followingRoom)
      router.push(`/watch-room?room=${encodeURIComponent(roomId)}`);
    else if (href) router.push(href);
  };
  // 在房间里跟随同步、又没有控制权的人，播放进度由房主决定，不给本地暂停
  const playLocked = Boolean(
    roomId && followingRoom && watchRoom && !watchRoom.canControl
  );
  const togglePlaying = () => {
    if (!controller || playLocked) return;
    if (controller.video.paused) {
      void Promise.resolve(controller.play()).catch(() => {
        /* 浏览器拒绝自动播放时保持暂停，用户可以再点一次 */
      });
    } else {
      controller.pause();
    }
  };
  const toggleMuted = () => {
    if (!ownsSound) claimSound();
    else if (controller?.video)
      controller.video.muted = !controller.video.muted;
  };
  const unread = watchRoom?.currentRoom?.unreadCount || 0;
  // 小窗可拖动：只叠加一个位移，不改播放实例
  const miniDrag = useMiniPlayerDrag(
    hostRef,
    Boolean(href) && presentation === 'mini'
  );
  const slotStyle = slotRect
    ? ({
        '--tm-slot-left': `${slotRect.left}px`,
        '--tm-slot-top': `${slotRect.top}px`,
        '--tm-slot-width': `${slotRect.width}px`,
        '--tm-slot-height': `${slotRect.height}px`,
      } as CSSProperties)
    : undefined;

  return (
    <PlaybackSessionContext.Provider value={value}>
      {children}
      {href &&
        !ownsSound &&
        (presentation === 'full' || presentation === 'docked') && (
          <button className='tm-audio-focus-notice' onClick={claimSound}>
            另一标签页正在出声 · 在这里听
          </button>
        )}
      {href && (
        <div
          ref={hostRef}
          className='tm-playback-host'
          data-presentation={presentation}
          data-dragging={miniDrag.dragging ? 'true' : undefined}
          data-testid='global-playback-host'
          style={{ ...slotStyle, ...miniDrag.style }}
        >
          <PlaybackSurface key={surfaceVersion} />
          <PlaybackRoomMessages />
          {presentation === 'docked' &&
            pathname === '/watch-room' &&
            followingRoom && (
              <RoomPlaybackButton
                className='tm-room-fold-button'
                hint='收起画面，继续播放'
                aria-label='收起画面'
                onClick={minimize}
              >
                <ChevronsDown size={20} aria-hidden='true' />
              </RoomPlaybackButton>
            )}
          {(presentation === 'mini' || presentation === 'folded') && (
            <div
              className={`tm-playback-chrome tm-playback-chrome--${presentation}`}
            >
              <button
                className='tm-playback-title'
                onClick={presentation === 'folded' ? restore : openFull}
                title='恢复画面'
              >
                <span className='tm-playback-thumbnail'>
                  {metadata.poster ? (
                    <Image
                      src={metadata.poster}
                      alt=''
                      fill
                      sizes='72px'
                      unoptimized
                    />
                  ) : (
                    <Film size={20} aria-hidden='true' />
                  )}
                  {!followingRoom && roomId && (
                    <small className='tm-playback-personal-badge'>
                      个人观看
                    </small>
                  )}
                </span>
                <span className='tm-playback-copy'>
                  <span>{metadata.title}</span>
                  <span className='tm-playback-context'>
                    {roomId && <small>{watchRoom?.currentRoom?.name}</small>}
                    {roomId && !watchRoom?.isConnected && <small>重连中</small>}
                    {!ownsSound && <small>此页静音</small>}
                  </span>
                </span>
              </button>
              <button
                onClick={togglePlaying}
                disabled={playLocked || !controller}
                aria-label={
                  playLocked ? '播放进度由房主控制' : paused ? '播放' : '暂停'
                }
                title={
                  playLocked ? '播放进度由房主控制' : paused ? '播放' : '暂停'
                }
              >
                {paused ? (
                  <Play size={16} aria-hidden='true' />
                ) : (
                  <Pause size={16} aria-hidden='true' />
                )}
              </button>
              <button
                onClick={toggleMuted}
                aria-label={muted ? '开启本机声音' : '静音本机'}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              {roomId && (
                <button
                  onClick={() =>
                    window.dispatchEvent(new Event('tongmu:open-chat'))
                  }
                  aria-label={`房间消息${unread ? `，${unread}条未读` : ''}`}
                >
                  <MessageCircle size={16} />
                  {unread > 0 && (
                    <b
                      key={unread}
                      className='tm-unread-badge tm-room-unread-enter'
                    >
                      {unread > 99 ? '99+' : unread}
                    </b>
                  )}
                </button>
              )}
              {/* 小窗里点标题缩略图本来就是打开完整界面；这个按钮留给折叠态，小窗里让出位置给播放/暂停 */}
              {presentation === 'folded' && (
                <button onClick={openFull} aria-label='打开完整观影界面'>
                  <Maximize2 size={15} />
                </button>
              )}
              {presentation === 'mini' && (
                <button
                  onClick={minimize}
                  aria-label='收起画面，继续播放'
                  title='收起画面，继续播放'
                >
                  <Minus size={17} />
                </button>
              )}
              <button
                onClick={endSession}
                aria-label='关闭播放'
                title={
                  roomId &&
                  followingRoom &&
                  isFilmActivity(watchRoom?.currentRoom?.currentState)
                    ? '关闭并退出同步'
                    : '关闭播放'
                }
              >
                <X size={17} />
              </button>
            </div>
          )}
        </div>
      )}
      {href &&
        metadata.error &&
        metadata.error !== dismissedError &&
        presentation !== 'full' && (
          <div
            className='tm-playback-action-error tm-playback-recovery'
            role='alert'
          >
            <div>
              <strong>影片暂时无法播放</strong>
              <p>{metadata.error}</p>
            </div>
            <button
              onClick={() => {
                setDismissedError('');
                reloadPlayback();
              }}
            >
              重新加载影片
            </button>
            <button
              onClick={() => setDismissedError(metadata.error ?? '')}
              aria-label='收起错误提示'
              title='收起提示'
            >
              <X size={16} />
            </button>
          </div>
        )}
      {roomId && !pathname.startsWith('/watch-room') && (
        <Link
          className='tm-return-room'
          href={`/watch-room?room=${encodeURIComponent(roomId)}`}
        >
          <ArrowUpRight size={15} />
          返回房间{unread > 0 && ` · ${unread}条未读`}
        </Link>
      )}
      {queueNotice && (
        <div className='tm-playback-action-error' role='status'>
          {queueNotice}
          <button onClick={() => setQueueNotice('')} aria-label='关闭待看提示'>
            <X size={14} />
          </button>
        </div>
      )}
      {actionError && !pendingHref && (
        <div className='tm-playback-action-error' role='alert'>
          {actionError}
          <button onClick={() => setActionError('')} aria-label='关闭播放提示'>
            <X size={14} />
          </button>
        </div>
      )}
      {pendingHref && (
        <div
          className='tm-playback-choice-backdrop'
          role='presentation'
          onClick={() => !actionPending && setPendingHref(null)}
        >
          <section
            className='tm-playback-choice'
            role='dialog'
            aria-modal='true'
            aria-labelledby='tm-playback-choice-title'
            onClick={(event) => event.stopPropagation()}
          >
            <Film size={24} />
            <h2 id='tm-playback-choice-title'>这部影片，想怎么观看？</h2>
            <p>
              你仍在「{watchRoom?.currentRoom?.name}
              」。浏览影片不会打断大家正在看的内容。
            </p>
            <button
              disabled={actionPending}
              onClick={() => choosePlayback('queue')}
            >
              加入房间片单<span>当前影片继续，稍后一起看</span>
            </button>
            {watchRoom?.canControl && (
              <button
                disabled={actionPending}
                onClick={() => choosePlayback('room')}
              >
                现在一起看<span>切换整个房间的影片</span>
              </button>
            )}
            <button
              disabled={actionPending}
              onClick={() => choosePlayback('personal')}
            >
              仅自己看<span>暂离同步，保留房间连接和消息</span>
            </button>
            {actionError && <p role='alert'>{actionError}</p>}
            <button
              className='tm-choice-cancel'
              disabled={actionPending}
              onClick={() => {
                setPendingHref(null);
                if (href) router.replace(href);
              }}
            >
              继续当前影片
            </button>
          </section>
        </div>
      )}
    </PlaybackSessionContext.Provider>
  );
}
