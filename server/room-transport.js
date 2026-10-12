'use strict';

const { fail } = require('./room-service');

function errorResult(error) {
  return { success: false, error: error.status ? error.message : '房间操作失败', code: error.code || 'INTERNAL_ERROR' };
}

class RoomSocketServer {
  constructor(io, service, authenticator) {
    this.io = io;
    this.service = service;
    this.authenticator = authenticator;
    this.helpers = new Map();
    service.emit = (target, event, data, direct = false, exclude) => {
      if (direct) io.to(target).emit(event, data);
      else if (exclude) io.to(target).except(exclude).emit(event, data);
      else io.to(target).emit(event, data);
      if (!direct && event === 'room:deleted') {
        io.in(target).socketsLeave(target);
        for (const [id, roomId] of this.helpers) if (roomId === target) this.helpers.delete(id);
      }
    };
    io.use((socket, next) => {
      try {
        socket.data.roomIdentity = authenticator.authenticate(socket.handshake.headers, socket.handshake.auth?.token);
        next();
      } catch (error) {
        const rejected = new Error(error.message);
        rejected.data = { code: error.code || 'UNAUTHORIZED' };
        next(rejected);
      }
    });
    io.on('connection', socket => this.attach(socket));
    this.timer = setInterval(() => {
      for (const [id, socket] of io.sockets.sockets) {
        try { authenticator.validate(socket.data.roomIdentity); } catch { socket.emit('room:auth-required', { code: 'UNAUTHORIZED' }); socket.disconnect(true); continue; }
        if (service.sessions.has(id)) {
          // Engine.IO pong is server-observed; hidden-page UI timers are not presence evidence.
          const engine = socket.conn;
          if (!engine.__roomPongAttached) {
            engine.__roomPongAttached = true;
            engine.on('packet', packet => { if (packet.type === 'pong') service.heartbeat(id); });
          }
        }
      }
      service.tick();
    }, 1000);
    this.timer.unref?.();
  }
  attach(socket) {
    const identity = socket.data.roomIdentity;
    const action = (event, handler) => socket.on(event, (...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const data = args[0] ?? {};
      try {
        this.authenticator.validate(identity);
        this.service.limit(`${socket.id}:commands`, 120, 10000);
        const result = handler(data, args[1] || {});
        callback?.(result);
      } catch (error) {
        const result = errorResult(error);
        if (callback) callback(result);
        else socket.emit('room:command-error', { ...result, event, commandId: data?.commandId });
      }
    });
    const joined = room => ({ success: true, room, members: room.members, messages: this.service.store.latestMessages(room.id, 100) });
    action('room:create', data => {
      const room = this.service.create(identity, data);
      const old = this.service.sessions.get(socket.id)?.roomId;
      if (old) socket.leave(old);
      const state = this.service.join(identity, room.id, {}, socket.id);
      socket.join(room.id);
      return joined(state);
    });
    action('room:join', data => {
      const old = this.service.sessions.get(socket.id)?.roomId;
      const room = this.service.join(identity, data.roomId, data, socket.id);
      if (old && old !== room.id) socket.leave(old);
      socket.join(room.id);
      return joined(room);
    });
    action('room:leave', () => {
      const id = this.service.sessions.get(socket.id)?.roomId;
      this.service.leave(socket.id, true);
      if (id) socket.leave(id);
      this.helpers.delete(socket.id);
      return { success: true };
    });
    action('room:list', data => this.service.list(identity, data.mode || 'public'));
    for (const event of ['room:ready', 'room:sync-applied', 'room:following']) action(event, data => {
      const method = event === 'room:ready' ? 'ready' : event === 'room:sync-applied' ? 'syncApplied' : 'following';
      const room = this.service[method](socket.id, data);
      return { success: true, room, members: room.members };
    });
    const events = ['play:update', 'play:seek', 'play:play', 'play:pause', 'play:change', 'live:change', 'music:change', 'music:update', 'music:play', 'music:pause', 'music:seek', 'music:queue', 'screen:start', 'screen:stop', 'state:clear', 'activity:change', 'queue:add', 'queue:remove', 'queue:move', 'room:settings', 'room:authorize-host', 'room:delete', 'room:restore', 'chat:message', 'chat:read'];
    for (const event of events) action(event, (data, extra) => {
      const session = this.service.requireSession(socket.id);
      let controlSessionId = socket.id;
      if (this.helpers.has(socket.id) && event.startsWith('screen:')) {
        const control = this.service.rt(session.roomId).controller;
        if (control?.accountId !== identity.accountId) fail('NOT_CONTROLLER', '共享设备已失去授权', 403);
        controlSessionId = control.sessionId;
      }
      const meta = { ...extra, ...(typeof data === 'object' ? data.meta || data : {}) };
      return this.service.execute(identity, session.roomId, event, data, meta, controlSessionId);
    });
    action('chat:history', data => {
      const session = this.service.requireSession(socket.id);
      const id = data.roomId || session.roomId;
      return { success: true, messages: this.service.history(identity, id, data.afterSeq || 0, data.limit || 100, data.beforeSeq), lastMessageSeq: this.service.store.lastSeq(id), unreadCount: this.service.store.unread(id, identity.accountId) };
    });
    // Browsing or folding a player does not change room membership or playback.
    action('play:owner-leave', () => ({ success: true }));
    action('heartbeat', () => {
      this.service.heartbeat(socket.id);
      socket.emit('heartbeat:pong', { timestamp: this.service.now() });
      return { success: true };
    });
    action('screen:helper-register', data => {
      const room = this.service.getRoom(data.roomId);
      const controller = this.service.rt(room.id).controller;
      if (controller?.accountId !== identity.accountId) fail('NOT_CONTROLLER', '仅当前主持可注册共享窗口', 403);
      this.service.join(identity, room.id, {}, socket.id);
      socket.join(room.id);
      for (const [helperId, roomId] of this.helpers) if (roomId === room.id) this.helpers.delete(helperId);
      this.helpers.set(socket.id, room.id);
      return { success: true };
    });
    action('screen:viewer-ready', () => {
      const session = this.service.requireSession(socket.id);
      const room = this.service.getRoom(session.roomId);
      if (room.currentState?.type !== 'screen') return { success: true };
      const controller = this.service.rt(room.id).controller;
      const helperId = [...this.helpers].find(([id, roomId]) => roomId === room.id && this.service.sessions.get(id)?.accountId === controller?.accountId)?.[0];
      const target = helperId || controller?.sessionId;
      if (target && target !== socket.id) this.io.to(target).emit('screen:viewer-ready', { userId: socket.id });
      return { success: true };
    });
    for (const prefix of ['screen', 'voice']) for (const kind of ['offer', 'answer', 'ice']) action(`${prefix}:${kind}`, data => {
      if (!this.service.sameRoom(socket.id, data.targetUserId)) fail('FORBIDDEN', '只能连接同房间成员', 403);
      const session = this.service.requireSession(socket.id);
      if (prefix === 'screen' && kind === 'offer' && this.service.rt(session.roomId).controller?.accountId !== identity.accountId) fail('NOT_CONTROLLER', '仅主持可发送共享画面', 403);
      if (prefix === 'screen' && kind !== 'offer') {
        const controllerAccount = this.service.rt(session.roomId).controller?.accountId;
        if (identity.accountId !== controllerAccount && this.service.sessions.get(data.targetUserId)?.accountId !== controllerAccount) fail('FORBIDDEN', '共享连接必须包含当前主持', 403);
      }
      const value = data[kind === 'ice' ? 'candidate' : kind];
      if (!value || JSON.stringify(value).length > 65536) fail('INVALID_INPUT', '实时连接数据无效');
      this.io.to(data.targetUserId).emit(`${prefix}:${kind}`, { userId: socket.id, [kind === 'ice' ? 'candidate' : kind]: value });
      return { success: true };
    });
    action('voice:audio-chunk', data => {
      const session = this.service.requireSession(socket.id);
      this.service.limit(`${socket.id}:audio`, 60, 1000);
      if (!Array.isArray(data.audioData) || data.audioData.length > 32768 || data.audioData.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) fail('INVALID_INPUT', '音频数据无效');
      socket.to(session.roomId).emit('voice:audio-chunk', { userId: socket.id, audioData: data.audioData, sampleRate: data.sampleRate === 48000 ? 48000 : 16000 });
      return { success: true };
    });
    socket.on('disconnect', () => {
      const helperRoom = this.helpers.get(socket.id);
      this.helpers.delete(socket.id);
      if (helperRoom && this.service.store.get(helperRoom)?.currentState?.type === 'screen') {
        const session = this.service.sessions.get(socket.id);
        const controller = this.service.rt(helperRoom).controller;
        if (session && controller?.accountId === session.accountId) {
          try { this.service.execute(identity, helperRoom, 'screen:stop', {}, {}, controller.sessionId); } catch {}
        }
      }
      this.service.leave(socket.id, false);
    });
  }
  destroy() { clearInterval(this.timer); this.service.shutdown(); }
}

async function readBody(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 65536) fail('PAYLOAD_TOO_LARGE', '请求内容过大', 413);
    chunks.push(chunk);
  }
  if (!length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('INVALID_JSON', '请求格式无效'); }
}
function validOrigin(origin, host, extra = '') {
  if (!origin) return true;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  return (['http:', 'https:'].includes(parsed.protocol) && parsed.host === host) || extra.split(',').map(value => value.trim()).filter(Boolean).includes(origin);
}
function createRoomHttpHandler(service, authenticator) {
  return async (req, res) => {
    const parsed = new URL(req.url, 'http://localhost');
    if (parsed.pathname !== '/api/rooms' && !parsed.pathname.startsWith('/api/rooms/')) return false;
    const send = (status, payload) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(payload)); };
    try {
      if (!validOrigin(req.headers.origin, req.headers.host, process.env.ROOM_ALLOWED_ORIGINS)) fail('FORBIDDEN', '请求来源不允许', 403);
      const parts = parsed.pathname.split('/').filter(Boolean).slice(2).map(decodeURIComponent);
      const id = parts[0];
      if (!id && req.method === 'GET' && parsed.searchParams.get('mode') === 'public') {
        send(200, { success: true, rooms: service.list({ accountId: '' }, 'public') });
        return true;
      }
      const identity = authenticator.authenticate(req.headers);
      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      let result;
      if (!id && req.method === 'GET') result = { success: true, rooms: service.list(identity, parsed.searchParams.get('mode') || 'all') };
      else if (!id && req.method === 'POST') { const room = service.create(identity, body); result = { success: true, room, members: [], messages: [] }; }
      else if (parts.length === 1 && req.method === 'GET') { const room = service.read(identity, id); result = { success: true, room, members: room.members }; }
      else if (parts[1] === 'join' && req.method === 'POST') { const room = service.join(identity, id, body); result = { success: true, room, members: room.members, messages: service.store.latestMessages(id, 100) }; }
      else if (parts[1] === 'messages' && req.method === 'GET') result = { success: true, messages: service.history(identity, id, Number(parsed.searchParams.get('afterSeq') || 0), Number(parsed.searchParams.get('limit') || 100), parsed.searchParams.has('beforeSeq') ? Number(parsed.searchParams.get('beforeSeq')) : undefined), lastMessageSeq: service.store.lastSeq(id), unreadCount: service.store.unread(id, identity.accountId) };
      else {
        let event;
        let data = body;
        if (parts.length === 1 && req.method === 'PATCH') event = 'room:settings';
        else if (parts.length === 1 && req.method === 'DELETE') event = 'room:delete';
        else if (parts[1] === 'restore' && req.method === 'POST') event = 'room:restore';
        else if (parts[1] === 'read' && req.method === 'POST') event = 'chat:read';
        else if (parts[1] === 'hosts' && req.method === 'PATCH') event = 'room:authorize-host';
        else if (parts[1] === 'queue' && !parts[2] && req.method === 'POST') event = 'queue:add';
        else if (parts[1] === 'queue' && parts[2] && req.method === 'DELETE') { event = 'queue:remove'; data = { ...body, id: parts[2] }; }
        else if (parts[1] === 'queue' && parts[2] && req.method === 'PATCH') { event = 'queue:move'; data = { ...body, id: parts[2] }; }
        else if (parts[1] === 'commands' && req.method === 'POST') { event = body.event; data = body.data || {}; }
        else fail('NOT_FOUND', '接口不存在', 404);
        result = service.execute(identity, id, event, data, body.meta || body, body.sessionId);
      }
      send(200, result);
    } catch (error) { send(error.status || 500, errorResult(error)); }
    return true;
  };
}

module.exports = { RoomSocketServer, createRoomHttpHandler, validOrigin, errorResult };
