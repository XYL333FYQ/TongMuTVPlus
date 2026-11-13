'use strict';

/*
 * 一起看房间服务（参照 SyncTV 的模型重写）。
 *
 * 旧实现是“唯一主持设备”模型：服务器要在在线设备里选出一个主持（就绪、跟随、
 * 租约、代次、房主回来等 5 秒再收回……），只有这台设备的播放器事件才会被采纳。
 * 任何一环没跟上，全房间就“暂无主持”、成员点暂停会被强行恢复播放。
 *
 * 现在与 SyncTV 一致：
 * - 权限按账号算：房主、被授权的管理员，以及房间开启“成员可控制播放”（默认开启）
 *   时的所有成员，都可以直接播放 / 暂停 / 拖动 / 倍速 / 换片。
 * - 服务器只保存一份播放状态：{ currentTime, isPlaying, playbackRate, updatedAt,
 *   version }。任何人操作后立即广播；各端按服务器时钟推算当前位置并自行纠偏。
 * - 后到的命令覆盖先到的（last writer wins），不再因为“房间版本已变化”拒绝操作。
 */

const crypto = require('node:crypto');

const DEFAULTS = Object.freeze({
  maxOwnedRooms: 3,
  // 以下两个保留为可配置项以兼容旧环境变量；新模型不再选举主持。
  reconnectGraceMs: 30000,
  ownerReadyMs: 5000,
  leaseMs: 90000,
  emptyPauseMs: 60000,
  sleepMs: 600000,
  archiveMs: 30 * 86400000,
  purgeMs: 7 * 86400000,
  maxMembers: 8,
  maxQueue: 200,
  chatRetentionMs: 30 * 86400000,
});
function fail(code, message, status = 400) {
  throw Object.assign(new Error(message), { code, status });
}
function text(value, max, required = false) {
  if (typeof value !== 'string') {
    if (required) fail('INVALID_INPUT', '缺少必填文字');
    return '';
  }
  const result = value.trim();
  if (result.length > max || (required && !result))
    fail('INVALID_INPUT', '文字长度不符合要求');
  return result;
}
function number(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0 || value > max)
    fail('INVALID_INPUT', '数值不符合要求');
  return value;
}
function url(value) {
  if (!value) return '';
  const candidate = text(value, 8192, true);
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    fail('INVALID_MEDIA', '媒体地址无效');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    fail('INVALID_MEDIA', '媒体地址必须使用 HTTP 或 HTTPS，且不能包含账号密码');
  return candidate;
}
function safeUrl(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return url(value);
  } catch {
    return '';
  }
}
const COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_COVER_BYTES = 200 * 1024;
/** data:image/...;base64,... -> { mime, data }，只接受常见图片格式和有限大小。 */
function coverImage(value) {
  if (typeof value !== 'string') fail('INVALID_INPUT', '封面图片无效');
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || !COVER_TYPES.has(match[1]))
    fail('INVALID_INPUT', '封面只支持 JPG、PNG 或 WebP 图片');
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > MAX_COVER_BYTES)
    fail('INVALID_INPUT', '封面图片太大，请换一张小一点的图片');
  return { mime: match[1], data };
}
function passwordHash(password) {
  if (!password) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}
function passwordMatches(password, stored) {
  if (!stored) return true;
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, hash] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
function song(item) {
  if (!item || typeof item !== 'object') fail('INVALID_MEDIA', '歌曲信息无效');
  return {
    id: text(String(item.id || ''), 240, true),
    name: text(item.name, 240, true),
    artist: text(item.artist, 240),
    album: text(item.album, 240),
    pic: url(item.pic),
    platform: text(item.platform, 80, true),
    songmid: text(item.songmid, 240),
    duration: number(item.duration, 0, 86400),
    durationText: text(item.durationText, 30),
  };
}
function rate(value, fallback = 1) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0.1 || value > 16)
    fail('INVALID_INPUT', '倍速不符合要求');
  return value;
}
function mediaState(input, now, previous = null) {
  if (!input || typeof input !== 'object')
    fail('INVALID_MEDIA', '播放状态无效');
  const common = { updatedAt: now };
  if (input.type === 'play')
    return {
      ...common,
      type: 'play',
      ...(input.queueItemId
        ? { queueItemId: text(input.queueItemId, 128, true) }
        : {}),
      url: url(input.url),
      videoId: text(String(input.videoId || ''), 8192, true),
      videoName: text(input.videoName, 240),
      videoYear: text(input.videoYear, 30),
      // 海报只用于房间卡片在没有自定义封面时展示，地址无效就忽略，不影响播放
      poster: safeUrl(input.poster),
      searchTitle: text(input.searchTitle, 240),
      source: text(input.source, 240, true),
      episode: number(input.episode, 1, 100000) || 1,
      currentTime: number(input.currentTime, 0, 30 * 86400),
      isPlaying: !!input.isPlaying,
      playbackRate: rate(input.playbackRate, 1),
    };
  if (input.type === 'live')
    return {
      ...common,
      type: 'live',
      channelId: text(input.channelId, 240, true),
      channelName: text(input.channelName, 240),
      channelUrl: url(input.channelUrl),
    };
  if (input.type === 'music')
    return {
      ...common,
      type: 'music',
      song: song(input.song),
      nextSong: input.nextSong ? song(input.nextSong) : null,
      currentTime: number(input.currentTime, 0, 86400),
      isPlaying: !!input.isPlaying,
      quality: text(input.quality, 40) || 'standard',
      playMode: ['loop', 'single', 'random'].includes(input.playMode)
        ? input.playMode
        : 'loop',
    };
  if (input.type === 'screen')
    return {
      ...common,
      type: 'screen',
      status: input.status === 'sharing' ? 'sharing' : 'idle',
      ownerName: previous?.ownerName || '',
      hasAudio: !!input.hasAudio,
      startedAt: now,
    };
  fail('INVALID_MEDIA', '不支持的活动类型');
}
/** 按服务器时钟推算“此刻”的播放位置。 */
function projected(state, now) {
  if (!state) return null;
  const result = { ...state };
  if ((state.type === 'play' || state.type === 'music') && state.isPlaying)
    result.currentTime +=
      (Math.max(0, now - (state.updatedAt || now)) / 1000) *
      (state.playbackRate || 1);
  result.updatedAt = now;
  return result;
}
function queueItem(data, accountId, now) {
  const href = text(data.href, 16384, true);
  // 待看片单只放影片：播放页打不开直播/音乐入口，放进来只会卡住“开始播放”
  if (!/^\/play(\?|$)/.test(href))
    fail('INVALID_MEDIA', '队列只接受站内播放入口');
  return {
    id: crypto.randomUUID(),
    title: text(data.title, 240, true),
    href,
    source: text(data.source, 240),
    videoId: text(String(data.videoId || ''), 8192),
    episode: number(data.episode, 1, 100000) || 1,
    ...(data.poster ? { poster: url(data.poster) } : {}),
    addedBy: accountId,
    addedAt: now,
  };
}
function fromEnv(env = process.env) {
  const config = {};
  for (const [key, suffix] of Object.entries({
    maxOwnedRooms: 'MAX_OWNED',
    reconnectGraceMs: 'RECONNECT_GRACE_MS',
    ownerReadyMs: 'OWNER_READY_MS',
    leaseMs: 'LEASE_MS',
    emptyPauseMs: 'EMPTY_PAUSE_MS',
    sleepMs: 'SLEEP_MS',
    archiveMs: 'ARCHIVE_MS',
    purgeMs: 'PURGE_MS',
    maxMembers: 'MAX_MEMBERS',
    maxQueue: 'MAX_QUEUE',
    chatRetentionMs: 'CHAT_RETENTION_MS',
  })) {
    const value = env[`ROOM_${suffix}`];
    if (value !== undefined && /^\d+$/.test(value)) config[key] = Number(value);
  }
  return config;
}
const mediaKey = (state) =>
  state && state.type === 'play'
    ? `${state.source}\u0000${state.videoId}\u0000${state.episode || 1}`
    : '';

// 只改播放进度、不改房间结构的命令：不递增房间 revision，不广播完整快照，
// 也不写入命令去重表（重复执行结果相同，没必要占库）。
const TRANSPORT_EVENTS = new Set([
  'play:play',
  'play:pause',
  'play:seek',
  'play:rate',
  'play:update',
  'music:update',
  'music:play',
  'music:pause',
  'music:seek',
]);
const PLAYBACK_EVENTS = new Set([
  ...TRANSPORT_EVENTS,
  'play:change',
  'live:change',
  'music:change',
  'music:queue',
  'screen:start',
  'screen:stop',
  'state:clear',
  'activity:change',
]);

class RoomService {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now || Date.now;
    this.config = { ...DEFAULTS, ...fromEnv(), ...options.config };
    this.emit = options.emit || (() => {});
    this.runtime = new Map();
    this.sessions = new Map();
    this.rate = new Map();
    // 进程重启：所有人都已断开，房间停在最后记录的位置（暂停），屏幕共享结束。
    // 不按停机时长推算进度：崩溃或强制结束时停机多久未知，正常关闭时
    // shutdown() 已经把位置推算并暂停好了。
    for (const id of store.allIds()) {
      const room = store.get(id);
      room.emptySince = room.emptySince ?? this.now();
      if (room.currentState?.type === 'screen') room.currentState = null;
      else if (room.currentState?.isPlaying)
        room.currentState = {
          ...room.currentState,
          isPlaying: false,
          updatedAt: this.now(),
          version: (Number(room.currentState.version) || 0) + 1,
        };
      store.save(room);
    }
  }
  getRoom(id, allowArchived = false) {
    const room = this.store.get(text(id, 64, true));
    if (!room || (!allowArchived && room.lifecycle === 'archived'))
      fail('ROOM_NOT_FOUND', '房间不存在或已归档', 404);
    return room;
  }
  rt(id) {
    if (!this.runtime.has(id))
      this.runtime.set(id, { lastActiveAt: this.now(), stateVersion: 0 });
    return this.runtime.get(id);
  }
  /** 是否允许该账号控制播放（SyncTV 的“设置当前播放状态”权限）。 */
  canControl(room, accountId) {
    if (!accountId) return false;
    if (room.ownerAccountId === accountId) return true;
    const membership = this.store.membership(room.id, accountId);
    if (!membership) return false;
    if (membership.can_host) return true;
    return room.settings?.memberCanControl !== false;
  }
  members(id) {
    const room = this.getRoom(id, true);
    return [...this.sessions.values()]
      .filter((session) => session.roomId === id)
      .map((session) => {
        const member = this.store.membership(id, session.accountId);
        const isOwner = room.ownerAccountId === session.accountId;
        return {
          id: session.id,
          accountId: session.accountId,
          name: session.accountId,
          isOwner,
          isController: false,
          canHost: !!member?.can_host || isOwner,
          canControl: this.canControl(room, session.accountId),
          ready: session.ready,
          following: session.following !== false,
          lastHeartbeat: session.lastSeen,
        };
      });
  }
  summary(room, accountId) {
    const own = room.ownerAccountId === accountId;
    const playing =
      room.currentState?.type === 'play'
        ? {
            title: room.currentState.videoName,
            episode: room.currentState.episode || 1,
            isPlaying: !!room.currentState.isPlaying,
            poster: room.currentState.poster || '',
          }
        : null;
    // 封面显示顺序：房主上传的封面 > 正在放映影片的海报 > 前端占位
    const coverVersion = room.settings?.coverVersion;
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      isPublic: room.isPublic,
      hasPassword: !!room.passwordHash,
      roomType: room.roomType,
      ownerAccountId: room.ownerAccountId,
      ownerName: room.ownerAccountId,
      memberCount: new Set(
        [...this.sessions.values()]
          .filter((session) => session.roomId === room.id)
          .map((session) => session.accountId)
      ).size,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      lifecycle: room.lifecycle,
      revision: room.revision,
      isMine: own,
      nowPlaying: playing,
      coverUrl: coverVersion
        ? `/api/rooms/${encodeURIComponent(room.id)}/cover?v=${coverVersion}`
        : null,
    };
  }
  snapshot(room, accountId, sessionId = null) {
    const members = this.members(room.id);
    const ownerSession = members.find((member) => member.isOwner);
    return {
      ...this.summary(room, accountId),
      ownerId: ownerSession?.id || room.ownerAccountId,
      // 兼容旧客户端字段：新模型没有“唯一主持设备”。
      controllerAccountId: null,
      controllerSessionId: null,
      controllerEpoch: room.controllerEpoch,
      leaseExpiresAt: null,
      currentState: projected(room.currentState, this.now()),
      queue: room.queue,
      settings: {
        memberCanQueue: room.settings?.memberCanQueue !== false,
        memberCanControl: room.settings?.memberCanControl !== false,
        autoArchive: room.settings?.autoArchive !== false,
      },
      lastOwnerHeartbeat: ownerSession?.lastHeartbeat || 0,
      lastMessageSeq: this.store.lastSeq(room.id),
      unreadCount: this.store.unread(room.id, accountId),
      members,
      serverTime: this.now(),
      canControl: this.canControl(room, accountId),
    };
  }
  list(identity, mode = 'all') {
    return this.store
      .allIds()
      .map((id) => this.store.get(id))
      .filter((room) => {
        const mine =
          room.ownerAccountId === identity.accountId ||
          !!this.store.membership(room.id, identity.accountId);
        if (mode === 'archived')
          return (
            room.lifecycle === 'archived' &&
            room.ownerAccountId === identity.accountId
          );
        if (room.lifecycle === 'archived') return false;
        if (mode === 'mine') return mine;
        if (mode === 'public') return room.isPublic;
        return room.isPublic || mine;
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((room) => this.summary(room, identity.accountId));
  }
  touch(room) {
    room.revision += 1;
    room.updatedAt = this.now();
    this.store.save(room);
    this.rt(room.id).lastActiveAt = this.now();
  }
  broadcastSnapshot(id) {
    const room = this.getRoom(id, true);
    for (const session of this.sessions.values())
      if (session.roomId === id) {
        const snapshot = this.snapshot(room, session.accountId, session.id);
        this.emit(
          session.id,
          'room:snapshot',
          { room: snapshot, members: snapshot.members },
          true
        );
      }
  }
  create(identity, data = {}) {
    const now = this.now();
    if (!data || typeof data !== 'object' || Array.isArray(data))
      fail('INVALID_INPUT', '房间资料无效');
    const commandId =
      data.commandId === undefined ? null : text(data.commandId, 128, true);
    if (commandId) {
      const previous = this.store.creation(identity.accountId, commandId);
      if (previous)
        return this.snapshot(this.getRoom(previous, true), identity.accountId);
    }
    if (this.store.countOwned(identity.accountId) >= this.config.maxOwnedRooms)
      fail('ROOM_LIMIT', `最多创建 ${this.config.maxOwnedRooms} 个房间`, 409);
    const password = text(data.password, 128);
    const room = {
      id: crypto.randomBytes(6).toString('hex').toUpperCase(),
      ownerAccountId: identity.accountId,
      name: text(data.name, 80, true),
      description: text(data.description, 500),
      passwordHash: passwordHash(password),
      isPublic: data.isPublic === true,
      roomType: ['sync', 'music', 'screen'].includes(data.roomType)
        ? data.roomType
        : 'sync',
      settings: {
        memberCanQueue: data.settings?.memberCanQueue !== false,
        memberCanControl: data.settings?.memberCanControl !== false,
        autoArchive: true,
      },
      currentState: null,
      queue: [],
      revision: 1,
      controllerEpoch: 1,
      createdAt: now,
      updatedAt: now,
      emptySince: now,
      lifecycle: 'active',
      archivedAt: null,
    };
    this.store.db.transaction(() => {
      this.store.save(room);
      this.store.addMember(room.id, identity.accountId, true, now);
      if (commandId)
        this.store.rememberCreation(identity.accountId, commandId, room.id);
    })();
    return this.snapshot(room, identity.accountId);
  }
  read(identity, id) {
    const room = this.getRoom(id);
    if (!this.store.membership(id, identity.accountId))
      fail('FORBIDDEN', '请先加入房间', 403);
    return this.snapshot(room, identity.accountId);
  }
  /** 公开房间的封面谁都能看；私密房间只给成员看。 */
  readCover(identity, id) {
    const room = this.getRoom(id);
    if (
      !room.isPublic &&
      !(identity?.accountId && this.store.membership(id, identity.accountId))
    )
      fail('FORBIDDEN', '请先加入房间', 403);
    const cover = this.store.cover(id);
    if (!cover) fail('NOT_FOUND', '房间没有自定义封面', 404);
    return cover;
  }
  join(identity, id, data = {}, sessionId) {
    const room = this.getRoom(id);
    const known = this.store.membership(id, identity.accountId);
    // 需要校验密码时限流：每个账号每分钟最多试 10 次，防止暴力猜房间密码，
    // 也避免大量同步 scrypt 计算卡住整个服务
    if (!known && room.passwordHash)
      this.limit(`${identity.accountId}:join-password`, 10, 60000);
    if (!known && !passwordMatches(data.password, room.passwordHash))
      fail(
        data.password ? 'WRONG_PASSWORD' : 'PASSWORD_REQUIRED',
        data.password ? '房间密码错误' : '这个房间需要密码',
        403
      );
    // 人数上限按账号算：同一账号多开标签页不多占名额
    const accounts = new Set(
      [...this.sessions.values()]
        .filter((session) => session.roomId === id && session.id !== sessionId)
        .map((session) => session.accountId)
    );
    if (
      sessionId &&
      !accounts.has(identity.accountId) &&
      accounts.size >= this.config.maxMembers
    )
      fail('ROOM_FULL', '房间人数已满', 409);
    this.store.addMember(
      id,
      identity.accountId,
      identity.accountId === room.ownerAccountId,
      this.now()
    );
    if (sessionId) {
      const previous = this.sessions.get(sessionId);
      if (previous && previous.roomId !== id) this.leave(sessionId, true);
      this.sessions.set(sessionId, {
        id: sessionId,
        accountId: identity.accountId,
        identity,
        roomId: id,
        joinedAt: previous?.roomId === id ? previous.joinedAt : this.now(),
        lastSeen: this.now(),
        ready: false,
        following: previous?.roomId === id ? previous.following : true,
      });
      this.rt(id).lastActiveAt = this.now();
      room.emptySince = null;
      if (room.lifecycle === 'sleeping') room.lifecycle = 'active';
      this.store.save(room);
      if (previous?.roomId !== id)
        this.emit(
          id,
          'room:member-joined',
          this.members(id).find((member) => member.id === sessionId),
          false,
          sessionId
        );
    }
    this.broadcastSnapshot(id);
    return this.snapshot(this.getRoom(id), identity.accountId, sessionId);
  }
  leave(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    const room = this.store.get(session.roomId);
    if (!room) return;
    this.emit(room.id, 'room:member-left', sessionId);
    if (
      ![...this.sessions.values()].some(
        (other) => other.roomId === session.roomId
      )
    ) {
      room.emptySince = this.now();
      this.store.save(room);
    }
    this.broadcastSnapshot(room.id);
  }
  requireSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) fail('NOT_IN_ROOM', '尚未加入房间', 403);
    return session;
  }
  heartbeat(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) session.lastSeen = this.now();
  }
  /** 旧客户端的“就绪声明”：新模型不依赖它，只记录状态。 */
  ready(sessionId, data = {}) {
    const session = this.requireSession(sessionId);
    session.ready = data.ready !== false;
    this.heartbeat(sessionId);
    return this.snapshot(
      this.getRoom(session.roomId),
      session.accountId,
      sessionId
    );
  }
  syncApplied(sessionId) {
    const session = this.requireSession(sessionId);
    return this.snapshot(
      this.getRoom(session.roomId),
      session.accountId,
      sessionId
    );
  }
  /**
   * 旧客户端的“个人观看”开关。新模型（参考 SyncTV）里人在房间就跟着房间，
   * 这个事件只为兼容保留，不再改变任何状态。
   */
  following(sessionId) {
    const session = this.requireSession(sessionId);
    return this.snapshot(
      this.getRoom(session.roomId),
      session.accountId,
      sessionId
    );
  }
  tickRoom(id) {
    const room = this.getRoom(id, true);
    const now = this.now();
    if (room.lifecycle === 'archived') return;
    const online = [...this.sessions.values()].some(
      (session) => session.roomId === id
    );
    if (online || room.emptySince === null) return;
    const idle = now - room.emptySince;
    if (
      idle >= this.config.emptyPauseMs &&
      room.currentState &&
      (room.currentState.type === 'screen' || room.currentState.isPlaying)
    ) {
      const state = projected(room.currentState, now);
      room.currentState =
        state.type === 'screen' ? null : { ...state, isPlaying: false };
      this.store.save(room);
    }
    if (room.settings.autoArchive !== false && idle >= this.config.archiveMs) {
      room.lifecycle = 'archived';
      room.archivedAt = now;
      this.store.save(room);
      this.runtime.delete(id);
    } else if (idle >= this.config.sleepMs && room.lifecycle !== 'sleeping') {
      room.lifecycle = 'sleeping';
      this.store.save(room);
      this.runtime.delete(id);
    }
  }
  tick() {
    const now = this.now();
    for (const session of [...this.sessions.values()])
      if (now - session.lastSeen > this.config.leaseMs) this.leave(session.id);
    for (const id of this.store.allIds()) {
      const room = this.store.get(id);
      if (room.lifecycle === 'archived') {
        if (
          room.archivedAt !== null &&
          now - room.archivedAt >= this.config.purgeMs
        ) {
          this.store.remove(id);
          this.runtime.delete(id);
        }
      } else this.tickRoom(id);
    }
    this.store.purgeCommands(now - 7 * 86400000);
    if (this.config.chatRetentionMs > 0)
      this.store.purgeMessages(now - this.config.chatRetentionMs);
    for (const [key, value] of this.rate)
      if (now - value.start > 60000) this.rate.delete(key);
  }
  requireOwner(identity, room) {
    if (room.ownerAccountId !== identity.accountId)
      fail('FORBIDDEN', '仅房主可管理房间', 403);
  }
  requireAdmin(identity, room) {
    if (
      room.ownerAccountId !== identity.accountId &&
      !this.store.membership(room.id, identity.accountId)?.can_host
    )
      fail('FORBIDDEN', '仅房主或房间管理员可以这样做', 403);
  }
  requireControl(identity, room) {
    if (!this.canControl(room, identity.accountId))
      fail('NO_CONTROL_PERMISSION', '房主没有开放成员控制播放', 403);
  }
  execute(identity, id, event, data = {}, meta = {}, sessionId) {
    const room = this.getRoom(id, event === 'room:restore');
    const membership = this.store.membership(id, identity.accountId);
    if (!membership) fail('FORBIDDEN', '请先加入房间', 403);
    if (data && data.roomId !== undefined && data.roomId !== id)
      fail('ROOM_CHANGED', '目标房间已切换，请重新选择操作', 409);
    const transport = TRANSPORT_EVENTS.has(event);
    const commandId = meta.commandId || data?.commandId;
    if (commandId !== undefined) text(commandId, 128, true);
    if (commandId && !transport) {
      const old = this.store.command(id, identity.accountId, commandId);
      if (old) return { ...old, duplicate: true };
    }
    const session = sessionId ? this.sessions.get(sessionId) || null : null;
    if (
      session &&
      (session.roomId !== id || session.accountId !== identity.accountId)
    )
      fail('FORBIDDEN', '会话不属于当前房间', 403);
    let result;
    const pending = [];
    const emit = this.emit;
    this.emit = (...args) => pending.push(args);
    let structural = !transport;
    try {
      this.store.db.transaction(() => {
        result = this.apply(identity, room, event, data, session);
        structural = !transport && !result?.unchanged;
        // 聊天也记住命令号：断线重发同一条消息不会出现两次
        if (
          commandId &&
          !transport &&
          event !== 'room:delete' &&
          event !== 'chat:read'
        )
          this.store.remember(
            id,
            identity.accountId,
            commandId,
            result,
            this.now()
          );
      })();
    } finally {
      this.emit = emit;
    }
    for (const args of pending) emit(...args);
    if (event !== 'room:delete' && structural) this.broadcastSnapshot(id);
    return result;
  }
  apply(identity, room, event, data, session) {
    const id = room.id;
    const now = this.now();
    if (PLAYBACK_EVENTS.has(event)) {
      this.requireControl(identity, room);
      const runtime = this.rt(id);
      let state = projected(room.currentState, now);
      const sentTime =
        data && typeof data === 'object' && data.currentTime !== undefined
          ? number(data.currentTime, 0, 30 * 86400)
          : typeof data === 'number'
          ? number(data, 0, 30 * 86400)
          : undefined;
      if (event === 'state:clear' || event === 'screen:stop') state = null;
      else if (
        event === 'play:play' ||
        event === 'play:pause' ||
        event === 'play:seek' ||
        event === 'play:rate'
      ) {
        if (state?.type !== 'play')
          fail('ACTIVITY_MISMATCH', '当前没有正在播放的影片', 409);
        if (
          data?.videoId !== undefined &&
          mediaKey(state) !==
            mediaKey({ type: 'play', ...data, episode: data.episode || 1 })
        )
          fail('ACTIVITY_MISMATCH', '影片已切换，请丢弃旧播放器的操作', 409);
        if (sentTime !== undefined) state.currentTime = sentTime;
        if (event === 'play:play') state.isPlaying = true;
        if (event === 'play:pause') state.isPlaying = false;
        if (event === 'play:seek' && data?.isPlaying !== undefined)
          state.isPlaying = !!data.isPlaying;
        if (data?.playbackRate !== undefined)
          state.playbackRate = rate(data.playbackRate, state.playbackRate);
        state.updatedAt = now;
      } else if (event === 'play:change' || event === 'play:update') {
        const next = mediaState(
          {
            ...data,
            type: 'play',
            currentTime: sentTime ?? 0,
          },
          now,
          room.currentState
        );
        if (event === 'play:update') {
          if (mediaKey(state) !== mediaKey(next))
            fail('ACTIVITY_MISMATCH', '影片已切换，请丢弃旧播放器更新', 409);
          next.queueItemId = state.queueItemId;
        } else if (
          state?.type === 'play' &&
          mediaKey(state) === mediaKey(next) &&
          (!next.queueItemId || next.queueItemId === state.queueItemId)
        ) {
          // 多个成员同时自动连播到同一集：结果相同，不重复广播换片。
          return {
            success: true,
            unchanged: true,
            state,
            revision: room.revision,
          };
        }
        state = next;
      } else {
        const expected = event.startsWith('music:')
          ? 'music'
          : event.startsWith('live:')
          ? 'live'
          : event.startsWith('screen:')
          ? 'screen'
          : data.type;
        if (
          event.startsWith('music:') &&
          event !== 'music:change' &&
          state &&
          (state.type !== 'music' ||
            state.song.id !== data.song?.id ||
            state.song.platform !== data.song?.platform)
        )
          fail('ACTIVITY_MISMATCH', '歌曲已切换，请先切换活动', 409);
        state = mediaState({ ...data, type: expected }, now, room.currentState);
        if (expected === 'screen') {
          state.ownerName = identity.accountId;
          state.ownerAccountId = identity.accountId;
          state.ownerSessionId = session?.id || null;
        }
        if (event === 'music:play') state.isPlaying = true;
        if (event === 'music:pause') state.isPlaying = false;
      }
      let playedQueueItem;
      if (event === 'play:change' && state?.queueItemId) {
        playedQueueItem = room.queue.find(
          (item) => item.id === state.queueItemId
        );
        if (!playedQueueItem)
          fail('QUEUE_ITEM_NOT_FOUND', '所选待看片单已变化，请重新选择', 409);
        playedQueueItem.playedAt ||= now;
      }
      // 版本号随状态一起入库，进程重启后仍然单调递增，客户端据此丢弃迟到的旧状态。
      runtime.stateVersion =
        Math.max(runtime.stateVersion, room.currentState?.version || 0) + 1;
      if (state) {
        state.version = runtime.stateVersion;
        state.updatedBy = identity.accountId;
      }
      room.currentState = state;
      room.roomType =
        state?.type === 'music'
          ? 'music'
          : state?.type === 'screen'
          ? 'screen'
          : 'sync';
      if (TRANSPORT_EVENTS.has(event)) {
        room.updatedAt = now;
        this.store.save(room);
        runtime.lastActiveAt = now;
      } else this.touch(room);
      if (playedQueueItem)
        this.emit(id, 'queue:updated', {
          roomId: id,
          queue: room.queue,
          revision: room.revision,
        });
      const broadcast =
        event === 'state:clear'
          ? 'state:cleared'
          : event.startsWith('play:') && event !== 'play:change'
          ? 'play:update'
          : event === 'activity:change'
          ? state?.type === 'screen'
            ? 'screen:start'
            : `${state?.type}:change`
          : event;
      this.emit(id, broadcast, state, false, session?.id);
      return {
        success: true,
        state,
        revision: room.revision,
        controllerEpoch: room.controllerEpoch,
      };
    }
    if (event.startsWith('queue:')) {
      const admin =
        identity.accountId === room.ownerAccountId ||
        membershipCanHost(this.store, id, identity.accountId);
      if (event === 'queue:add') {
        if (room.settings.memberCanQueue === false && !admin)
          fail('FORBIDDEN', '房主没有开放成员添加片单', 403);
        if (room.queue.length >= this.config.maxQueue)
          fail('QUEUE_FULL', '片单已满', 409);
        room.queue.push(queueItem(data, identity.accountId, now));
      } else {
        const index = room.queue.findIndex((item) => item.id === data.id);
        if (index < 0) fail('QUEUE_ITEM_NOT_FOUND', '片单里没有这一项', 404);
        if (
          !admin &&
          (event !== 'queue:remove' ||
            room.queue[index].addedBy !== identity.accountId ||
            room.queue[index].playedAt)
        )
          fail('FORBIDDEN', '只能移除自己添加、还没播放的影片', 403);
        if (event === 'queue:remove') room.queue.splice(index, 1);
        else if (event === 'queue:move') {
          const to = number(data.position, 0, room.queue.length - 1);
          room.queue.splice(to, 0, room.queue.splice(index, 1)[0]);
        } else if (event === 'queue:clear-played') {
          room.queue = room.queue.filter((item) => !item.playedAt);
        } else fail('UNKNOWN_COMMAND', '不支持的片单操作');
      }
      this.touch(room);
      this.emit(id, 'queue:updated', {
        roomId: id,
        queue: room.queue,
        revision: room.revision,
      });
    } else if (event === 'room:authorize-host') {
      this.requireOwner(identity, room);
      const accountId = text(data.accountId, 128, true);
      if (!this.store.membership(id, accountId))
        fail('MEMBER_NOT_FOUND', '请先让该成员加入房间', 404);
      this.store.authorize(id, accountId, data.canHost === true);
      this.touch(room);
    } else if (event === 'room:settings') {
      this.requireOwner(identity, room);
      if (data.name !== undefined) room.name = text(data.name, 80, true);
      if (data.description !== undefined)
        room.description = text(data.description, 500);
      if (data.isPublic !== undefined) room.isPublic = data.isPublic === true;
      if (data.password !== undefined)
        room.passwordHash = passwordHash(text(data.password, 128));
      if (data.memberCanQueue !== undefined)
        room.settings.memberCanQueue = data.memberCanQueue === true;
      if (data.memberCanControl !== undefined)
        room.settings.memberCanControl = data.memberCanControl === true;
      if (data.autoArchive !== undefined) {
        if (!['owner', 'admin'].includes(identity.role))
          fail('FORBIDDEN', '仅站长可设置长期保留房间', 403);
        room.settings.autoArchive = data.autoArchive !== false;
      }
      this.touch(room);
    } else if (event === 'room:cover') {
      this.requireAdmin(identity, room);
      if (data.image === null || data.image === '') {
        this.store.removeCover(id);
        delete room.settings.coverVersion;
      } else {
        const cover = coverImage(data.image);
        this.store.setCover(id, cover.mime, cover.data, now);
        room.settings.coverVersion = now;
      }
      this.touch(room);
    } else if (event === 'room:delete') {
      this.requireOwner(identity, room);
      this.emit(id, 'room:deleted', { reason: 'owner_deleted' });
      for (const member of [...this.sessions.values()])
        if (member.roomId === id) this.sessions.delete(member.id);
      this.store.remove(id);
      this.runtime.delete(id);
      return { success: true, deleted: true };
    } else if (event === 'room:restore') {
      this.requireOwner(identity, room);
      if (room.lifecycle !== 'archived')
        fail('NOT_ARCHIVED', '房间无需恢复', 409);
      if (
        this.store.countOwned(identity.accountId) >= this.config.maxOwnedRooms
      )
        fail('ROOM_LIMIT', '请先清理其他房间后恢复', 409);
      room.lifecycle = 'sleeping';
      room.archivedAt = null;
      room.emptySince = now;
      this.touch(room);
    } else if (event === 'chat:message') {
      this.limit(`${id}:${identity.accountId}:chat`, 20, 10000);
      const content = text(data.content, 2000, true);
      const message = this.store.addMessage({
        id: crypto.randomUUID(),
        roomId: id,
        accountId: identity.accountId,
        userId: identity.accountId,
        userName: identity.accountId,
        content,
        type: data.type === 'emoji' ? 'emoji' : 'text',
        timestamp: now,
      });
      this.emit(id, 'chat:message', message);
      return {
        success: true,
        message,
        revision: room.revision,
        unchanged: true,
      };
    } else if (event === 'chat:read') {
      this.store.markRead(id, identity.accountId, number(data.seq, 0));
      return {
        success: true,
        unchanged: true,
        revision: room.revision,
        controllerEpoch: room.controllerEpoch,
        unreadCount: this.store.unread(id, identity.accountId),
        lastReadSeq: this.store.membership(id, identity.accountId)
          .last_read_seq,
      };
    } else fail('UNKNOWN_COMMAND', '不支持的房间操作');
    return {
      success: true,
      revision: room.revision,
      controllerEpoch: room.controllerEpoch,
    };
  }
  limit(key, maximum, windowMs) {
    const now = this.now();
    let bucket = this.rate.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      this.rate.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > maximum)
      fail('RATE_LIMITED', '操作太频繁，请稍后重试', 429);
  }
  history(identity, id, after, limit, before) {
    if (!this.store.membership(id, identity.accountId))
      fail('FORBIDDEN', '请先加入房间', 403);
    this.getRoom(id);
    if (before !== undefined)
      return this.store.messagesBefore(
        id,
        number(before, 0),
        number(limit, 100, 200)
      );
    return this.store.messages(id, number(after, 0), number(limit, 100, 200));
  }
  sameRoom(senderId, targetId) {
    const sender = this.sessions.get(senderId);
    const target = this.sessions.get(targetId);
    return !!sender && !!target && sender.roomId === target.roomId;
  }
  shutdown() {
    for (const id of this.store.allIds()) {
      const room = this.store.get(id);
      if (room.currentState && 'isPlaying' in room.currentState)
        room.currentState = {
          ...projected(room.currentState, this.now()),
          isPlaying: false,
        };
      if (room.currentState?.type === 'screen') room.currentState = null;
      room.emptySince = room.emptySince ?? this.now();
      this.store.save(room);
    }
    this.sessions.clear();
    this.runtime.clear();
  }
}
function membershipCanHost(store, id, accountId) {
  return !!store.membership(id, accountId)?.can_host;
}

module.exports = { RoomService, DEFAULTS, mediaState, projected, fail };
