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
  type PlaybackGuard,
  type PlaybackMedia,
  type PlaybackMetadata,
  type PlaybackPresentation,
  type PlaybackSession,
  PlaybackSessionContext,
} from './context';
import PlaybackRoomMessages from './RoomLiveMessages';
import { normalizePlaybackHref, playbackIdentity } from './session';
import { useAudioFocus } from './useAudioFocus';
import { useMiniPlayerDrag } from './useMiniPlayerDrag';

const PlaybackSurface = dynamic(() => import('./LegacyPlaybackSurface'), {
  ssr: false,
});

const sameMedia = (a: PlaybackMedia | null, b: PlaybackMedia | null) =>
  a === b ||
  Boolean(
    a &&
      b &&
      a.source === b.source &&
      a.videoId === b.videoId &&
      a.episode === b.episode &&
      a.ready === b.ready &&
      a.url === b.url &&
      a.queueItemId === b.queueItemId &&
      a.videoName === b.videoName &&
      a.poster === b.poster
  );

/**
 * 全站唯一的播放会话：放什么、在哪里显示（整页 / 房间舞台 / 小窗 / 收起）。
 * 换页面不卸载播放器，四种形态是同一个播放实例。
 *
 * 这里没有房间逻辑：房间通过 RoomPlaybackBridge 用公开接口驱动它
 * （requestPlayback / setPlaybackGuard / controller / media）。
 */
export default function PlaybackSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [href, setHref] = useState<string | null>(null);
  const hrefRef = useRef(href);
  hrefRef.current = href;
  const [surfaceVersion, setSurfaceVersion] = useState(0);
  const [folded, setFolded] = useState(false);
  const [controller, attachController] = useState<PlaybackController | null>(
    null
  );
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const [metadata, setMetadata] = useState<PlaybackMetadata>({
    title: '正在准备影片',
  });
  const [media, setMedia] = useState<PlaybackMedia | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [slot, registerSlot] = useState<HTMLElement | null>(null);
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);
  const guardRef = useRef<PlaybackGuard | null>(null);
  // 仅界面：用户手动收起的失败提示文案；出现新的错误文案时会重新显示
  const [dismissedError, setDismissedError] = useState('');
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { ownsSound, claimSound } = useAudioFocus(controller?.video || null);

  const show = useCallback((nextHref: string) => {
    if (
      !hrefRef.current ||
      playbackIdentity(hrefRef.current) !== playbackIdentity(nextHref)
    )
      setSurfaceVersion((previous) => previous + 1);
    hrefRef.current = nextHref;
    setHref(nextHref);
  }, []);

  const requestPlayback = useCallback(
    (nextHref: string, origin: 'user' | 'system' = 'user') => {
      const normalized = normalizePlaybackHref(nextHref);
      if (!normalized) return;
      if (
        origin === 'user' &&
        guardRef.current &&
        !guardRef.current(normalized)
      )
        return;
      show(normalized);
    },
    [show]
  );

  /** 同一部影片里的地址变化（补充标题、切集写回地址），不重建播放器。 */
  const updateHref = useCallback((nextHref: string) => {
    const normalized = normalizePlaybackHref(nextHref);
    if (!normalized) return false;
    hrefRef.current = normalized;
    setHref(normalized);
    return true;
  }, []);

  const reportMedia = useCallback((next: PlaybackMedia | null) => {
    setMedia((previous) => (sameMedia(previous, next) ? previous : next));
  }, []);

  const setPlaybackGuard = useCallback((guard: PlaybackGuard | null) => {
    guardRef.current = guard;
  }, []);

  const minimize = useCallback(() => setFolded(true), []);
  const restore = useCallback(() => setFolded(false), []);
  // 关掉画面：先卸载（之后的暂停不会再被当成用户操作），再暂停
  const endSession = useCallback(() => {
    const video = controllerRef.current?.video;
    hrefRef.current = null;
    setHref(null);
    attachController(null);
    setMedia(null);
    video?.pause();
    setFolded(false);
  }, []);
  const reloadPlayback = useCallback(() => {
    setMetadata((previous) => ({ ...previous, loading: true, error: null }));
    setSurfaceVersion((previous) => previous + 1);
  }, []);

  // 房间舞台占位框：播放器按它的位置和大小显示
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

  const value = useMemo<PlaybackSession>(
    () => ({
      href,
      presentation,
      controller,
      metadata,
      media,
      requestPlayback,
      updateHref,
      setMetadata,
      reportMedia,
      attachController,
      registerSlot,
      setPlaybackGuard,
      minimize,
      restore,
      endSession,
      reloadPlayback,
    }),
    [
      href,
      presentation,
      controller,
      metadata,
      media,
      requestPlayback,
      updateHref,
      reportMedia,
      setPlaybackGuard,
      minimize,
      restore,
      endSession,
      reloadPlayback,
    ]
  );

  // 以下只是“显示房间信息”（名称、未读、是否可控），房间的决策都在 RoomPlaybackBridge
  const watchRoom = useWatchRoomContextSafe();
  const roomId = watchRoom?.currentRoom?.id;
  const openFull = () => {
    setFolded(false);
    if (roomId) router.push(`/watch-room?room=${encodeURIComponent(roomId)}`);
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
      {/* 一起看改由房间页自己的播放器同步（src/features/together），旧桥已停用 */}
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
          {presentation === 'docked' && pathname === '/watch-room' && (
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
    </PlaybackSessionContext.Provider>
  );
}
