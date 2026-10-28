'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  type WatchRoomSocket,
  watchRoomSocketManager,
} from '@/lib/watch-room-socket';

import { roomActivityKey } from '@/features/playback/room-activity';

import type {
  ChatMessage,
  LiveState,
  Member,
  MusicSyncState,
  PlayState,
  Room,
  RoomType,
  ScreenState,
  StoredRoomInfo,
  WatchRoomConfig,
} from '@/types/watch-room';

const STORAGE_KEY = 'watch_room_info';
class SupersededRoomRequestError extends Error {
  constructor() {
    super('房间已切换，本次操作已取消');
    this.name = 'SupersededRoomRequestError';
  }
}

type Snapshot = { room: Room; members?: Member[]; messages?: ChatMessage[] };
type Reply = Partial<Snapshot> & {
  success: boolean;
  error?: string;
  code?: string;
  revision?: number;
  controllerEpoch?: number;
  unreadCount?: number;
  lastReadSeq?: number;
  messages?: ChatMessage[];
  message?: ChatMessage;
};
export interface RoomNotice {
  id: string;
  message: string;
  timestamp: number;
}

export interface RoomRealtimeMessage {
  roomId: string;
  message: ChatMessage;
}

function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  const unique = new Map(previous.map((message) => [message.id, message]));
  incoming.forEach((message) => unique.set(message.id, message));
  return Array.from(unique.values()).sort(
    (a, b) => (a.seq || a.timestamp) - (b.seq || b.timestamp)
  );
}

export function useWatchRoom(
  onRoomDeleted?: (data?: { reason?: string }) => void,
  onStateCleared?: () => void
) {
  const [socket, setSocket] = useState<WatchRoomSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastError, setLastError] = useState('');
  const [notices, setNotices] = useState<RoomNotice[]>([]);
  const rejoinInFlight = useRef<number | null>(null);
  // 每次重连后成功重新加入就加一：服务端给的是全新会话（ready:false），要让就绪声明重新发一遍
  const [rejoinCount, setRejoinCount] = useState(0);
  const seenMessageIds = useRef(new Set<string>());
  const messageListeners = useRef(
    new Set<(event: RoomRealtimeMessage) => void>()
  );
  const receivedThroughSeq = useRef(0);
  const roomGeneration = useRef(0);
  const connectionGeneration = useRef(0);
  const transitionGeneration = useRef(0);
  const pendingReplayCursor = useRef<number | null>(null);
  const callbacks = useRef({ onRoomDeleted, onStateCleared });
  callbacks.current = { onRoomDeleted, onStateCleared };

  const subscribeToRoomMessages = useCallback(
    (listener: (event: RoomRealtimeMessage) => void) => {
      messageListeners.current.add(listener);
      return () => {
        messageListeners.current.delete(listener);
      };
    },
    []
  );
  const publishRoomMessage = useCallback((message: ChatMessage) => {
    const roomId = roomRef.current?.id;
    if (!roomId) return;
    messageListeners.current.forEach((listener) => {
      try {
        listener({ roomId, message: { ...message } });
      } catch {
        // A display consumer must not interrupt the confirmed chat stream.
      }
    });
  }, []);
  useEffect(() => {
    const listeners = messageListeners.current;
    return () => {
      listeners.clear();
    };
  }, []);

  const addNotice = useCallback(
    (message: string) =>
      setNotices((previous) => [
        ...previous.slice(-19),
        { id: crypto.randomUUID(), message, timestamp: Date.now() },
      ]),
    []
  );
  const applySnapshot = useCallback((snapshot: Snapshot) => {
    const old = roomRef.current;
    if (
      old?.id === snapshot.room.id &&
      (old.revision || 0) > (snapshot.room.revision || 0)
    )
      return;
    if (old?.id !== snapshot.room.id) {
      roomGeneration.current += 1;
      seenMessageIds.current.clear();
      receivedThroughSeq.current = 0;
      pendingReplayCursor.current = null;
    }
    snapshot.messages?.forEach((message) =>
      seenMessageIds.current.add(message.id)
    );
    if (snapshot.messages?.length)
      receivedThroughSeq.current = Math.max(
        receivedThroughSeq.current,
        ...snapshot.messages.map((message) => message.seq || 0)
      );
    roomRef.current = snapshot.room;
    setCurrentRoom(snapshot.room);
    if (snapshot.members) setMembers(snapshot.members);
    if (snapshot.messages)
      setChatMessages((previous) =>
        mergeMessages(
          old?.id === snapshot.room.id ? previous : [],
          snapshot.messages || []
        )
      );
    else if (old?.id !== snapshot.room.id) setChatMessages([]);
  }, []);

  const request = useCallback(
    (event: string, payload?: Record<string, unknown>): Promise<Reply> => {
      const connected = watchRoomSocketManager.getSocket() as Socket | null;
      if (!connected?.connected)
        return Promise.reject(new Error('房间连接中断，请稍后重试'));
      const connection = connectionGeneration.current;
      const generation = roomGeneration.current;
      const roomAtSend = roomRef.current?.id;
      const isTransition = event === 'room:join' || event === 'room:create';
      const transition = isTransition
        ? ++transitionGeneration.current
        : transitionGeneration.current;
      return new Promise((resolve, reject) => {
        connected
          .timeout(8000)
          .emit(event, payload || {}, (timeout: Error | null, reply: Reply) => {
            if (
              connection !== connectionGeneration.current ||
              (isTransition && transition !== transitionGeneration.current) ||
              (!isTransition && generation !== roomGeneration.current)
            ) {
              if (event === 'chat:history')
                resolve({ success: true, messages: [] });
              // 服务端先广播 room:deleted、后回确认：广播会让代际计数 +1，
              // 确认到达时已“过期”。删除命令发出时的房间已经没了，就是成功，不是被取消。
              else if (
                event === 'room:delete' &&
                connection === connectionGeneration.current &&
                roomAtSend &&
                roomRef.current?.id !== roomAtSend
              )
                resolve({ success: true });
              else reject(new SupersededRoomRequestError());
              return;
            }
            if (timeout) {
              reject(new Error('房间操作超时，请检查状态后重试'));
              return;
            }
            if (!reply?.success) {
              reject(
                Object.assign(new Error(reply?.error || '房间操作未成功'), {
                  code: reply?.code,
                })
              );
              return;
            }
            if (
              event === 'chat:message' &&
              reply.message &&
              !seenMessageIds.current.has(reply.message.id)
            ) {
              const confirmed = reply.message;
              seenMessageIds.current.add(confirmed.id);
              receivedThroughSeq.current = Math.max(
                receivedThroughSeq.current,
                confirmed.seq || 0
              );
              setChatMessages((previous) =>
                mergeMessages(previous, [confirmed])
              );
              publishRoomMessage(confirmed);
            }
            if (reply.room) applySnapshot(reply as Snapshot);
            else if (roomRef.current && reply.revision !== undefined) {
              if (reply.revision < (roomRef.current.revision || 0)) {
                resolve(reply);
                return;
              }
              const next = {
                ...roomRef.current,
                revision: reply.revision,
                controllerEpoch:
                  reply.controllerEpoch ?? roomRef.current.controllerEpoch,
                unreadCount: reply.unreadCount ?? roomRef.current.unreadCount,
              };
              roomRef.current = next;
              setCurrentRoom(next);
            }
            resolve(reply);
          });
      });
    },
    [applySnapshot, publishRoomMessage]
  );

  const roomCommand = useCallback(
    async (event: string, payload: Record<string, unknown> = {}) => {
      try {
        const roomId =
          typeof payload.roomId === 'string'
            ? payload.roomId
            : roomRef.current?.id;
        if (roomId !== roomRef.current?.id)
          throw new SupersededRoomRequestError();
        return await request(event, {
          ...payload,
          roomId,
          commandId:
            typeof payload.commandId === 'string'
              ? payload.commandId
              : crypto.randomUUID(),
          controllerEpoch: roomRef.current?.controllerEpoch,
          baseRevision: roomRef.current?.revision,
        });
      } catch (error) {
        if (!(error instanceof SupersededRoomRequestError))
          setLastError(error instanceof Error ? error.message : '房间操作失败');
        throw error;
      }
    },
    [request]
  );
  const send = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      // roomCommand reports real failures; lifecycle cancellation is intentionally silent.
      void roomCommand(event, payload).catch(() => undefined);
    },
    [roomCommand]
  );

  const remember = useCallback((room: Room) => {
    const username = getAuthInfoFromBrowserCookie()?.username || '';
    const viewing = getStoredRoomViewing(room.id);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        roomId: room.id,
        roomName: room.name,
        userName: username,
        isOwner: room.ownerAccountId === username,
        timestamp: Date.now(),
        ...(viewing
          ? { following: viewing.following, personalHref: viewing.personalHref }
          : {}),
      })
    );
  }, []);
  const rejoin = useCallback(async () => {
    const stored = getStoredRoomInfo();
    const connection = connectionGeneration.current;
    if (!stored || rejoinInFlight.current === connection) return;
    const username = getAuthInfoFromBrowserCookie()?.username;
    if (!username || username !== stored.userName) {
      clearStoredRoomInfo();
      return;
    }
    rejoinInFlight.current = connection;
    const resumeAfter =
      roomRef.current?.id === stored.roomId
        ? pendingReplayCursor.current ?? receivedThroughSeq.current
        : 0;
    if (resumeAfter > 0) pendingReplayCursor.current = resumeAfter;
    try {
      const reply = await request('room:join', {
        roomId: stored.roomId,
        userName: username,
      });
      if (reply.room) remember(reply.room);
      if (reply.room && connection === connectionGeneration.current)
        setRejoinCount((count) => count + 1);
      const generation = roomGeneration.current;
      // Replay the full offline gap; the join snapshot contains only the most recent page.
      let cursor = resumeAfter;
      const target = reply.room?.lastMessageSeq || 0;
      while (
        resumeAfter > 0 &&
        cursor < target &&
        roomRef.current?.id === stored.roomId &&
        connection === connectionGeneration.current
      ) {
        const page =
          (
            await request('chat:history', {
              roomId: stored.roomId,
              afterSeq: cursor,
              limit: 100,
            })
          ).messages || [];
        if (
          connection !== connectionGeneration.current ||
          generation !== roomGeneration.current ||
          roomRef.current?.id !== stored.roomId
        )
          break;
        if (!page.length) break;
        page.forEach((message) => seenMessageIds.current.add(message.id));
        setChatMessages((previous) => mergeMessages(previous, page));
        const next = Math.max(...page.map((message) => message.seq || 0));
        if (next <= cursor) break;
        cursor = next;
        pendingReplayCursor.current = cursor;
      }
      if (
        connection === connectionGeneration.current &&
        generation === roomGeneration.current &&
        roomRef.current?.id === stored.roomId &&
        cursor >= target
      )
        pendingReplayCursor.current = null;
    } catch (error) {
      if (
        connection === connectionGeneration.current &&
        !(error instanceof SupersededRoomRequestError)
      )
        setLastError(error instanceof Error ? error.message : '重新加入失败');
    } finally {
      if (rejoinInFlight.current === connection) rejoinInFlight.current = null;
    }
  }, [request, remember]);

  const connect = useCallback(async (config: WatchRoomConfig) => {
    const connection = connectionGeneration.current;
    try {
      const connected = await watchRoomSocketManager.connect(config);
      if (connection !== connectionGeneration.current) {
        connected.disconnect?.();
        return;
      }
      setSocket(connected);
      setIsConnected(connected.connected);
    } catch (error) {
      if (connection === connectionGeneration.current) {
        setIsConnected(false);
        setLastError(error instanceof Error ? error.message : '连接失败');
      }
    }
  }, []);
  const disconnect = useCallback(() => {
    roomGeneration.current += 1;
    connectionGeneration.current += 1;
    transitionGeneration.current += 1;
    rejoinInFlight.current = null;
    pendingReplayCursor.current = null;
    watchRoomSocketManager.disconnect();
    setSocket(null);
    setIsConnected(false);
    roomRef.current = null;
    setCurrentRoom(null);
    setMembers([]);
    setChatMessages([]);
  }, []);

  const createRoom = useCallback(
    async (data: {
      name: string;
      description: string;
      password?: string;
      isPublic: boolean;
      roomType: RoomType;
      userName: string;
    }) => {
      const reply = await request('room:create', data);
      if (!reply.room) throw new Error('创建后未收到房间资料');
      remember(reply.room);
      return reply.room;
    },
    [request, remember]
  );
  const joinRoom = useCallback(
    async (data: { roomId: string; password?: string; userName: string }) => {
      const reply = await request('room:join', {
        roomId: data.roomId,
        password: data.password,
        userName: data.userName,
      });
      if (!reply.room) throw new Error('未收到房间资料');
      remember(reply.room);
      return { room: reply.room, members: reply.members || [] };
    },
    [request, remember]
  );
  const leaveRoom = useCallback(() => {
    roomGeneration.current += 1;
    transitionGeneration.current += 1;
    pendingReplayCursor.current = null;
    const connected = watchRoomSocketManager.getSocket() as Socket | null;
    connected?.emit('room:leave');
    clearStoredRoomInfo();
    roomRef.current = null;
    setCurrentRoom(null);
    setMembers([]);
    setChatMessages([]);
    addNotice('已离开房间，其他成员继续观看');
  }, [addNotice]);
  const getRoomList = useCallback(async (): Promise<Room[]> => {
    const response = await fetch('/api/rooms', { cache: 'no-store' });
    if (!response.ok) throw new Error('无法读取房间列表');
    const result = await response.json();
    return Array.isArray(result) ? result : result.rooms || [];
  }, []);

  const markChatRead = useCallback(
    async (seq: number) => {
      if (!Number.isFinite(seq) || seq < 1) return;
      await roomCommand('chat:read', { seq });
    },
    [roomCommand]
  );
  const loadChatHistory = useCallback(
    async (afterSeq?: number, beforeSeq?: number) => {
      const roomId = roomRef.current?.id;
      if (!roomId) return [];
      const generation = roomGeneration.current;
      const reply = await request('chat:history', {
        roomId,
        afterSeq,
        beforeSeq,
        limit: 50,
      });
      if (
        generation !== roomGeneration.current ||
        roomRef.current?.id !== roomId
      )
        return [];
      if (reply.messages) {
        reply.messages.forEach((message) =>
          seenMessageIds.current.add(message.id)
        );
        setChatMessages((previous) =>
          mergeMessages(previous, reply.messages || [])
        );
      }
      return reply.messages || [];
    },
    [request]
  );

  useEffect(() => {
    if (!socket) return;
    const realtime = socket as Socket;
    const connected = () => {
      setIsConnected(true);
      void rejoin();
    };
    const disconnected = () => {
      connectionGeneration.current += 1;
      rejoinInFlight.current = null;
      setIsConnected(false);
      addNotice('连接暂时中断，正在重连；其他成员继续观看');
    };
    const joined = (data: Snapshot) => applySnapshot(data);
    const deleted = (data?: { reason?: string }) => {
      roomGeneration.current += 1;
      callbacks.current.onRoomDeleted?.(data);
      // 通知全站播放器：正在跟随这个房间的画面该收场了（浏览器内部事件，不是 Socket 事件）
      window.dispatchEvent(
        new CustomEvent('tongmu:room-deleted', {
          detail: { roomId: roomRef.current?.id },
        })
      );
      clearStoredRoomInfo();
      roomRef.current = null;
      setCurrentRoom(null);
      setMembers([]);
      setChatMessages([]);
    };
    const memberJoined = (member: Member) =>
      setMembers((previous) => [
        ...previous.filter((item) => item.id !== member.id),
        member,
      ]);
    const memberLeft = (id: string) =>
      setMembers((previous) => previous.filter((item) => item.id !== id));
    const mediaUpdated = (state: Room['currentState']) => {
      const previous = roomRef.current;
      if (!previous) return;
      if (
        state &&
        previous.currentState &&
        'updatedAt' in state &&
        'updatedAt' in previous.currentState &&
        (state.updatedAt || 0) < (previous.currentState.updatedAt || 0)
      )
        return;
      const next = { ...previous, currentState: state };
      roomRef.current = next;
      setCurrentRoom(next);
    };
    const chatMessage = (message: ChatMessage) => {
      if (!roomRef.current) return;
      if (seenMessageIds.current.has(message.id)) return;
      seenMessageIds.current.add(message.id);
      receivedThroughSeq.current = Math.max(
        receivedThroughSeq.current,
        message.seq || 0
      );
      setChatMessages((previous) => mergeMessages(previous, [message]));
      publishRoomMessage(message);
      const username = getAuthInfoFromBrowserCookie()?.username;
      if (message.accountId !== username && message.userName !== username) {
        const previous = roomRef.current;
        const next = {
          ...previous,
          unreadCount: (previous.unreadCount || 0) + 1,
          lastMessageSeq: Math.max(
            previous.lastMessageSeq || 0,
            message.seq || 0
          ),
        };
        roomRef.current = next;
        setCurrentRoom(next);
      }
    };
    const controllerChanged = (data: {
      controllerAccountId: string | null;
      revision: number;
    }) => {
      if (roomRef.current && data.revision >= (roomRef.current.revision || 0))
        addNotice(
          data.controllerAccountId
            ? '房间主持已更新，影片继续播放'
            : '暂无在线主持，当前影片继续播放'
        );
      // The immediately following full snapshot is the authoritative room state.
    };
    const queueUpdated = (data: {
      roomId?: string;
      queue: Room['queue'];
      revision: number;
    }) => {
      if (
        !roomRef.current ||
        (data.roomId && data.roomId !== roomRef.current.id) ||
        data.revision < (roomRef.current.revision || 0)
      )
        return;
      const next = {
        ...roomRef.current,
        queue: data.queue,
        revision: data.revision,
      };
      roomRef.current = next;
      setCurrentRoom(next);
    };
    const error = (value: string | { message?: string }) =>
      setLastError(
        typeof value === 'string' ? value : value.message || '房间操作失败'
      );
    const clearState = () => {
      mediaUpdated(null);
      callbacks.current.onStateCleared?.();
    };
    const events = [
      ['connect', connected],
      ['disconnect', disconnected],
      ['room:joined', joined],
      ['room:snapshot', joined],
      ['room:controller-changed', controllerChanged],
      ['room:deleted', deleted],
      ['room:member-joined', memberJoined],
      ['room:member-left', memberLeft],
      ['play:update', mediaUpdated],
      ['play:change', mediaUpdated],
      ['live:change', mediaUpdated],
      ['screen:start', mediaUpdated],
      ['music:change', mediaUpdated],
      ['music:update', mediaUpdated],
      ['music:queue', mediaUpdated],
      ['music:play', mediaUpdated],
      ['music:pause', mediaUpdated],
      ['music:seek', mediaUpdated],
      ['chat:message', chatMessage],
      ['queue:updated', queueUpdated],
      ['state:cleared', clearState],
      ['screen:stop', clearState],
      ['error', error],
    ] as const;
    events.forEach(([event, handler]) => realtime.on(event, handler));
    if (realtime.connected) void rejoin();
    return () =>
      events.forEach(([event, handler]) => realtime.off(event, handler));
  }, [socket, rejoin, applySnapshot, addNotice, publishRoomMessage]);

  // 房间页本身就是这个设备的“就绪”依据，只在没有电影实例可等的时候：
  // 空房间要有就绪的主持才能选第一部电影；直播/音乐/共享房间在整页刷新后，
  // 这个设备没有电影可加载，不声明就永远选不出主持，片单里的“播放”也就没了。
  // 电影活动仍由播放器在视频真正可播后再声明；“仅自己看”的设备服务端会拒绝，不发。
  const watchingAlone =
    members.find((member) => member.id === socket?.id)?.following === false;
  const activityReadyKey = currentRoom ? roomActivityKey(currentRoom) : '';
  useEffect(() => {
    const idleRoom = roomRef.current;
    if (!socket?.connected || !idleRoom || watchingAlone) return;
    if (idleRoom.currentState?.type === 'play') return;
    const realtime = socket as Socket;
    realtime.emit('room:sync-applied', {
      appliedRevision: idleRoom.revision,
      controllerEpoch: idleRoom.controllerEpoch,
    });
    realtime.emit('room:ready', {
      ready: true,
      appliedRevision: idleRoom.revision,
    });
  }, [socket, currentRoom?.id, activityReadyKey, watchingAlone, rejoinCount]);

  const self = members.find((member) => member.id === socket?.id);
  const username =
    typeof window === 'undefined'
      ? undefined
      : getAuthInfoFromBrowserCookie()?.username;
  const isOwner = Boolean(
    currentRoom && (self?.isOwner || currentRoom.ownerAccountId === username)
  );
  const isController = Boolean(
    currentRoom && currentRoom.controllerSessionId === socket?.id
  );
  const sendChatMessage = useCallback(
    (content: string, type: 'text' | 'emoji' = 'text') =>
      send('chat:message', { content, type }),
    [send]
  );
  return {
    socket,
    isConnected,
    rejoinCount,
    currentRoom,
    members,
    chatMessages,
    isOwner,
    isController,
    canControl: isController,
    lastError,
    clearError: useCallback(() => setLastError(''), []),
    notices,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    getRoomList,
    sendChatMessage,
    subscribeToRoomMessages,
    roomCommand,
    markChatRead,
    loadChatHistory,
    updatePlayState: useCallback(
      (state: PlayState) => send('play:update', { ...state }),
      [send]
    ),
    seekPlayback: useCallback(
      (currentTime: number) => send('play:seek', { currentTime }),
      [send]
    ),
    play: useCallback(() => send('play:play'), [send]),
    pause: useCallback(() => send('play:pause'), [send]),
    changeVideo: useCallback(
      (state: PlayState) => send('play:change', { ...state }),
      [send]
    ),
    changeLiveChannel: useCallback(
      (state: LiveState) => send('live:change', { ...state }),
      [send]
    ),
    startScreenShare: useCallback(
      (state: ScreenState) => send('screen:start', { ...state }),
      [send]
    ),
    stopScreenShare: useCallback(() => send('screen:stop'), [send]),
    changeMusic: useCallback(
      (state: MusicSyncState) => send('music:change', { ...state }),
      [send]
    ),
    updateMusicState: useCallback(
      (state: MusicSyncState) => send('music:update', { ...state }),
      [send]
    ),
    updateMusicQueue: useCallback(
      (state: MusicSyncState) => send('music:queue', { ...state }),
      [send]
    ),
    playMusic: useCallback(
      (state: MusicSyncState) => send('music:play', { ...state }),
      [send]
    ),
    pauseMusic: useCallback(
      (state: MusicSyncState) => send('music:pause', { ...state }),
      [send]
    ),
    seekMusic: useCallback(
      (state: MusicSyncState) => send('music:seek', { ...state }),
      [send]
    ),
    clearRoomState: useCallback(() => send('state:clear'), [send]),
  };
}

export function getStoredRoomInfo(): StoredRoomInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredRoomInfo;
    if (
      !value.roomId ||
      !value.userName ||
      Date.now() - value.timestamp > 30 * 86400000
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function getStoredRoomViewing(roomId?: string): StoredRoomInfo | null {
  const stored = getStoredRoomInfo();
  const username = getAuthInfoFromBrowserCookie()?.username;
  if (
    !stored ||
    stored.userName !== username ||
    (roomId && stored.roomId !== roomId)
  )
    return null;
  return stored;
}

export function saveRoomViewingPreference(
  roomId: string | undefined,
  following: boolean,
  personalHref: string | null = null
) {
  const stored = getStoredRoomViewing(roomId);
  if (!stored) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...stored, following, personalHref })
    );
  } catch {
    // Storage may be unavailable; the current session still keeps its mode.
  }
}
function clearStoredRoomInfo() {
  localStorage.removeItem(STORAGE_KEY);
}
