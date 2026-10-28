// 观影室相关类型定义

export interface Room {
  id: string;
  name: string;
  description: string;
  hasPassword?: boolean;
  isPublic: boolean;
  roomType: RoomType;
  ownerId: string;
  ownerName: string;
  ownerAccountId?: string;
  controllerAccountId?: string | null;
  controllerSessionId?: string | null;
  controllerEpoch?: number;
  revision?: number;
  leaseExpiresAt?: number | null;
  lifecycle?: 'active' | 'sleeping' | 'archived';
  updatedAt?: number;
  serverTime?: number;
  queue?: RoomQueueItem[];
  settings?: { memberCanQueue: boolean; autoArchive?: boolean };
  lastMessageSeq?: number;
  unreadCount?: number;
  canControl?: boolean;
  members?: Member[];
  memberCount: number;
  currentState: PlayState | LiveState | ScreenState | MusicSyncState | null;
  createdAt: number;
  lastOwnerHeartbeat: number;
}

export type RoomType = 'sync' | 'screen' | 'music';

export interface Member {
  id: string;
  accountId?: string;
  name: string;
  isOwner: boolean;
  isController?: boolean;
  canHost?: boolean;
  ready?: boolean;
  following?: boolean;
  lastHeartbeat: number;
}

export interface PlayState {
  type: 'play';
  queueItemId?: string;
  url: string;
  currentTime: number;
  isPlaying: boolean;
  playbackRate?: number; // 播放倍速，观影室同步类型下由房主同步
  videoId: string;
  videoName: string;
  videoYear?: string;
  searchTitle?: string;
  episode?: number;
  source: string;
  updatedAt?: number;
}

export interface LiveState {
  type: 'live';
  channelId: string;
  channelName: string;
  channelUrl: string;
  updatedAt?: number;
}

export interface ScreenState {
  type: 'screen';
  status: 'idle' | 'sharing';
  ownerName: string;
  hasAudio?: boolean;
  startedAt?: number;
}

export interface MusicQueueItem {
  id: string;
  name: string;
  artist: string;
  album?: string;
  pic?: string;
  platform: string;
  songmid?: string;
  duration?: number;
  durationText?: string;
}

export interface MusicSyncState {
  type: 'music';
  song: MusicQueueItem;
  nextSong: MusicQueueItem | null;
  currentTime: number;
  isPlaying: boolean;
  quality: string;
  playMode: 'loop' | 'single' | 'random';
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  type: 'text' | 'emoji';
  timestamp: number;
  seq?: number;
  accountId?: string;
}

export interface RoomQueueItem {
  id: string;
  title: string;
  href: string;
  source?: string;
  videoId?: string;
  episode?: number;
  addedBy: string;
  addedAt: number;
  playedAt?: number;
}

export interface RoomCommandMeta {
  commandId?: string;
  controllerEpoch?: number;
  baseRevision?: number;
}

export interface RoomCommandResult {
  success: boolean;
  error?: string;
  code?: string;
  revision?: number;
  controllerEpoch?: number;
  duplicate?: boolean;
  unreadCount?: number;
  lastReadSeq?: number;
}

export interface RoomSnapshot {
  room: Room;
  members: Member[];
  messages?: ChatMessage[];
}

export type RoomAck = (
  response: RoomCommandResult & Partial<RoomSnapshot>
) => void;

export interface RoomMemberInfo {
  roomId: string;
  userId: string;
  userName: string;
  isOwner: boolean;
}

// Socket.IO 事件类型
export interface ServerToClientEvents {
  'room:snapshot': (snapshot: RoomSnapshot) => void;
  'room:controller-changed': (state: {
    controllerAccountId: string | null;
    controllerSessionId: string | null;
    controllerEpoch: number;
    revision: number;
    serverTime: number;
  }) => void;
  'room:command-error': (
    error: RoomCommandResult & { event: string; commandId?: string }
  ) => void;
  'room:auth-required': (error: { code: string }) => void;
  'queue:updated': (state: {
    roomId?: string;
    queue: RoomQueueItem[];
    revision: number;
  }) => void;
  'room:created': (room: Room) => void;
  'room:joined': (data: { room: Room; members: Member[] }) => void;
  'room:left': () => void;
  'room:list': (rooms: Room[]) => void;
  'room:member-joined': (member: Member) => void;
  'room:member-left': (userId: string) => void;
  'room:deleted': (data?: { reason?: string }) => void;
  'play:update': (state: PlayState) => void;
  'play:seek': (currentTime: number) => void;
  'play:play': () => void;
  'play:pause': () => void;
  'play:change': (state: PlayState) => void;
  'play:owner-left': () => void;
  'live:change': (state: LiveState) => void;
  'screen:start': (state: ScreenState) => void;
  'screen:stop': () => void;
  'screen:viewer-ready': (data: { userId: string }) => void;
  'screen:offer': (data: {
    userId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  'screen:answer': (data: {
    userId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  'screen:ice': (data: {
    userId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  'music:change': (state: MusicSyncState) => void;
  'music:update': (state: MusicSyncState) => void;
  'music:play': (state: MusicSyncState) => void;
  'music:pause': (state: MusicSyncState) => void;
  'music:seek': (state: MusicSyncState) => void;
  'music:queue': (state: MusicSyncState) => void;
  'chat:message': (message: ChatMessage) => void;
  'voice:offer': (data: {
    userId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  'voice:answer': (data: {
    userId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  'voice:ice': (data: {
    userId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  'voice:mic-enabled': (data: { userId: string }) => void;
  'voice:audio-chunk': (data: {
    userId: string;
    audioData: number[];
    sampleRate?: number;
  }) => void;
  'state:cleared': () => void;
  'heartbeat:pong': (data: { timestamp: number }) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  'room:sync-applied': (
    data: {
      appliedRevision?: number;
      revision?: number;
      controllerEpoch?: number;
    },
    callback?: RoomAck
  ) => void;
  'room:ready': (
    data: { ready?: boolean; appliedRevision?: number; revision?: number },
    callback?: RoomAck
  ) => void;
  'room:following': (data: { following: boolean }, callback?: RoomAck) => void;
  'room:settings': (
    data: {
      name?: string;
      description?: string;
      password?: string;
      isPublic?: boolean;
      memberCanQueue?: boolean;
    } & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'room:authorize-host': (
    data: { accountId: string; canHost: boolean } & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'room:delete': (data: RoomCommandMeta, callback?: RoomAck) => void;
  'room:restore': (data: RoomCommandMeta, callback?: RoomAck) => void;
  'queue:add': (
    data: Omit<RoomQueueItem, 'id' | 'addedBy' | 'addedAt'> & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'queue:remove': (
    data: { id: string } & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'queue:move': (
    data: { id: string; position: number } & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'chat:history': (
    data: {
      roomId?: string;
      afterSeq?: number;
      beforeSeq?: number;
      limit?: number;
    },
    callback: (
      response: RoomCommandResult & {
        messages?: ChatMessage[];
        lastMessageSeq?: number;
        unreadCount?: number;
      }
    ) => void
  ) => void;
  'chat:read': (
    data: { seq: number } & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'activity:change': (
    data: (PlayState | LiveState | ScreenState | MusicSyncState) &
      RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'room:create': (
    data: {
      commandId?: string;
      name: string;
      description: string;
      password?: string;
      isPublic: boolean;
      roomType: RoomType;
      userName: string;
    },
    callback: (response: {
      success: boolean;
      room?: Room;
      members?: Member[];
      messages?: ChatMessage[];
      error?: string;
      code?: string;
    }) => void
  ) => void;

  'room:join': (
    data: {
      roomId: string;
      password?: string;
      userName: string;
    },
    callback: (response: {
      success: boolean;
      room?: Room;
      members?: Member[];
      messages?: ChatMessage[];
      error?: string;
      code?: string;
    }) => void
  ) => void;

  'room:leave': () => void;

  'room:list': (callback: (rooms: Room[]) => void) => void;

  'play:update': (
    state: PlayState & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'play:seek': (
    currentTime: number | ({ currentTime: number } & RoomCommandMeta),
    metaOrAck?: RoomCommandMeta | RoomAck,
    callback?: RoomAck
  ) => void;
  'play:play': (meta?: RoomCommandMeta, callback?: RoomAck) => void;
  'play:pause': (meta?: RoomCommandMeta, callback?: RoomAck) => void;
  'play:change': (
    state: PlayState & RoomCommandMeta,
    callback?: RoomAck
  ) => void;
  'play:owner-leave': () => void;

  'live:change': (state: LiveState) => void;
  'screen:helper-register': (
    data: {
      roomId: string;
    },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
  'screen:start': (state: ScreenState) => void;
  'screen:stop': () => void;
  'screen:viewer-ready': () => void;
  'screen:offer': (data: {
    targetUserId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  'screen:answer': (data: {
    targetUserId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  'screen:ice': (data: {
    targetUserId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  'music:change': (state: MusicSyncState) => void;
  'music:update': (state: MusicSyncState) => void;
  'music:play': (state: MusicSyncState) => void;
  'music:pause': (state: MusicSyncState) => void;
  'music:seek': (state: MusicSyncState) => void;
  'music:queue': (state: MusicSyncState) => void;

  'chat:message': (
    data: { content: string; type: 'text' | 'emoji' } & RoomCommandMeta,
    callback?: RoomAck
  ) => void;

  'voice:offer': (data: {
    targetUserId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  'voice:answer': (data: {
    targetUserId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  'voice:ice': (data: {
    targetUserId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  'voice:audio-chunk': (data: {
    roomId: string;
    audioData: number[];
    sampleRate?: number;
  }) => void;

  'state:clear': (
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  heartbeat: () => void;
}

// 配置类型
export interface WatchRoomConfig {
  enabled: boolean;
  serverType: 'internal' | 'external';
  externalServerUrl?: string;
  externalServerAuth?: string; // 通过 /api/watch-room-auth 接口获取（需要登录）
  externalAppId?: string; // 外部服务器多应用隔离 ID，通过 /api/watch-room-auth 接口获取（需要登录）
}

// LocalStorage 存储的房间信息
export interface StoredRoomInfo {
  roomId: string;
  roomName: string;
  isOwner: boolean;
  userName: string;
  password?: string;
  timestamp: number;
  following?: boolean;
  personalHref?: string | null;
}
