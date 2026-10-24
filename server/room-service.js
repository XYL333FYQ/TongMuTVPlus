'use strict';

const crypto = require('node:crypto');

const DEFAULTS = Object.freeze({
  maxOwnedRooms: 3,
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
  if (value === undefined) return fallback;
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
function mediaState(input, now, previous = null) {
  if (!input || typeof input !== 'object')
    fail('INVALID_MEDIA', '播放状态无效');
  const common = { updatedAt: now };
  if (input.type === 'play')
    return {
      ...common,
      type: 'play',
      url: url(input.url),
      videoId: text(String(input.videoId || ''), 8192, true),
      videoName: text(input.videoName, 240),
      videoYear: text(input.videoYear, 30),
      searchTitle: text(input.searchTitle, 240),
      source: text(input.source, 240, true),
      episode: number(input.episode, 1, 100000),
      currentTime: number(input.currentTime, 0, 30 * 86400),
      isPlaying: !!input.isPlaying,
      playbackRate: number(input.playbackRate, 1, 16) || 1,
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
  if (!/^\/(play|live|web-live|music)(\?|$)/.test(href))
    fail('INVALID_MEDIA', '队列只接受站内播放入口');
  return {
    id: crypto.randomUUID(),
    title: text(data.title, 240, true),
    href,
    source: text(data.source, 240),
    videoId: text(String(data.videoId || ''), 8192),
    episode: number(data.episode, 1, 100000),
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

class RoomService {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now || Date.now;
    this.config = { ...DEFAULTS, ...fromEnv(), ...options.config };
    this.emit = options.emit || (() => {});
    this.runtime = new Map();
    this.sessions = new Map();
    this.rate = new Map();
    // A previous process's lease never grants control in this process.
    for (const id of store.allIds()) {
      const room = store.get(id);
      room.controllerEpoch += 1;
      room.emptySince = room.emptySince ?? this.now();
      if (room.currentState?.type === 'screen') room.currentState = null;
      else if (room.currentState && 'isPlaying' in room.currentState)
        room.currentState = {
          ...room.currentState,
          isPlaying: false,
          updatedAt: this.now(),
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
      this.runtime.set(id, {
        controller: null,
        lostAt: null,
        lastActiveAt: this.now(),
        dormant: false,
      });
    return this.runtime.get(id);
  }
  members(id) {
    return [...this.sessions.values()]
      .filter((session) => session.roomId === id)
      .map((session) => {
        const room = this.getRoom(id, true);
        const member = this.store.membership(id, session.accountId);
        return {
          id: session.id,
          accountId: session.accountId,
          name: session.accountId,
          isOwner: room.ownerAccountId === session.accountId,
          isController: this.rt(id).controller?.sessionId === session.id,
          canHost:
            !!member?.can_host || room.ownerAccountId === session.accountId,
          ready: session.ready,
          following: session.following !== false,
          lastHeartbeat: session.lastSeen,
        };
      });
  }
  summary(room, accountId) {
    const own = room.ownerAccountId === accountId;
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
        this.members(room.id).map((member) => member.accountId)
      ).size,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      lifecycle: room.lifecycle,
      revision: room.revision,
      isMine: own,
    };
  }
  snapshot(room, accountId, sessionId = null) {
    const runtime = this.rt(room.id);
    const members = this.members(room.id);
    const ownerSession = members.find((member) => member.isOwner);
    const control = runtime.controller;
    return {
      ...this.summary(room, accountId),
      ownerId: ownerSession?.id || room.ownerAccountId,
      controllerAccountId: control?.accountId || null,
      controllerSessionId: control?.sessionId || null,
      controllerEpoch: room.controllerEpoch,
      leaseExpiresAt: control?.leaseExpiresAt || null,
      currentState: projected(room.currentState, this.now()),
      queue: room.queue,
      settings: room.settings,
      lastOwnerHeartbeat: ownerSession?.lastHeartbeat || 0,
      lastMessageSeq: this.store.lastSeq(room.id),
      unreadCount: this.store.unread(room.id, accountId),
      members,
      serverTime: this.now(),
      canControl: !!sessionId && control?.sessionId === sessionId,
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
        memberCanQueue: true,
        autoArchive: true,
        ...(data.settings?.memberCanQueue === false
          ? { memberCanQueue: false }
          : {}),
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
  join(identity, id, data = {}, sessionId) {
    const room = this.getRoom(id);
    const known = this.store.membership(id, identity.accountId);
    // 需要校验密码时限流：每个账号每分钟最多试 10 次，防止暴力猜房间密码，
    // 也避免大量同步 scrypt 计算卡住整个服务
    if (!known && room.passwordHash)
      this.limit(`${identity.accountId}:join-password`, 10, 60000);
    if (!known && !passwordMatches(data.password, room.passwordHash))
      fail('WRONG_PASSWORD', '房间密码错误', 403);
    // 只有已经在这个房间里的连接（重复加入）才免检；
    // 从别的房间切过来的连接要占新名额，必须同样受人数上限约束
    if (
      sessionId &&
      this.sessions.get(sessionId)?.roomId !== id &&
      this.members(id).length >= this.config.maxMembers
    )
      fail('ROOM_FULL', '房间人数已满', 409);
    this.store.addMember(
      id,
      identity.accountId,
      identity.accountId === room.ownerAccountId,
      this.now()
    );
    if (sessionId) {
      if (this.sessions.get(sessionId)?.roomId !== id)
        this.leave(sessionId, true);
      this.sessions.set(sessionId, {
        id: sessionId,
        accountId: identity.accountId,
        identity,
        roomId: id,
        joinedAt: this.now(),
        lastSeen: this.now(),
        ready: false,
        following: true,
        readySince: null,
        appliedRevision: 0,
        requiredRevision: room.revision,
      });
      const runtime = this.rt(id);
      runtime.dormant = false;
      room.emptySince = null;
      if (room.lifecycle === 'sleeping') room.lifecycle = 'active';
      this.store.save(room);
      this.emit(
        id,
        'room:member-joined',
        this.members(id).find((member) => member.id === sessionId)
      );
    }
    this.broadcastSnapshot(id);
    return this.snapshot(room, identity.accountId, sessionId);
  }
  leave(sessionId, explicit = false) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const room = this.getRoom(session.roomId, true);
    const runtime = this.rt(room.id);
    this.sessions.delete(sessionId);
    this.emit(room.id, 'room:member-left', sessionId);
    if (runtime.controller?.sessionId === sessionId) {
      runtime.lostAt = this.now();
      runtime.controller.disconnected = true;
      if (explicit) runtime.lostAt -= this.config.reconnectGraceMs;
    }
    if (!this.members(room.id).length) {
      room.emptySince = this.now();
      this.store.save(room);
    }
    this.tickRoom(room.id);
    this.broadcastSnapshot(room.id);
  }
  requireSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) fail('NOT_IN_ROOM', '尚未加入房间', 403);
    return session;
  }
  heartbeat(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastSeen = this.now();
    const runtime = this.rt(session.roomId);
    if (runtime.controller?.sessionId === sessionId) {
      runtime.controller.leaseExpiresAt = this.now() + this.config.leaseMs;
      runtime.lostAt = null;
    }
  }
  ready(sessionId, data = {}) {
    const session = this.requireSession(sessionId);
    const room = this.getRoom(session.roomId);
    const applied =
      data.appliedRevision ?? data.revision ?? session.appliedRevision;
    if (data.ready === false) {
      session.ready = false;
      session.readySince = null;
      return this.snapshot(room, session.accountId, sessionId);
    }
    if (session.following === false)
      fail('FOLLOWING_REQUIRED', '请先返回房间共同播放', 409);
    if (
      !Number.isSafeInteger(applied) ||
      applied < session.requiredRevision ||
      applied > room.revision
    )
      fail('SYNC_REQUIRED', '请先恢复最新房间状态', 409);
    session.appliedRevision = applied;
    if (!session.ready) {
      session.ready = true;
      session.readySince = this.now();
    }
    this.heartbeat(sessionId);
    this.tickRoom(room.id);
    return this.snapshot(this.getRoom(room.id), session.accountId, sessionId);
  }
  syncApplied(sessionId, data = {}) {
    const session = this.requireSession(sessionId);
    const room = this.getRoom(session.roomId);
    const revision = data.appliedRevision ?? data.revision;
    if (
      !Number.isSafeInteger(revision) ||
      revision < session.requiredRevision ||
      revision > room.revision ||
      (data.controllerEpoch !== undefined &&
        data.controllerEpoch !== room.controllerEpoch)
    )
      fail('SYNC_REQUIRED', '快照已更新，请先同步最新状态', 409);
    session.appliedRevision = revision;
    return this.snapshot(room, session.accountId, sessionId);
  }
  following(sessionId, data = {}) {
    const session = this.requireSession(sessionId);
    session.following = data.following !== false;
    if (!session.following) {
      session.ready = false;
      session.readySince = null;
      const runtime = this.rt(session.roomId);
      if (runtime.controller?.sessionId === sessionId)
        runtime.lostAt = this.now() - this.config.reconnectGraceMs;
    } else session.requiredRevision = this.getRoom(session.roomId).revision;
    this.tickRoom(session.roomId);
    this.broadcastSnapshot(session.roomId);
    return this.snapshot(
      this.getRoom(session.roomId),
      session.accountId,
      sessionId
    );
  }
  assign(room, session) {
    const runtime = this.rt(room.id);
    const previous = runtime.controller;
    if (previous?.sessionId === session?.id) return;
    room.controllerEpoch += 1;
    room.revision += 1;
    room.updatedAt = this.now();
    runtime.controller = session
      ? {
          accountId: session.accountId,
          sessionId: session.id,
          leaseExpiresAt: this.now() + this.config.leaseMs,
          disconnected: false,
        }
      : null;
    runtime.lostAt = null;
    this.store.save(room);
    this.emit(room.id, 'room:controller-changed', {
      controllerAccountId: session?.accountId || null,
      controllerSessionId: session?.id || null,
      controllerEpoch: room.controllerEpoch,
      revision: room.revision,
      serverTime: this.now(),
    });
    this.broadcastSnapshot(room.id);
  }
  tickRoom(id) {
    const room = this.getRoom(id, true);
    const now = this.now();
    const members = [...this.sessions.values()].filter(
      (session) => session.roomId === id
    );
    if (room.lifecycle === 'archived') return;
    if (room.lifecycle === 'sleeping' && !members.length) {
      if (
        room.settings.autoArchive !== false &&
        room.emptySince !== null &&
        now - room.emptySince >= this.config.archiveMs
      ) {
        room.lifecycle = 'archived';
        room.archivedAt = now;
        this.store.save(room);
      }
      this.runtime.delete(id);
      return;
    }
    const runtime = this.rt(id);
    const eligible = members
      .filter(
        (session) =>
          session.ready &&
          session.following !== false &&
          now - session.lastSeen <= this.config.leaseMs &&
          (session.accountId === room.ownerAccountId ||
            this.store.membership(id, session.accountId)?.can_host)
      )
      .sort(
        (a, b) =>
          a.joinedAt - b.joinedAt ||
          a.accountId.localeCompare(b.accountId) ||
          a.id.localeCompare(b.id)
      );
    const controller = runtime.controller;
    const current = controller ? this.sessions.get(controller.sessionId) : null;
    const owner = eligible.find(
      (session) =>
        session.accountId === room.ownerAccountId &&
        ((!controller && !room.currentState) ||
          now - session.readySince >= this.config.ownerReadyMs)
    );
    if (
      owner &&
      (controller?.accountId !== room.ownerAccountId ||
        !current ||
        controller.disconnected)
    )
      this.assign(room, owner);
    else if (!controller)
      this.assign(
        room,
        eligible.find((session) => session.accountId !== room.ownerAccountId) ||
          owner ||
          null
      );
    else {
      // Buffering/hidden UI does not revoke an online controller. Readiness gates new elections only.
      const valid =
        current &&
        current.following !== false &&
        controller.leaseExpiresAt > now &&
        !controller.disconnected &&
        (current.accountId === room.ownerAccountId ||
          this.store.membership(id, current.accountId)?.can_host);
      if (!valid) {
        if (runtime.lostAt === null) runtime.lostAt = now;
        if (now - runtime.lostAt >= this.config.reconnectGraceMs)
          this.assign(
            room,
            eligible.find((session) => session.id !== controller.sessionId) ||
              null
          );
      }
    }
    if (!members.length && room.emptySince !== null) {
      const idle = now - room.emptySince;
      if (
        idle >= this.config.emptyPauseMs &&
        room.currentState &&
        (room.currentState.type === 'screen' || room.currentState.isPlaying)
      ) {
        const state = projected(room.currentState, now);
        if (state.type === 'screen') room.currentState = null;
        else if (state.isPlaying)
          room.currentState = { ...state, isPlaying: false };
        else room.currentState = state;
        this.store.save(room);
      }
      if (
        room.settings.autoArchive !== false &&
        idle >= this.config.archiveMs
      ) {
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
  }
  tick() {
    const now = this.now();
    for (const session of [...this.sessions.values()])
      if (now - session.lastSeen > this.config.leaseMs)
        this.leave(session.id, false);
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
  requireControl(session, room, meta = {}) {
    const controller = this.rt(room.id).controller;
    if (
      !controller ||
      controller.sessionId !== session.id ||
      controller.disconnected ||
      controller.leaseExpiresAt <= this.now()
    )
      fail('NOT_CONTROLLER', '当前没有播放控制权', 403);
    if (
      meta.controllerEpoch !== undefined &&
      meta.controllerEpoch !== room.controllerEpoch
    )
      fail('STALE_CONTROLLER', '主持权已变更，请同步状态后重试', 409);
  }
  execute(identity, id, event, data = {}, meta = {}, sessionId) {
    const room = this.getRoom(id, event === 'room:restore');
    const membership = this.store.membership(id, identity.accountId);
    if (!membership) fail('FORBIDDEN', '请先加入房间', 403);
    const commandId = meta.commandId || data?.commandId;
    if (commandId !== undefined) text(commandId, 128, true);
    if (commandId) {
      const old = this.store.command(id, identity.accountId, commandId);
      if (old) return { ...old, duplicate: true };
    }
    if (meta.baseRevision !== undefined && meta.baseRevision !== room.revision)
      fail('REVISION_CONFLICT', '房间状态已经更新，请刷新后重试', 409);
    if (
      meta.controllerEpoch !== undefined &&
      meta.controllerEpoch !== room.controllerEpoch
    )
      fail('STALE_CONTROLLER', '主持权已经更新', 409);
    const session = sessionId ? this.requireSession(sessionId) : null;
    if (
      session &&
      (session.roomId !== id || session.accountId !== identity.accountId)
    )
      fail('FORBIDDEN', '会话不属于当前房间', 403);
    let result;
    const pending = [];
    const emit = this.emit;
    this.emit = (...args) => pending.push(args);
    try {
      this.store.db.transaction(() => {
        result = this.apply(identity, room, event, data, meta, session);
        if (commandId && event !== 'room:delete')
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
    if (event !== 'room:delete') this.broadcastSnapshot(id);
    return result;
  }
  apply(identity, room, event, data, meta, session) {
    const id = room.id;
    if (
      event.startsWith('play:') ||
      event.startsWith('music:') ||
      event.startsWith('live:') ||
      event === 'state:clear' ||
      event === 'screen:start' ||
      event === 'screen:stop' ||
      event === 'activity:change'
    ) {
      if (!session)
        fail('PLAYBACK_SESSION_REQUIRED', '播放操作需要已就绪的在线设备', 409);
      this.requireControl(session, room, meta);
      let state = projected(room.currentState, this.now());
      if (event === 'state:clear' || event === 'screen:stop') state = null;
      else if (
        event === 'play:play' ||
        event === 'play:pause' ||
        event === 'play:seek'
      ) {
        if (state?.type !== 'play')
          fail('ACTIVITY_MISMATCH', '当前不是视频活动', 409);
        if (event === 'play:seek')
          state.currentTime = number(
            typeof data === 'number' ? data : data.currentTime,
            0,
            30 * 86400
          );
        else state.isPlaying = event === 'play:play';
        state.updatedAt = this.now();
      } else {
        const expected = event.startsWith('music:')
          ? 'music'
          : event.startsWith('live:')
          ? 'live'
          : event.startsWith('screen:')
          ? 'screen'
          : event.startsWith('play:')
          ? 'play'
          : data.type;
        if (
          event === 'play:update' &&
          state &&
          (state.type !== 'play' ||
            state.videoId !== data.videoId ||
            state.source !== data.source ||
            (state.episode || 1) !== (data.episode || 1))
        )
          fail('ACTIVITY_MISMATCH', '影片已切换，请丢弃旧播放器更新', 409);
        if (
          event.startsWith('music:') &&
          event !== 'music:change' &&
          state &&
          (state.type !== 'music' ||
            state.song.id !== data.song?.id ||
            state.song.platform !== data.song?.platform)
        )
          fail('ACTIVITY_MISMATCH', '歌曲已切换，请先切换活动', 409);
        state = mediaState(
          { ...data, type: expected },
          this.now(),
          room.currentState
        );
        if (expected === 'screen') state.ownerName = identity.accountId;
        if (event === 'music:play') state.isPlaying = true;
        if (event === 'music:pause') state.isPlaying = false;
      }
      room.currentState = state;
      room.roomType =
        state?.type === 'music'
          ? 'music'
          : state?.type === 'screen'
          ? 'screen'
          : 'sync';
      this.touch(room);
      if (
        event === 'play:change' ||
        event === 'live:change' ||
        event === 'music:change' ||
        event === 'activity:change'
      ) {
        for (const member of this.sessions.values())
          if (member.roomId === id && member.id !== session.id) {
            member.ready = false;
            member.readySince = null;
            member.requiredRevision = room.revision;
          }
      }
      if (event !== 'activity:change')
        this.emit(
          id,
          event === 'state:clear' ? 'state:cleared' : event,
          event === 'play:seek' ? state.currentTime : state,
          false,
          session.id
        );
    } else if (event.startsWith('queue:')) {
      if (
        !room.settings.memberCanQueue &&
        identity.accountId !== room.ownerAccountId &&
        !membershipCanHost(this.store, id, identity.accountId)
      )
        fail('FORBIDDEN', '房间未允许成员点播', 403);
      if (event === 'queue:add') {
        if (room.queue.length >= this.config.maxQueue)
          fail('QUEUE_FULL', '队列已满', 409);
        room.queue.push(queueItem(data, identity.accountId, this.now()));
      } else {
        const index = room.queue.findIndex((item) => item.id === data.id);
        if (index < 0) fail('QUEUE_ITEM_NOT_FOUND', '队列内容不存在', 404);
        if (
          identity.accountId !== room.ownerAccountId &&
          !membershipCanHost(this.store, id, identity.accountId) &&
          room.queue[index].addedBy !== identity.accountId
        )
          fail('FORBIDDEN', '不能修改他人的队列内容', 403);
        if (event === 'queue:remove') room.queue.splice(index, 1);
        else if (event === 'queue:move') {
          const to = number(data.position, 0, room.queue.length - 1);
          room.queue.splice(to, 0, room.queue.splice(index, 1)[0]);
        } else fail('UNKNOWN_COMMAND', '不支持的队列操作');
      }
      this.touch(room);
      this.emit(id, 'queue:updated', {
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
      if (
        data.canHost !== true &&
        this.rt(id).controller?.accountId === accountId &&
        accountId !== room.ownerAccountId
      )
        this.assign(room, null);
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
      if (data.autoArchive !== undefined) {
        if (!['owner', 'admin'].includes(identity.role))
          fail('FORBIDDEN', '仅站长可设置长期保留房间', 403);
        room.settings.autoArchive = data.autoArchive !== false;
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
      room.emptySince = this.now();
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
        timestamp: this.now(),
      });
      this.emit(id, 'chat:message', message);
      return { success: true, message, revision: room.revision };
    } else if (event === 'chat:read') {
      this.store.markRead(id, identity.accountId, number(data.seq, 0));
      return {
        success: true,
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
