'use client';

import {
  ArrowUpRight,
  ChevronsDown,
  Film,
  Maximize2,
  MessageCircle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
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
import type { Socket } from 'socket.io-client';

import RoomPlaybackButton from '@/features/rooms/RoomPlaybackButton';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import {
  type PlaybackController,
  type PlaybackMetadata,
  type PlaybackPresentation,
  PlaybackSessionContext,
} from './context';
import {
  normalizePlaybackHref,
  playbackHrefFromState,
  playbackIdentity,
  queueItemFromHref,
} from './session';
import { useAudioFocus } from './useAudioFocus';

const PlaybackSurface = dynamic(() => import('./LegacyPlaybackSurface'), {
  ssr: false,
});

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
  const [followingRoom, setFollowingRoom] = useState(true);
  const followingRef = useRef(followingRoom);
  followingRef.current = followingRoom;
  const [controller, attachController] = useState<PlaybackController | null>(
    null
  );
  const [metadata, setMetadata] = useState<PlaybackMetadata>({
    title: '正在准备影片',
  });
  const [slot, registerSlot] = useState<HTMLElement | null>(null);
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [roomSelectionHref, setRoomSelectionHref] = useState<string | null>(
    null
  );
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [muted, setMuted] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { ownsSound, claimSound } = useAudioFocus(controller?.video || null);

  const updateHref = useCallback((nextHref: string) => {
    const normalized = normalizePlaybackHref(nextHref);
    if (normalized) setHref(normalized);
  }, []);

  const requestPlayback = useCallback(
    (nextHref: string, origin: 'user' | 'room' = 'user') => {
      const normalized = normalizePlaybackHref(nextHref);
      if (!normalized) return;
      if (origin === 'room' && !followingRef.current) return;
      const current = hrefRef.current;
      if (
        origin === 'user' &&
        roomRef.current?.currentRoom?.currentState &&
        followingRef.current &&
        (!current || playbackIdentity(current) !== playbackIdentity(normalized))
      ) {
        setPendingHref(normalized);
        setActionError('');
        return;
      }
      if (
        origin === 'user' &&
        roomRef.current?.currentRoom &&
        roomRef.current.canControl
      )
        setRoomSelectionHref(normalized);
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
    setActionError('');
    try {
      await emitFollowing(true);
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
      setFolded(false);
    } catch (error) {
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
      followingRef.current = true;
      setFollowingRoom(true);
      setPendingHref(null);
      if (hadRoom) setRoomSelectionHref(null);
    }
  }, [roomId]);

  const roomState = watchRoom?.currentRoom?.currentState;
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
    // Element scroll events do not bubble; capture BODY and nested page scrolling too.
    window.addEventListener('scroll', measure, {
      passive: true,
      capture: true,
    });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure, true);
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

  const minimize = useCallback(() => setFolded(true), []);
  const restore = useCallback(() => setFolded(false), []);
  const endSession = useCallback(() => {
    controller?.pause();
    setHref(null);
    attachController(null);
  }, [controller]);

  const shareCurrentPlayback = useCallback(() => {
    if (hrefRef.current) setRoomSelectionHref(hrefRef.current);
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
      if (!selectedHref) return;
      setActionPending(true);
      setActionError('');
      try {
        if (choice === 'queue') {
          const current = roomRef.current;
          const socket = current?.socket as Socket | null;
          if (!socket?.connected)
            throw new Error('房间连接中断，请重连后再添加');
          await new Promise<void>((resolve, reject) => {
            socket.timeout(8000).emit(
              'queue:add',
              {
                ...queueItemFromHref(selectedHref),
                commandId: crypto.randomUUID(),
                baseRevision: current?.currentRoom?.revision,
              },
              (
                timeout: Error | null,
                response: { success?: boolean; error?: string }
              ) =>
                timeout
                  ? reject(new Error('添加超时，请检查片单后重试'))
                  : response?.success
                  ? resolve()
                  : reject(new Error(response?.error || '无法添加到片单'))
            );
          });
          if (hrefRef.current && pathname === '/play')
            router.replace(hrefRef.current);
        } else {
          if (choice === 'personal') {
            await emitFollowing(false);
            followingRef.current = false;
            setFollowingRoom(false);
            setRoomSelectionHref(null);
          } else {
            if (!roomRef.current?.canControl)
              throw new Error('主持已更新，请加入片单或仅自己看');
            setRoomSelectionHref(selectedHref);
          }
          if (
            !hrefRef.current ||
            playbackIdentity(hrefRef.current) !== playbackIdentity(selectedHref)
          )
            setSurfaceVersion((previous) => previous + 1);
          setHref(selectedHref);
        }
        setPendingHref(null);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : '操作失败，请重试'
        );
      } finally {
        setActionPending(false);
      }
    },
    [pendingHref, emitFollowing, pathname, router]
  );

  const enterPersonalViewing = useCallback(
    () => choosePlayback('personal', hrefRef.current),
    [choosePlayback]
  );

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
      roomSelectionHref,
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
  const toggleMuted = () => {
    if (!ownsSound) claimSound();
    else if (controller?.video)
      controller.video.muted = !controller.video.muted;
  };
  const unread = watchRoom?.currentRoom?.unreadCount || 0;
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
          className='tm-playback-host'
          data-presentation={presentation}
          data-testid='global-playback-host'
          style={slotStyle}
        >
          <PlaybackSurface key={surfaceVersion} />
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
              <button onClick={openFull} aria-label='打开完整观影界面'>
                <Maximize2 size={15} />
              </button>
              {presentation === 'mini' && (
                <button
                  onClick={minimize}
                  aria-label='收起画面，继续播放'
                  title='收起画面，继续播放'
                >
                  <X size={17} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {href && metadata.error && presentation !== 'full' && (
        <div
          className='tm-playback-action-error tm-playback-recovery'
          role='alert'
        >
          <div>
            <strong>影片暂时无法播放</strong>
            <p>{metadata.error}</p>
          </div>
          <button onClick={reloadPlayback}>重新加载影片</button>
        </div>
      )}
      {roomId && !followingRoom && (
        <button className='tm-return-room' onClick={resumeRoom}>
          <ArrowUpRight size={15} />
          回到一起看{unread > 0 && ` · ${unread}条未读`}
        </button>
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
