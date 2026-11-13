'use client';

/*
 * 房间 <-> 全站播放器 的唯一连接点。
 *
 * - 把房间状态、本机权限、播放器实际在放的影片喂给同步引擎（RoomSyncEngine）；
 * - 执行引擎的决定：打开房间影片、收起无关影片、发房间命令；
 * - 在播放会话上注册拦截器：在房间里打开另一部影片时，问“加入片单 / 现在一起看 /
 *   退出房间自己看”；
 * - 在房间页里，房间在放片而本机没有画面（之前关掉了）时重新打开。
 *
 * 播放器和播放会话都不认识房间；房间页、选片器通过 useRoomPlayback() 使用这里的能力。
 */

import { Film, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { roomServerNow } from '@/lib/room-clock';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import {
  type PlaybackController,
  usePlaybackSessionSafe,
} from '@/features/playback/context';
import {
  playbackHrefFromState,
  playbackIdentity,
  queueItemFromHref,
} from '@/features/playback/session';

import { mediaKey } from './sync/drift';
import {
  type PlayerEvent,
  type PlayerPort,
  RoomSyncEngine,
} from './sync/sync-engine';

import type { PlayState } from '@/types/watch-room';

// ------------------------------------------------------------------ 播放器适配

const NATIVE_EVENT: Record<PlayerEvent, string> = {
  play: 'play',
  pause: 'pause',
  seeked: 'seeked',
  ratechange: 'ratechange',
};

/** 全站播放器控制器（Artplayer 实例）-> 同步引擎需要的播放器接口 */
export function playerPortFrom(controller: PlaybackController): PlayerPort {
  const video = controller.video;
  return {
    get currentTime() {
      return Number(controller.currentTime) || 0;
    },
    get duration() {
      return Number(video.duration);
    },
    get paused() {
      return video.paused;
    },
    get ended() {
      return video.ended;
    },
    get readyState() {
      return video.readyState;
    },
    get seeking() {
      return video.seeking;
    },
    get playbackRate() {
      return Number(controller.playbackRate) || 1;
    },
    play: () => controller.play(),
    pause: () => controller.pause(),
    seek: (time) => {
      controller.currentTime = time;
    },
    setRate: (rate) => {
      controller.playbackRate = rate;
    },
    notice: (message) => {
      if (controller.notice) controller.notice.show = message;
    },
    on: (event, listener) => {
      const name = NATIVE_EVENT[event];
      video.addEventListener(name, listener);
      return () => video.removeEventListener(name, listener);
    },
  };
}

// ------------------------------------------------------------------ 对播放页公开的只读状态

let activeEngine: RoomSyncEngine | null = null;

/** 播放器恢复倍速时用：房间同步来的倍速不写进个人偏好。 */
export function isRemoteRoomRateActive() {
  return Boolean(activeEngine?.isApplyingRemoteRate());
}
export function getRoomRemotePlaybackRate() {
  return activeEngine?.inRoom ? activeEngine.remoteRate : null;
}

interface RoomPlaybackApi {
  /** 人在房间里：播放器跟着房间，不恢复个人进度 */
  inRoom: boolean;
  /** 在房间里但没有控制权：播放器上的换集、倍速等应当禁用 */
  locked: boolean;
  /** 让整个房间看这一部（选片器、片单开播） */
  playTogether: (href: string) => void;
  /** 把本机正在看的影片带进房间 */
  shareCurrent: () => void;
}

const RoomPlaybackContext = createContext<RoomPlaybackApi>({
  inRoom: false,
  locked: false,
  playTogether: () => undefined,
  shareCurrent: () => undefined,
});

export function useRoomPlayback() {
  return useContext(RoomPlaybackContext);
}

function withoutQueueItem(href: string) {
  const url = new URL(href, 'https://tongmu.invalid');
  url.searchParams.delete('queueId');
  return `${url.pathname}${url.search}`;
}

// ------------------------------------------------------------------ 桥

export default function RoomPlaybackBridge({
  children,
}: {
  children?: ReactNode;
}) {
  const watchRoom = useWatchRoomContextSafe();
  const session = usePlaybackSessionSafe();
  const pathname = usePathname();
  const router = useRouter();
  const roomRef = useRef(watchRoom);
  roomRef.current = watchRoom;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const onRoomPage = pathname === '/watch-room';

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [choiceError, setChoiceError] = useState('');
  const [notice, setNotice] = useState('');
  /** 用户关掉画面时房间正在放的那一部：离开房间页时不自动重新弹出 */
  const closedKey = useRef('');

  const engine = useMemo(
    () =>
      new RoomSyncEngine({
        command: (event, payload) => {
          const room = roomRef.current;
          if (!room) return Promise.reject(new Error('不在房间里'));
          return room.roomCommand(event, payload);
        },
        follow: (state: PlayState) => {
          const current = sessionRef.current;
          if (!current) return;
          if (
            !current.href &&
            closedKey.current === mediaKey(state) &&
            pathnameRef.current !== '/watch-room'
          )
            return;
          closedKey.current = '';
          current.requestPlayback(playbackHrefFromState(state), 'system');
        },
        stopLocal: () => sessionRef.current?.endSession(),
        serverNow: roomServerNow,
        now: () => Date.now(),
      }),
    []
  );
  useEffect(() => {
    activeEngine = engine;
    return () => {
      if (activeEngine === engine) activeEngine = null;
      engine.dispose();
    };
  }, [engine]);

  // 播放器
  const controller = session?.controller || null;
  useEffect(() => {
    engine.setPort(controller ? playerPortFrom(controller) : null);
  }, [engine, controller]);

  // 房间与本机影片
  const room = watchRoom?.currentRoom || null;
  const roomId = room?.id || null;
  const connected = Boolean(watchRoom?.isConnected);
  const canControl = Boolean(room && watchRoom?.canControl);
  const state = room?.currentState ?? null;
  const media = session?.media || null;
  useEffect(() => {
    engine.update({
      roomId,
      connected,
      canControl,
      state,
      local: media,
      selfAccountId: getAuthInfoFromBrowserCookie()?.username,
    });
  }, [engine, roomId, connected, canControl, state, media]);

  // 定时检查：弥补缓冲、标签页后台、时钟漂移带来的偏差
  useEffect(() => {
    if (!roomId) return;
    const timer = window.setInterval(() => void engine.tick(), 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void engine.tick(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [engine, roomId]);

  // 记下用户关掉画面时房间在放的影片；在房间页里重新打开
  const href = session?.href || null;
  const previousHref = useRef(href);
  useEffect(() => {
    const roomState = roomRef.current?.currentRoom?.currentState;
    if (previousHref.current && !href && roomState?.type === 'play')
      closedKey.current = mediaKey(roomState);
    previousHref.current = href;
  }, [href]);
  const roomFilmKey = state?.type === 'play' ? mediaKey(state) : '';
  useEffect(() => {
    if (!onRoomPage || href || pendingHref) return;
    const roomState = roomRef.current?.currentRoom?.currentState;
    if (roomState?.type !== 'play') return;
    closedKey.current = '';
    sessionRef.current?.requestPlayback(
      playbackHrefFromState(roomState),
      'system'
    );
  }, [onRoomPage, href, roomFilmKey, pendingHref]);

  // 房间被删除：画面跟着收掉（/play 整页上的人页面本身就是播放器，保留）
  useEffect(() => {
    const onDeleted = () => {
      const current = sessionRef.current;
      if (!current?.href || pathnameRef.current === '/play') return;
      current.endSession();
    };
    window.addEventListener('tongmu:room-deleted', onDeleted);
    return () => window.removeEventListener('tongmu:room-deleted', onDeleted);
  }, []);

  // 换房间或离开房间：收起对话框
  useEffect(() => {
    setPendingHref(null);
    setChoiceBusy(false);
    setChoiceError('');
    setNotice('');
    closedKey.current = '';
  }, [roomId]);

  // 拦截“在房间里打开另一部影片”
  useEffect(() => {
    if (!session) return;
    session.setPlaybackGuard((target) => {
      const context = roomRef.current;
      const current = context?.currentRoom;
      if (!current) return true;
      const roomState = current.currentState;
      const identity = playbackIdentity(target);
      if (
        roomState?.type === 'play' &&
        playbackIdentity(playbackHrefFromState(roomState)) === identity
      )
        return true;
      const shown = sessionRef.current?.href;
      if (shown && playbackIdentity(shown) === identity) return true;
      if (!roomState && context?.canControl) {
        // 空房间、自己能控制：直接一起看
        engine.intend(null);
        return true;
      }
      setChoiceError('');
      setPendingHref(target);
      return false;
    });
    return () => session.setPlaybackGuard(null);
    // setPlaybackGuard 是稳定的；不随 session 对象的其他字段重注册
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.setPlaybackGuard, engine]);

  const playTogether = useCallback(
    (target: string) => {
      const context = roomRef.current;
      if (!context?.currentRoom) return;
      if (!context.canControl) {
        setNotice('房主没有开放成员控制播放，可以把影片加入片单');
        return;
      }
      engine.intend(null);
      sessionRef.current?.requestPlayback(target, 'system');
    },
    [engine]
  );
  const shareCurrent = useCallback(() => {
    if (!roomRef.current?.canControl) return;
    engine.intend(null);
    void engine.tick(true);
  }, [engine]);

  const backToRoomFilm = useCallback(() => {
    const shown = sessionRef.current?.href;
    const id = roomRef.current?.currentRoom?.id;
    if (pathnameRef.current !== '/play') return;
    if (shown) router.replace(shown);
    else if (id) router.replace(`/watch-room?room=${encodeURIComponent(id)}`);
  }, [router]);

  const choose = async (choice: 'queue' | 'together' | 'alone') => {
    const target = pendingHref;
    const context = roomRef.current;
    if (!target || !context?.currentRoom) return;
    const targetRoom = context.currentRoom.id;
    const stale = () => roomRef.current?.currentRoom?.id !== targetRoom;
    setChoiceBusy(true);
    setChoiceError('');
    try {
      if (choice === 'queue') {
        await context.roomCommand('queue:add', {
          ...queueItemFromHref(target),
          commandId: crypto.randomUUID(),
        });
        // 回执到达前已经换了房间：这次选择作废
        if (stale()) return;
        setNotice('已加入片单，当前影片继续播放');
        setPendingHref(null);
        backToRoomFilm();
      } else if (choice === 'together') {
        setPendingHref(null);
        playTogether(target);
      } else {
        // 退出房间自己看：先离开（之后本机操作不会再发给房间），再换片
        context.leaveRoom();
        setPendingHref(null);
        sessionRef.current?.requestPlayback(withoutQueueItem(target), 'system');
      }
    } catch (error) {
      if (stale()) return;
      setChoiceError(
        error instanceof Error ? error.message : '操作失败，请重试'
      );
    } finally {
      if (!stale()) setChoiceBusy(false);
    }
  };

  const api = useMemo<RoomPlaybackApi>(
    () => ({
      inRoom: Boolean(roomId),
      locked: Boolean(roomId && !canControl),
      playTogether,
      shareCurrent,
    }),
    [roomId, canControl, playTogether, shareCurrent]
  );

  return (
    <RoomPlaybackContext.Provider value={api}>
      {children}
      {notice && (
        <div className='tm-playback-action-error' role='status'>
          {notice}
          <button onClick={() => setNotice('')} aria-label='关闭提示'>
            <X size={14} />
          </button>
        </div>
      )}
      {pendingHref && (
        <div
          className='tm-playback-choice-backdrop'
          role='presentation'
          onClick={() => {
            if (choiceBusy) return;
            setPendingHref(null);
            backToRoomFilm();
          }}
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
            <p>你在房间「{room?.name}」里，房间里的人看的是同一个画面。</p>
            <button disabled={choiceBusy} onClick={() => choose('queue')}>
              加入房间片单<span>当前影片继续，稍后一起看</span>
            </button>
            {canControl && (
              <button disabled={choiceBusy} onClick={() => choose('together')}>
                现在一起看<span>切换整个房间的影片</span>
              </button>
            )}
            <button disabled={choiceBusy} onClick={() => choose('alone')}>
              退出房间，自己看<span>成员身份保留，随时可以回到房间</span>
            </button>
            {choiceError && <p role='alert'>{choiceError}</p>}
            <button
              className='tm-choice-cancel'
              disabled={choiceBusy}
              onClick={() => {
                setPendingHref(null);
                backToRoomFilm();
              }}
            >
              {href ? '继续当前影片' : '返回房间'}
            </button>
          </section>
        </div>
      )}
    </RoomPlaybackContext.Provider>
  );
}
