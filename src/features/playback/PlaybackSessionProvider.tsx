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

const PlaybackSurface = dynamic(() => import('./LegacyPlaybackSurface'), {
  ssr: false,
});

function withoutQueueItem(href: string) {
  const url = new URL(href, 'https://tongmu.invalid');
  url.searchParams.delete('queueId');
  return `${url.pathname}${url.search}`;
}

/**
 * 全站唯一的播放会话。
 *
 * 房间规则（参考 SyncTV）：人在房间里，这个播放器就是房间的播放器——
 * 房间放什么就放什么，在房间页里固定显示在舞台上。没有“个人观看”这种
 * 半在半不在的状态：想自己看别的，就退出房间（成员身份保留，随时回来）。
 *
 * - 进入空房间时手上正放着影片：有控制权就把这部带进房间（接着当前进度）；
 *   没有控制权就收起这部，等房间开始播放。
 * - 在房间里打开另一部影片：房间空着且有控制权就直接一起看；否则问
 *   加入片单 / 现在一起看 / 退出房间自己看。
 */
export default function PlaybackSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const router = useRouter();
  const watchRoom = useWatchRoomContextSafe();
  const roomRef = useRef(watchRoom);
  roomRef.current = watchRoom;
  const [href, setHref] = useState<string | null>(null);
  const [surfaceVersion, setSurfaceVersion] = useState(0);
  const hrefRef = useRef(href);
  hrefRef.current = href;
  const [folded, setFolded] = useState(false);
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

  const showHref = useCallback((nextHref: string) => {
    if (
      !hrefRef.current ||
      playbackIdentity(hrefRef.current) !== playbackIdentity(nextHref)
    )
      setSurfaceVersion((previous) => previous + 1);
    hrefRef.current = nextHref;
    setHref(nextHref);
  }, []);

  /** 让房间播放这一部：交给播放同步去发 play:change。 */
  const selectForRoom = useCallback(
    (selected: string, room: { id: string; currentState?: unknown }) => {
      selectionRoom.current = room.id;
      setRoomSelectionHref(selected);
      setRoomSelectionKey(
        roomActivityKey(room as Parameters<typeof roomActivityKey>[0])
      );
    },
    []
  );

  const requestPlayback = useCallback(
    (nextHref: string, origin: 'user' | 'room' | 'together' = 'user') => {
      const normalized = normalizePlaybackHref(nextHref);
      if (!normalized) return;
      if (origin === 'together') {
        requestTogether.current(normalized);
        return;
      }
      if (origin === 'user') {
        operation.current += 1;
        setActionPending(false);
        const context = roomRef.current;
        const room = context?.currentRoom;
        const current = hrefRef.current;
        if (
          room &&
          (!current || playbackIdentity(current) !== playbackIdentity(normalized))
        ) {
          if (!room.currentState && context?.canControl) {
            // 房间空着、自己能控制：直接一起看这部
            selectForRoom(normalized, room);
          } else {
            choicePending.current = true;
            setPendingHref(normalized);
            setActionError('');
            return;
          }
        }
      }
      showHref(normalized);
    },
    [selectForRoom, showHref]
  );

  const stopPlayback = useCallback(() => {
    operation.current += 1;
    controllerRef.current?.pause();
    hrefRef.current = null;
    setHref(null);
    attachController(null);
    setFolded(false);
    setPendingHref(null);
    choicePending.current = false;
    setRoomSelectionHref(null);
    setRoomSelectionKey(null);
    selectionRoom.current = undefined;
    setActionError('');
  }, []);

  // 进入 / 换到另一个房间
  const previousRoomRef = useRef<string | undefined>();
  const roomId = watchRoom?.currentRoom?.id;
  useEffect(() => {
    if (previousRoomRef.current === roomId) return;
    previousRoomRef.current = roomId;
    operation.current += 1;
    setPendingHref(null);
    setActionPending(false);
    choicePending.current = false;
    queueAttempt.current = null;
    setQueueNotice('');
    setActionError('');
    if (selectionRoom.current && selectionRoom.current !== roomId) {
      setRoomSelectionHref(null);
      setRoomSelectionKey(null);
      selectionRoom.current = undefined;
    }
    const context = roomRef.current;
    const room = context?.currentRoom;
    if (!room || room.currentState || !hrefRef.current) return;
    if (selectionRoom.current === room.id) return;
    if (context?.canControl) {
      // 进入空房间时正放着影片：带进房间，接着当前进度一起看
      selectForRoom(withoutQueueItem(hrefRef.current), room);
    } else {
      // 没有控制权：这部不属于房间，收起来等房间开始播放
      controllerRef.current?.pause();
      hrefRef.current = null;
      setHref(null);
      attachController(null);
    }
  }, [roomId, selectForRoom]);

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
  // 房间换片：跟着换
  useEffect(() => {
    const state = roomRef.current?.currentRoom?.currentState;
    if (state?.type === 'play')
      requestPlayback(playbackHrefFromState(state), 'room');
  }, [roomMediaKey, requestPlayback]);
  // 在房间页、房间正在放片，本机却没有画面（之前关掉了小窗）：重新打开
  const onRoomPage = pathname === '/watch-room';
  useEffect(() => {
    if (!onRoomPage || href || choicePending.current) return;
    const state = roomRef.current?.currentRoom?.currentState;
    if (state?.type === 'play')
      requestPlayback(playbackHrefFromState(state), 'room');
  }, [onRoomPage, href, roomMediaKey, requestPlayback]);

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
      : slot && slotRect && !folded
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
  // 关掉画面。在房间里只是本机不看画面了，人还在房间；回到房间页会重新打开。
  // 先停止同步再暂停，免得“暂停”被当成操作发给整个房间。
  const endSession = useCallback(() => {
    operation.current += 1;
    const video = controllerRef.current?.video;
    hrefRef.current = null;
    setHref(null);
    attachController(null);
    video?.pause();
    setFolded(false);
    setPendingHref(null);
    choicePending.current = false;
    setRoomSelectionHref(null);
    setRoomSelectionKey(null);
    selectionRoom.current = undefined;
    setActionError('');
  }, []);

  // 房间被删除：画面跟着收掉（/play 整页上的人页面本身就是播放器，保留）
  useEffect(() => {
    const onDeleted = () => {
      if (!hrefRef.current) return;
      if (pathnameRef.current === '/play') return;
      stopPlayback();
    };
    window.addEventListener('tongmu:room-deleted', onDeleted);
    return () => window.removeEventListener('tongmu:room-deleted', onDeleted);
  }, [stopPlayback]);

  const shareCurrentPlayback = useCallback(
    (targetRoomId?: string) => {
      const target = targetRoomId || roomRef.current?.currentRoom?.id;
      if (!hrefRef.current || !target) return;
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
      hrefRef.current = sharedHref;
      setHref(sharedHref);
      selectForRoom(
        sharedHref,
        current?.id === target ? current : { id: target, currentState: null }
      );
    },
    [selectForRoom]
  );
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
    async (choice: 'queue' | 'room' | 'alone', selectedHref = pendingHref) => {
      if (!selectedHref) return;
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
          setQueueNotice('已加入片单，当前影片继续播放');
          setPendingHref(null);
          // 留在房间：播放页的地址回到房间正在放的影片
          if (hrefRef.current && pathnameRef.current === '/play')
            router.replace(hrefRef.current);
        } else if (choice === 'room') {
          const selectedRoom = roomRef.current?.currentRoom;
          if (!selectedRoom || !roomRef.current?.canControl)
            throw new Error('房主没有开放成员控制播放，可以加入片单');
          selectForRoom(selectedHref, selectedRoom);
          setPendingHref(null);
          showHref(selectedHref);
        } else {
          // 退出房间自己看：先离开（之后本机操作不会再发给房间），再换片
          const alone = withoutQueueItem(selectedHref);
          roomRef.current?.leaveRoom();
          setPendingHref(null);
          showHref(alone);
        }
      } catch (error) {
        if (!isCurrent()) return;
        setActionError(
          error instanceof Error ? error.message : '操作失败，请重试'
        );
      } finally {
        if (generation === operation.current) setActionPending(false);
      }
    },
    [pendingHref, router, selectForRoom, showHref]
  );
  requestTogether.current = (selected) => {
    void choosePlayback('room', selected);
  };

  const value = useMemo(
    () => ({
      href,
      presentation,
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
    }),
    [
      href,
      presentation,
      controller,
      metadata,
      requestPlayback,
      updateHref,
      minimize,
      restore,
      endSession,
      roomSelectionHref,
      roomSelectionKey,
      roomId,
      shareCurrentPlayback,
      clearRoomSelection,
      reloadPlayback,
    ]
  );

  const openFull = () => {
    setFolded(false);
    if (roomId)
      router.push(`/watch-room?room=${encodeURIComponent(roomId)}`);
    else if (href) router.push(href);
  };
  // 在房间里又没有控制权的人，播放进度由房主决定，不给本地暂停
  const playLocked = Boolean(roomId && watchRoom && !watchRoom.canControl);
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
            pathname === '/watch-room' && (
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
                aria-label={roomId ? '关闭画面（仍在房间）' : '关闭播放'}
                title={roomId ? '关闭画面，仍在房间里' : '关闭播放'}
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
              你在房间「{watchRoom?.currentRoom?.name}」里，房间里的人看的是同一个画面。
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
              onClick={() => choosePlayback('alone')}
            >
              退出房间，自己看<span>成员身份保留，随时可以回到房间</span>
            </button>
            {actionError && <p role='alert'>{actionError}</p>}
            <button
              className='tm-choice-cancel'
              disabled={actionPending}
              onClick={() => {
                setPendingHref(null);
                if (href) router.replace(href);
                else if (roomId)
                  router.replace(
                    `/watch-room?room=${encodeURIComponent(roomId)}`
                  );
              }}
            >
              {href ? '继续当前影片' : '返回房间'}
            </button>
          </section>
        </div>
      )}
    </PlaybackSessionContext.Provider>
  );
}
