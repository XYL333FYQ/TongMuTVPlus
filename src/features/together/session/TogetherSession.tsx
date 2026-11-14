'use client';

/*
 * 一起看的全站会话（挂在根布局，换页不卸载）：
 * - 房间播放器只有一个实例。它的画面节点在“房间页画面位置 / 小窗 / 暂存区”之间移动，
 *   离开房间页后在小窗里继续同步，回来时不重新加载；
 * - 人在房间里时，站内点开一部影片先问怎么看（加入片单 / 在房间里放 / 自己看）；
 * - 语音、聊天弹幕开关、房间提示。
 * 自己看（src/features/playback）不认识这里；这里只读它的“是否在放”和拦截挂点。
 */

import { usePathname, useRouter } from 'next/navigation';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { useVoiceChat } from '@/hooks/useVoiceChat';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';

import { TogetherSessionContext, TogetherSession as Session } from './context';
import FilmSheet, { FilmChoice } from './FilmSheet';
import { RoomChatSheet, RoomPill } from './RoomDock';
import RoomMini from './RoomMini';
import { filmFromHref, playChange, queueAdd } from '../commands';
import { displayRoomName } from '../lib/room-presentation';
import { useRoomPlayer } from '../player/useRoomPlayer';

import type { PlayState, RoomPermission } from '@/types/watch-room';

const DANMAKU_KEY = 'tm-together-chat-danmaku';

export default function TogetherSession({ children }: { children: ReactNode }) {
  const room = useWatchRoomContextSafe();
  const solo = usePlaybackSessionSafe();
  const router = useRouter();
  const pathname = usePathname();
  const current = room?.currentRoom || null;
  const can = useCallback(
    (permission: RoomPermission) =>
      !!current?.myPermissions?.includes(permission),
    [current?.myPermissions]
  );
  const state =
    current?.currentState?.type === 'play'
      ? (current.currentState as PlayState)
      : null;

  // ------------------------------------------------ 画面节点：房间页 / 小窗 / 暂存区
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const park = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const miniRef = useRef<HTMLElement | null>(null);
  const [onStage, setOnStage] = useState(false);
  useEffect(() => {
    const parking = document.createElement('div');
    parking.className = 'tm-t-player-park';
    parking.setAttribute('aria-hidden', 'true');
    const element = document.createElement('div');
    element.className = 'tm-t-player-host';
    parking.appendChild(element);
    document.body.appendChild(parking);
    park.current = parking;
    setHost(element);
    return () => parking.remove();
  }, []);
  // 节点在文档里直接搬家（始终不离开文档），视频不会被浏览器暂停。
  // 房间页 / 小窗卸载时 React 先解绑 ref 再删节点，所以这里能抢先把画面挪去暂存区。
  const hostNode = useRef<HTMLDivElement | null>(null);
  hostNode.current = host;
  const place = useCallback(() => {
    const node = hostNode.current;
    const target = stageRef.current || miniRef.current || park.current;
    if (node && target && node.parentElement !== target)
      target.appendChild(node);
  }, []);
  useEffect(() => place(), [host, place]);
  const attachStage = useCallback(
    (element: HTMLElement | null) => {
      stageRef.current = element;
      place();
      setOnStage(!!element);
    },
    [place]
  );
  const attachMini = useCallback(
    (element: HTMLElement | null) => {
      miniRef.current = element;
      place();
    },
    [place]
  );

  // ------------------------------------------------ 房间画面开不开
  const soloPlaying = !!solo?.href;
  const [closedMini, setClosedMini] = useState(false);
  useEffect(() => {
    if (onStage) setClosedMini(false);
  }, [onStage]);
  useEffect(() => setClosedMini(false), [current?.id]);
  const live = !!current && !soloPlaying && (onStage || !closedMini);

  const command = useCallback(
    async (event: string, payload: Record<string, unknown> = {}) => {
      if (!room || !current) throw new Error('不在房间里');
      return room.roomCommand(event, { ...payload, roomId: current.id });
    },
    [room, current]
  );
  const player = useRoomPlayer({
    container: live ? host : null,
    room: live ? current : null,
    connected: !!room?.isConnected,
    canPlayback: can('playback'),
    commands: { roomCommand: command },
    keyboard: onStage,
  });

  // ------------------------------------------------ 聊天弹幕
  const [danmakuChat, setDanmakuChatState] = useState(true);
  useEffect(() => {
    try {
      setDanmakuChatState(localStorage.getItem(DANMAKU_KEY) !== 'false');
    } catch {
      // 读不到就用默认
    }
  }, []);
  const setDanmakuChat = useCallback((on: boolean) => {
    setDanmakuChatState(on);
    try {
      localStorage.setItem(DANMAKU_KEY, String(on));
    } catch {
      // 存不下也不影响本次
    }
  }, []);
  const { shoot } = player;
  useEffect(() => {
    if (!room) return;
    const self = getAuthInfoFromBrowserCookie()?.username || '';
    return room.subscribeToRoomMessages(({ message }) => {
      if (danmakuChat && message.content)
        shoot(
          message.content,
          (message.accountId || message.userName) === self
        );
    });
  }, [room, danmakuChat, shoot]);

  // ------------------------------------------------ 语音
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [mic, setMic] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  useEffect(() => {
    setVoiceAvailable(
      Boolean(
        (window.RUNTIME_CONFIG as Record<string, unknown> | undefined)
          ?.ENABLE_ROOM_VOICE
      )
    );
  }, []);
  useEffect(() => setMic(false), [current?.id]);
  const voiceState = useVoiceChat({
    socket: room?.socket || null,
    roomId: current?.id || null,
    isMicEnabled: voiceAvailable && mic,
    isSpeakerEnabled: speaker,
    members: room?.members || [],
    enabled: voiceAvailable && !!current,
  });
  const voice = useMemo(
    () => ({
      available: voiceAvailable && !!current,
      mic,
      speaker,
      connecting: voiceState.isConnecting,
      error: voiceState.error,
      toggleMic: () => setMic((value) => !value),
      toggleSpeaker: () => setSpeaker((value) => !value),
    }),
    [
      voiceAvailable,
      current,
      mic,
      speaker,
      voiceState.isConnecting,
      voiceState.error,
    ]
  );

  // ------------------------------------------------ 聊天浮窗
  const [chatOpen, setChatOpen] = useState(false);
  const openChat = useCallback(() => setChatOpen(true), []);
  useEffect(() => {
    if (onStage || !current) setChatOpen(false);
  }, [onStage, current]);

  // ------------------------------------------------ 站内点开影片：先问怎么看
  const [choice, setChoice] = useState<
    (FilmChoice & { onPlayPage: boolean }) | null
  >(null);
  const canQueue = can('addMedia');
  const canPlay = can('changeMedia');
  const setGuard = solo?.setPlaybackGuard;
  // 网站是不是直接从播放页打开的（地址栏、刷新、外部链接），之后有没有在站内换过页
  const firstPath = useRef<string | null>(null);
  const navigated = useRef(false);
  useEffect(() => {
    if (firstPath.current === null) firstPath.current = pathname;
    else if (pathname !== firstPath.current) navigated.current = true;
  }, [pathname]);
  useEffect(() => {
    if (!setGuard) return;
    if (!current) {
      setGuard(null);
      return;
    }
    setGuard((href) => {
      const onPlayPage = window.location.pathname === '/play';
      // 直接打开的播放页照常播放；从站内点进来的才问
      if (onPlayPage && firstPath.current === '/play' && !navigated.current)
        return true;
      const film = filmFromHref(href);
      let title = film?.title || '';
      if (!title) {
        try {
          title =
            new URL(href, 'https://tongmu.invalid').searchParams.get('title') ||
            '这部影片';
        } catch {
          title = '这部影片';
        }
      }
      setChoice({ href, film, title, onPlayPage });
      return false;
    });
    return () => setGuard(null);
  }, [setGuard, current]);

  const unread = current?.unreadCount || 0;
  const online =
    (current?.roster || []).filter((member) => member.online).length ||
    current?.memberCount ||
    0;
  const roomName = current ? displayRoomName(current) : '';
  const status = state
    ? state.isPlaying
      ? '正在放映'
      : state.autoPaused
      ? '等人缓冲'
      : '已暂停'
    : '还没开始放映';
  const offRoomPage = !!current && !onStage && pathname !== '/watch-room';
  const showMini = offRoomPage && live && !!state;

  const value = useMemo<Session>(
    () => ({
      player,
      attachStage,
      danmakuChat,
      setDanmakuChat,
      voice,
      openChat,
    }),
    [player, attachStage, danmakuChat, setDanmakuChat, voice, openChat]
  );

  return (
    <TogetherSessionContext.Provider value={value}>
      {children}
      {showMini && (
        <RoomMini
          roomName={roomName}
          title={state?.videoName || player.detail?.title || '影片'}
          status={status}
          player={player.player}
          canPlayback={can('playback')}
          unread={chatOpen ? 0 : unread}
          slot={attachMini}
          onChat={() => setChatOpen((open) => !open)}
          onClose={() => setClosedMini(true)}
        />
      )}
      {offRoomPage && !showMini && !chatOpen && (
        <RoomPill
          roomName={roomName}
          status={soloPlaying && state ? '房间仍在放映' : status}
          unread={unread}
          onChat={openChat}
        />
      )}
      {offRoomPage && chatOpen && (
        <RoomChatSheet
          roomName={roomName}
          online={online}
          voice={voice}
          onClose={() => setChatOpen(false)}
        />
      )}
      {choice && current && (
        <FilmSheet
          choice={choice}
          roomName={roomName}
          canQueue={canQueue}
          canPlay={canPlay}
          onClose={() => {
            setChoice(null);
            // 已经跳到了空的播放页：不看就回到刚才的页面
            if (choice.onPlayPage) router.back();
          }}
          onQueue={() =>
            choice.film
              ? command('queue:add', queueAdd(choice.film))
              : Promise.resolve()
          }
          onPlay={async () => {
            if (!choice.film) return;
            await command(
              'play:change',
              playChange(choice.film, 1) as unknown as Record<string, unknown>
            );
            setChoice(null);
            router.push('/watch-room');
          }}
          onPick={() => {
            setChoice(null);
            router.push(`/watch-room?pick=${encodeURIComponent(choice.title)}`);
          }}
          onSolo={() => {
            const href = choice.href;
            setChoice(null);
            solo?.requestPlayback(href, 'system');
          }}
        />
      )}
    </TogetherSessionContext.Provider>
  );
}
