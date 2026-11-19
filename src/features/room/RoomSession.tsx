'use client';

/*
 * 一起看的全站会话（挂在根布局，换页不卸载）：
 * - 房间播放器只有一个实例。它的画面节点在“房间页画面位置 / 小窗 / 暂存区”之间移动，
 *   离开房间页后在小窗里继续同步，回来时不重新加载；
 * - 人在房间里时，站内点开一部影片先问怎么看（加入片单 / 在房间里放 / 自己看）；
 * - 语音、聊天弹幕开关、房间提示。
 * 自己看（src/features/playback）不认识这里；这里只读它的“是否在放”和拦截挂点。
 */

import './room.css';
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
import { useAudioFocus } from '@/hooks/useAudioFocus';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/hooks/usePlaybackSession';
import { useVoiceChat } from '@/features/room/hooks/useVoiceChat';

import { filmFromHref, playChange, queueAdd } from './lib/commands';
import { displayRoomName } from './lib/room-presentation';
import { useRoomPlayer } from './player/useRoomPlayer';
import { RoomSession as Session, RoomSessionContext } from './session/context';
import FilmSheet, { FilmChoice } from './session/FilmSheet';
import { RoomChatSheet, RoomPill } from './session/RoomDock';
import RoomMini from './session/RoomMini';

import type { PlayState, RoomPermission } from '@/types/watch-room';

const DANMAKU_KEY = 'tm-together-chat-danmaku';

export default function RoomSession({ children }: { children: ReactNode }) {
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
    parking.className = 'tm-room-player-park';
    parking.setAttribute('aria-hidden', 'true');
    const element = document.createElement('div');
    element.className = 'tm-room-player-host';
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
  const soloHref = useRef(solo?.href || null);
  soloHref.current = solo?.href || null;
  const [closedMini, setClosedMini] = useState(false);
  useEffect(() => {
    if (onStage) setClosedMini(false);
  }, [onStage]);
  useEffect(() => setClosedMini(false), [current?.id]);
  // 共享屏幕、一起听等房间活动页有自己的画面和声音，房间影片在这些页面先停
  const onActivityPage = pathname.startsWith('/watch-room/');
  const live =
    !!current && !soloPlaying && !onActivityPage && (onStage || !closedMini);

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
    canChangeMedia: can('changeMedia'),
    commands: { roomCommand: command },
    keyboard: onStage,
  });

  // 房间画面也遵守“同一时刻只有一个出声”：TV、直播、音乐在放时，
  // 房间影片照常同步但静音；用户在房间画面上按播放或打开声音就拿回声音
  const [roomVideo, setRoomVideo] = useState<HTMLVideoElement | null>(null);
  const roomPlayer = player.player;
  useEffect(() => {
    if (!roomPlayer) {
      setRoomVideo(null);
      return;
    }
    const sync = () => setRoomVideo(roomPlayer.video);
    sync();
    return roomPlayer.on('ready', sync);
  }, [roomPlayer]);
  const roomSound = useAudioFocus(roomVideo, false);

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
  const { shoot, chat } = player;
  const canChat =
    (can('chat') && current?.settings?.chatEnabled !== false) ||
    can('manageMembers');
  // 播放器控制条里的“弹”开关和发弹幕输入框（全屏时也在）
  useEffect(() => {
    chat.configure({
      enabled: danmakuChat,
      canSend: canChat && !!room?.isConnected,
      send: (text) =>
        command('chat:message', {
          content: text,
          type: 'text',
          commandId: crypto.randomUUID(),
        }),
      onToggle: setDanmakuChat,
    });
  }, [chat, danmakuChat, canChat, room?.isConnected, command, setDanmakuChat]);
  useEffect(() => {
    if (!room) return;
    const self = getAuthInfoFromBrowserCookie()?.username || '';
    return room.subscribeToRoomMessages(({ message }) => {
      if (danmakuChat && message.content)
        shoot(
          message.content,
          (message.accountId || message.userName) === self,
          message.userName
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
  const canSpeak = voiceAvailable && can('voice');
  useEffect(() => setMic(false), [current?.id]);
  // 房主收回语音发言权限时立刻关麦
  useEffect(() => {
    if (!canSpeak) setMic(false);
  }, [canSpeak]);
  const voiceState = useVoiceChat({
    socket: room?.socket || null,
    roomId: current?.id || null,
    isMicEnabled: canSpeak && mic,
    isSpeakerEnabled: speaker,
    members: room?.members || [],
    enabled: voiceAvailable && !!current,
  });
  const voice = useMemo(
    () => ({
      available: voiceAvailable && !!current,
      canSpeak: canSpeak && !!current,
      mic: canSpeak && mic,
      speaker,
      connecting: voiceState.isConnecting,
      error: voiceState.error,
      toggleMic: () => setMic((value) => !value),
      toggleSpeaker: () => setSpeaker((value) => !value),
    }),
    [
      voiceAvailable,
      canSpeak,
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
      // 自己正在看的就是这一部（例如从小窗点“回到播放页”）：直接显示，不再问怎么看
      const watching = soloHref.current ? filmFromHref(soloHref.current) : null;
      if (
        film &&
        watching &&
        film.source === watching.source &&
        film.videoId === watching.videoId
      )
        return true;
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
  // 房间自己的页面（房间页，以及共享屏幕、一起听等房间活动页）不出小窗和房间入口：
  // 那里本来就在房间里，小窗只会盖住页面上的按钮
  const offRoomPage =
    !!current && !onStage && !pathname.startsWith('/watch-room');
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
    <RoomSessionContext.Provider value={value}>
      {children}
      {showMini && (
        <RoomMini
          roomName={roomName}
          title={state?.videoName || player.detail?.title || '影片'}
          status={status}
          player={player.player}
          canPlayback={can('playback')}
          roomPlaying={!!state?.isPlaying}
          soundBlocked={!roomSound.ownsSound}
          onClaimSound={roomSound.claimSound}
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
    </RoomSessionContext.Provider>
  );
}
