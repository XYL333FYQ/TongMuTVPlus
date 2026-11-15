'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createServer, request } = require('node:http');
const { once } = require('node:events');
const { Server } = require('socket.io');
const { io: client } = require('socket.io-client');
const { openRoomStore, RoomStore } = require('./room-store');
const { RoomService } = require('./room-service');
const { createRoomAuthenticator } = require('./room-auth');
const { RoomSocketServer, createRoomHttpHandler } = require('./room-transport');

const SECRET = crypto.randomBytes(32).toString('hex');
const identities = {
  owner: { accountId: 'owner' },
  host: { accountId: 'host' },
  guest: { accountId: 'guest' },
  stranger: { accountId: 'stranger' },
};
function setup(t, config = {}) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tongmutvplus-room-test-')
  );
  const filename = path.join(directory, 'test.sqlite');
  let clock = 1800000000000;
  const db = openRoomStore(filename);
  db.exec(
    'CREATE TABLE users (username TEXT PRIMARY KEY, role TEXT, banned INTEGER DEFAULT 0); CREATE TABLE global_config (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)'
  );
  for (const name of Object.keys(identities))
    db.prepare('INSERT INTO users (username,role) VALUES (?,?)').run(
      name,
      name === 'owner' ? 'owner' : 'user'
    );
  const store = new RoomStore(db);
  const events = [];
  const service = new RoomService(store, {
    now: () => clock,
    config,
    emit: (...args) => events.push(args),
  });
  const authenticate = createRoomAuthenticator(db, {
    secret: SECRET,
    now: () => clock,
  });
  const cleanups = [];
  t.after(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    if (db.open) db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function credential(name) {
    const tokenId = `${name}-device`;
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const role = name === 'owner' ? 'owner' : 'user';
    const signature = crypto
      .createHmac('sha256', SECRET)
      .update(JSON.stringify({ username: name, role, timestamp: clock }))
      .digest('hex');
    db.prepare(
      'INSERT OR REPLACE INTO global_config (key,value,updated_at) VALUES (?,?,?)'
    ).run(
      `user_tokens:${name}:${tokenId}`,
      JSON.stringify({ token: refreshToken, expiresAt: clock + 86400000 }),
      clock
    );
    return encodeURIComponent(
      JSON.stringify({
        username: name,
        role,
        timestamp: clock,
        signature,
        tokenId,
        refreshToken,
        refreshExpires: clock + 86400000,
      })
    );
  }
  function join(name, id, sessionId = name, password) {
    return service.join(identities[name], id, { password }, sessionId);
  }
  function ready(sessionId) {
    const session = service.sessions.get(sessionId);
    const room = store.get(session.roomId);
    service.syncApplied(sessionId, {
      revision: room.revision,
      controllerEpoch: room.controllerEpoch,
    });
    service.ready(sessionId, { revision: room.revision });
  }
  function advance(ms) {
    clock += ms;
  }
  function command(name, id, event, data = {}, extra = {}, sessionId = name) {
    const room = store.get(id);
    return service.execute(
      identities[name],
      id,
      event,
      data,
      {
        controllerEpoch: room.controllerEpoch,
        baseRevision: room.revision,
        commandId: crypto.randomUUID(),
        ...extra,
      },
      sessionId
    );
  }
  return {
    directory,
    filename,
    db,
    store,
    service,
    events,
    authenticate,
    credential,
    join,
    ready,
    advance,
    command,
    now: () => clock,
    cleanup: (callback) => cleanups.push(callback),
  };
}
function createAndHost(f) {
  const room = f.service.create(identities.owner, {
    name: '测试房间',
    isPublic: true,
  });
  f.join('owner', room.id);
  f.ready('owner');
  f.advance(5000);
  f.service.tick();
  return room.id;
}
function video(time = 10) {
  return {
    type: 'play',
    videoId: 'movie-1',
    videoName: '测试电影',
    source: 'fixture',
    url: 'https://example.test/video.mp4',
    currentTime: time,
    isPlaying: true,
    playbackRate: 1,
    episode: 1,
  };
}
function expectCode(fn, code) {
  assert.throws(fn, (error) => error.code === code);
}

test('authenticated account identity, revocation and public DTO do not trust browser names/tokens', (t) => {
  const f = setup(t);
  const auth = f.credential('owner');
  const identity = f.authenticate.authenticate({ cookie: `auth=${auth}` });
  assert.equal(identity.accountId, 'owner');
  const forged = JSON.parse(decodeURIComponent(auth));
  forged.username = 'host';
  expectCode(() => f.authenticate.authenticate({}, forged), 'UNAUTHORIZED');
  const room = f.service.create(identity, {
    name: '私密资料测试',
    password: 'disposable-test',
    isPublic: true,
    userName: 'forged-owner',
    ownerToken: 'fake',
  });
  assert.equal(room.ownerAccountId, 'owner');
  const summary = f.service.list(identities.stranger, 'public')[0];
  for (const key of [
    'password',
    'passwordHash',
    'ownerToken',
    'currentState',
    'queue',
    'controllerSessionId',
  ])
    assert.equal(Object.hasOwn(summary, key), false, key);
  expectCode(() => f.join('guest', room.id), 'PASSWORD_REQUIRED');
  const joined = f.join('guest', room.id, 'guest', 'disposable-test');
  for (const key of ['password', 'passwordHash', 'ownerToken'])
    assert.equal(Object.hasOwn(joined, key), false, key);
  f.db
    .prepare('UPDATE users SET role = ? WHERE username = ?')
    .run('user', 'owner');
  expectCode(() => f.authenticate.validate(identity), 'UNAUTHORIZED');
  f.db
    .prepare('UPDATE users SET role = ? WHERE username = ?')
    .run('owner', 'owner');
  f.db
    .prepare('DELETE FROM global_config WHERE key = ?')
    .run('user_tokens:owner:owner-device');
  expectCode(() => f.authenticate.validate(identity), 'UNAUTHORIZED');
});

test('room quota is three, management belongs to durable owner, leave never dissolves', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  const second = f.service.create(identities.owner, {
    name: '第二房间',
    commandId: 'retry-create',
  });
  assert.equal(
    f.service.create(identities.owner, {
      name: '第二房间',
      commandId: 'retry-create',
    }).id,
    second.id
  );
  f.service.create(identities.owner, { name: '第三房间' });
  expectCode(
    () => f.service.create(identities.owner, { name: '第四房间' }),
    'ROOM_LIMIT'
  );
  f.join('guest', id);
  expectCode(
    () => f.command('guest', id, 'room:settings', { name: '抢占' }),
    'FORBIDDEN'
  );
  f.service.leave('owner', true);
  assert.equal(f.store.get(id).ownerAccountId, 'owner');
  assert.equal(f.service.sessions.has('guest'), true);
  assert.equal(
    f.events.some((event) => event[1] === 'room:deleted'),
    false
  );
});

test('members control playback directly; every change is broadcast with a monotonic version (SyncTV model)', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  const changed = f.command('owner', id, 'play:change', video(10));
  assert.equal(changed.state.version, 1);
  assert.equal(changed.state.updatedBy, 'owner');
  f.advance(5000);
  const paused = f.command('guest', id, 'play:pause', { currentTime: 14.2 });
  assert.equal(paused.state.isPlaying, false);
  assert.equal(paused.state.currentTime, 14.2);
  assert.equal(paused.state.updatedBy, 'guest');
  assert.ok(paused.state.version > changed.state.version);
  const broadcast = f.events
    .filter((event) => event[1] === 'play:update')
    .at(-1);
  assert.equal(broadcast[0], id);
  // 操作者自己从回执拿到新状态，不再收到自己的回声
  assert.equal(broadcast[4], 'guest');
  assert.equal(broadcast[2].isPlaying, false);
  f.advance(10000);
  assert.equal(
    f.service.read(identities.owner, id).currentState.currentTime,
    14.2
  );
  f.command('guest', id, 'play:seek', { currentTime: 100, isPlaying: true });
  f.advance(2000);
  const playing = f.service.read(identities.owner, id).currentState;
  assert.equal(playing.isPlaying, true);
  assert.equal(playing.currentTime, 102);
  f.command('owner', id, 'play:rate', { playbackRate: 2, currentTime: 102 });
  f.advance(1000);
  assert.equal(
    f.service.read(identities.owner, id).currentState.currentTime,
    104
  );
  // 播放进度类操作不改房间结构版本，不会让并发的片单操作冲突
  const revision = f.store.get(id).revision;
  f.command('guest', id, 'play:pause', { currentTime: 104 });
  assert.equal(f.store.get(id).revision, revision);
});

test('the owner can restrict playback control to the owner and room admins', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.command('owner', id, 'play:change', video());
  f.join('guest', id);
  f.join('host', id);
  f.command('owner', id, 'room:settings', { memberCanControl: false });
  expectCode(
    () => f.command('guest', id, 'play:pause', { currentTime: 1 }),
    'NO_CONTROL_PERMISSION'
  );
  expectCode(
    () => f.command('host', id, 'play:pause', { currentTime: 1 }),
    'NO_CONTROL_PERMISSION'
  );
  f.command('owner', id, 'room:authorize-host', {
    accountId: 'host',
    canHost: true,
  });
  f.command('host', id, 'play:pause', { currentTime: 3 });
  assert.equal(f.store.get(id).currentState.isPlaying, false);
  const snapshot = f.service.read(identities.guest, id);
  assert.equal(snapshot.canControl, false);
  assert.equal(snapshot.settings.memberCanControl, false);
  assert.equal(
    f.service.read(identities.host, id).members.find((m) => m.id === 'host')
      .canControl,
    true
  );
  expectCode(
    () => f.command('guest', id, 'room:settings', { memberCanControl: true }),
    'FORBIDDEN'
  );
  expectCode(() => f.command('stranger', id, 'play:play', {}), 'FORBIDDEN');
});

test('owner leaving or reconnecting never stops the room; nobody has to be elected', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.command('owner', id, 'play:change', video(50));
  f.join('guest', id);
  f.service.leave('owner');
  f.advance(120000);
  f.service.heartbeat('guest');
  f.service.tick();
  const state = f.service.read(identities.guest, id).currentState;
  assert.equal(state.isPlaying, true);
  assert.equal(state.currentTime, 170);
  f.command('guest', id, 'play:pause', { currentTime: 170 });
  f.join('owner', id, 'owner-tab-2');
  f.join('owner', id, 'owner-tab-3');
  f.command('owner', id, 'play:play', { currentTime: 170 }, {}, 'owner-tab-3');
  assert.equal(f.store.get(id).currentState.isPlaying, true);
});

test('legacy following toggles no longer detach a member from the room; commands are deduplicated', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.command('owner', id, 'play:change', video());
  f.join('guest', id);
  // 旧客户端仍可能发 room:following=false：在房间里就跟着房间，照常可以控制
  f.service.following('guest', { following: false });
  assert.equal(
    f.service.read(identities.owner, id).members.find((m) => m.id === 'guest')
      .following,
    true
  );
  f.command('guest', id, 'play:pause', { currentTime: 1 });
  const payload = {
    title: '等待解析',
    href: '/play?title=电影',
    source: 'fixture',
    videoId: '1',
  };
  const result = f.command('guest', id, 'queue:add', payload, {
    commandId: 'same-command',
  });
  const duplicate = f.command('guest', id, 'queue:add', payload, {
    commandId: 'same-command',
  });
  assert.equal(result.success, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(f.store.get(id).queue.length, 1);
});

test('simultaneous auto-advance to the same episode is applied once; stale player commands are rejected', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('owner', id, 'play:change', video());
  const next = { ...video(0), episode: 2 };
  const first = f.command('owner', id, 'play:change', next);
  const changes = f.events.filter((event) => event[1] === 'play:change').length;
  const second = f.command('guest', id, 'play:change', next);
  assert.equal(second.unchanged, true);
  assert.equal(second.state.version, first.state.version);
  assert.equal(
    f.events.filter((event) => event[1] === 'play:change').length,
    changes
  );
  expectCode(
    () =>
      f.command('guest', id, 'play:pause', {
        currentTime: 5,
        source: 'fixture',
        videoId: 'movie-1',
        episode: 1,
      }),
    'ACTIVITY_MISMATCH'
  );
});

test('state versions keep increasing after a restart', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.command('owner', id, 'play:change', video());
  const before = f.command('owner', id, 'play:pause', { currentTime: 12 }).state
    .version;
  f.service.shutdown();
  const restarted = new RoomService(f.store, { now: f.now });
  restarted.join(identities.owner, id, {}, 'owner');
  const after = restarted.execute(
    identities.owner,
    id,
    'play:play',
    { currentTime: 12 },
    {},
    'owner'
  );
  assert.ok(after.state.version > before);
});

test('a crash restart pauses at the last recorded position instead of projecting downtime', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  const before = f.command('owner', id, 'play:change', video(40)).state;
  assert.equal(before.isPlaying, true);
  // 没有调用 shutdown()：模拟进程崩溃后两小时才重启。
  f.advance(2 * 3600000);
  const restarted = new RoomService(f.store, { now: f.now });
  const state = restarted.read(identities.owner, id).currentState;
  assert.equal(state.isPlaying, false);
  assert.equal(state.currentTime, 40);
  assert.ok(state.version > before.version);
});

test('adding a waiting film survives unrelated playback revisions and controller epochs', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  const stale = {
    baseRevision: f.store.get(id).revision,
    controllerEpoch: f.store.get(id).controllerEpoch - 1,
  };
  f.command('owner', id, 'play:change', video(5));
  f.command(
    'guest',
    id,
    'queue:add',
    {
      title: '下一部',
      href: '/play?source=fixture&id=next',
      source: 'fixture',
      videoId: 'next',
    },
    stale
  );
  assert.equal(f.store.get(id).queue.length, 1);
  assert.equal(f.store.get(id).currentState.videoId, video(5).videoId);
  expectCode(
    () =>
      f.command(
        'stranger',
        id,
        'queue:add',
        {
          title: '越权',
          href: '/play?title=bad',
          source: 'fixture',
          videoId: 'bad',
        },
        stale
      ),
    'FORBIDDEN'
  );
});

test('the waiting list only accepts film entries the playback page can open', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('owner', id);
  for (const href of ['/music?x=1', '/live?x=1', '/web-live?platform=a']) {
    expectCode(
      () =>
        f.command('owner', id, 'queue:add', {
          title: '不是影片',
          href,
          source: 'fixture',
          videoId: 'x',
        }),
      'INVALID_MEDIA'
    );
  }
  assert.equal(f.store.get(id).queue.length, 0);
});

test('ordinary members may remove their waiting films but only hosts may reorder them', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('guest', id, 'queue:add', {
    title: '我的待看',
    href: '/play?source=fixture&id=next',
    source: 'fixture',
    videoId: 'next',
  });
  const item = f.store.get(id).queue[0];
  expectCode(
    () => f.command('guest', id, 'queue:move', { id: item.id, position: 0 }),
    'FORBIDDEN'
  );
  f.command('guest', id, 'queue:remove', { id: item.id });
  assert.equal(f.store.get(id).queue.length, 0);
});

test('a confirmed queue selection stays marked played after switching films and cannot be removed by its ordinary submitter', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('guest', id, 'queue:add', {
    title: '搜索后待看',
    href: '/play?title=测试电影',
    source: 'catalog-search',
    videoId: '测试电影',
  });
  const item = f.store.get(id).queue[0];
  f.command('owner', id, 'play:change', { ...video(), queueItemId: item.id });
  assert.equal(f.store.get(id).queue[0].playedAt, f.now());
  assert.equal(f.store.get(id).currentState.queueItemId, item.id);
  f.command('owner', id, 'play:change', { ...video(), videoId: 'other' });
  expectCode(
    () => f.command('guest', id, 'queue:remove', { id: item.id }),
    'FORBIDDEN'
  );
  f.command('owner', id, 'queue:remove', { id: item.id });
  assert.equal(f.store.get(id).queue.length, 0);
});

test('rooms, stable queue references, chat and read cursor persist across server restart', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('owner', id, 'queue:add', {
    title: '电影',
    href: '/play?source=fixture&id=movie-1',
    source: 'fixture',
    videoId: 'movie-1',
  });
  const message = f.command('owner', id, 'chat:message', {
    content: '持久消息',
    type: 'text',
  }).message;
  assert.equal(f.store.unread(id, 'guest'), 1);
  f.command('guest', id, 'chat:read', { seq: message.seq });
  f.command('owner', id, 'play:change', video(123));
  f.service.shutdown();
  f.db.close();
  const restartedDb = openRoomStore(f.filename);
  f.cleanup(() => restartedDb.close());
  const restarted = new RoomService(new RoomStore(restartedDb), { now: f.now });
  const room = restarted.read(identities.owner, id);
  assert.equal(room.ownerAccountId, 'owner');
  assert.equal(room.queue[0].href, '/play?source=fixture&id=movie-1');
  assert.equal(room.currentState.currentTime, 123);
  assert.equal(room.currentState.isPlaying, false);
  assert.equal(room.controllerAccountId, null);
  assert.equal(restarted.store.unread(id, 'guest'), 0);
  assert.equal(
    restarted.history(identities.guest, id, 0, 100)[0].content,
    '持久消息'
  );
});

test('empty room pauses after 60 seconds, sleeps at 10 minutes, archives and allows recovery before purge', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.command('owner', id, 'play:change', video());
  f.service.leave('owner', true);
  f.advance(59999);
  f.service.tick();
  assert.equal(f.store.get(id).currentState.isPlaying, true);
  f.advance(1);
  f.service.tick();
  assert.equal(f.store.get(id).currentState.isPlaying, false);
  assert.equal(f.store.get(id).currentState.currentTime, 70);
  f.advance(540000);
  f.service.tick();
  assert.equal(f.store.get(id).lifecycle, 'sleeping');
  f.advance(30 * 86400000);
  f.service.tick();
  assert.equal(f.store.get(id).lifecycle, 'archived');
  f.service.execute(identities.owner, id, 'room:restore', {});
  assert.equal(f.store.get(id).lifecycle, 'sleeping');
  f.advance(30 * 86400000);
  f.service.tick();
  f.advance(7 * 86400000);
  f.service.tick();
  assert.equal(f.store.get(id), null);
});

test('message reads are monotonic and isolated; credentials are stripped from media payload', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  const own = f.command('guest', id, 'chat:message', {
    content: '本人消息',
    type: 'text',
  }).message;
  assert.equal(f.store.unread(id, 'guest'), 0);
  const other = f.command('owner', id, 'chat:message', {
    content: '他人消息',
    type: 'text',
  }).message;
  assert.equal(f.store.unread(id, 'guest'), 1);
  f.command('guest', id, 'chat:read', { seq: other.seq });
  f.command('guest', id, 'chat:read', { seq: own.seq });
  assert.equal(f.store.unread(id, 'guest'), 0);
  expectCode(
    () => f.service.history(identities.stranger, id, 0, 100),
    'FORBIDDEN'
  );
  f.command('owner', id, 'play:change', {
    ...video(),
    headers: { Authorization: 'test-value' },
    credentials: { cookie: 'test' },
    ownerToken: 'test',
  });
  const state = f.service.read(identities.guest, id).currentState;
  assert.equal(Object.hasOwn(state, 'credentials'), false);
  assert.equal(Object.hasOwn(state, 'headers'), false);
  assert.equal(Object.hasOwn(state, 'ownerToken'), false);
});

test('chat and reads remain valid across unrelated playback revisions and host epochs', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  const before = f.store.get(id);
  const stale = {
    baseRevision: before.revision,
    controllerEpoch: before.controllerEpoch,
  };
  f.command('owner', id, 'play:change', video());
  const sent = f.command(
    'guest',
    id,
    'chat:message',
    { content: '仍然可以聊天' },
    stale
  ).message;
  f.command('owner', id, 'play:update', video(20));
  f.command(
    'guest',
    id,
    'chat:read',
    { seq: sent.seq },
    {
      ...stale,
      controllerEpoch: stale.controllerEpoch - 1,
    }
  );
  assert.equal(f.store.unread(id, 'guest'), 0);
  f.command('owner', id, 'play:update', video(30), stale);
  assert.equal(f.store.get(id).currentState.currentTime, 30);
  expectCode(
    () => f.command('stranger', id, 'chat:message', { content: '越权' }, stale),
    'FORBIDDEN'
  );
});

test('a command addressed to a former room cannot execute in the current room', (t) => {
  const f = setup(t);
  const first = createAndHost(f);
  const second = createAndHost(f);
  expectCode(
    () =>
      f.command('owner', second, 'chat:message', {
        roomId: first,
        content: '旧房间',
      }),
    'ROOM_CHANGED'
  );
  assert.equal(f.service.history(identities.owner, second).length, 0);
});

test('activity switches preserve music metadata, clear stale credentials and revoke candidate readiness', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('host', id);
  f.ready('host');
  f.command('owner', id, 'room:authorize-host', {
    accountId: 'host',
    canHost: true,
  });
  const song = {
    id: 'song-1',
    name: '歌曲',
    artist: '歌手',
    platform: 'fixture',
    privateCookie: 'do-not-forward',
  };
  f.command('owner', id, 'music:change', {
    type: 'music',
    song,
    nextSong: null,
    currentTime: 30,
    isPlaying: true,
    quality: 'lossless',
    playMode: 'single',
  });
  const music = f.service.read(identities.host, id).currentState;
  assert.equal(music.song.privateCookie, undefined);
  assert.equal(music.quality, 'lossless');
  f.command('owner', id, 'screen:start', {
    type: 'screen',
    status: 'sharing',
    hasAudio: true,
    ownerName: 'fake',
  });
  assert.equal(f.store.get(id).roomType, 'screen');
  assert.equal(f.store.get(id).currentState.ownerName, 'owner');
  f.command('owner', id, 'screen:stop');
  assert.equal(f.store.get(id).currentState, null);
  f.command('owner', id, 'live:change', {
    type: 'live',
    channelId: 'channel-1',
    channelName: '电视频道',
    channelUrl: 'https://example.test/channel.m3u8',
    credentials: 'private',
  });
  assert.equal(f.store.get(id).roomType, 'sync');
  assert.equal(f.store.get(id).currentState.credentials, undefined);
  expectCode(
    () => f.command('owner', id, 'play:update', video()),
    'ACTIVITY_MISMATCH'
  );
});

test('buffering and UI readiness changes do not revoke a connected host or pause the room', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.command('owner', id, 'play:change', video());
  f.join('host', id);
  f.ready('host');
  f.command('owner', id, 'room:authorize-host', {
    accountId: 'host',
    canHost: true,
  });
  f.service.ready('owner', { ready: false });
  f.advance(60000);
  f.service.heartbeat('owner');
  f.service.heartbeat('host');
  f.service.tick();
  assert.equal(f.store.get(id).currentState.isPlaying, true);
});

test('latest chat window is chronological and room inactivity survives service restart', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  for (let i = 0; i < 105; i++) {
    f.command('owner', id, 'chat:message', {
      content: `消息${i}`,
      type: 'text',
    });
    f.advance(1000);
  }
  const recent = f.store.latestMessages(id, 100);
  assert.equal(recent.length, 100);
  assert.equal(recent[0].content, '消息5');
  assert.equal(recent[99].content, '消息104');
  f.service.leave('owner', true);
  const emptySince = f.store.get(id).emptySince;
  f.advance(86400000);
  f.service.shutdown();
  assert.equal(f.store.get(id).emptySince, emptySince);
  const restarted = new RoomService(f.store, { now: f.now });
  assert.equal(restarted.store.get(id).emptySince, emptySince);
});

function ack(socket, event, data = {}) {
  return new Promise((resolve, reject) => {
    socket
      .timeout(4000)
      .emit(event, data, (error, response) =>
        error ? reject(error) : resolve(response)
      );
  });
}
function httpJson(address, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      address,
      {
        method: options.method || 'GET',
        agent: false,
        headers: { ...options.headers, Connection: 'close' },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            resolve({
              status: response.statusCode,
              data: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            });
          } catch (error) {
            reject(error);
          }
        });
        response.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end(options.body);
  });
}
test('real HTTP and Socket.IO share authentication, room state and cross-room signal boundaries', async (t) => {
  const f = setup(t, { ownerReadyMs: 0 });
  const handler = createRoomHttpHandler(f.service, f.authenticate);
  const http = createServer(async (req, res) => {
    if (!(await handler(req, res))) {
      res.statusCode = 404;
      res.end();
    }
  });
  const io = new Server(http, { transports: ['websocket'] });
  const transport = new RoomSocketServer(io, f.service, f.authenticate);
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}`;
  const sockets = [];
  f.cleanup(async () => {
    for (const socket of sockets) socket.disconnect();
    transport.destroy();
    await new Promise((resolve) => io.close(resolve));
    if (http.listening) await new Promise((resolve) => http.close(resolve));
  });
  const cookie = `auth=${f.credential('owner')}`;
  const unauth = await httpJson(`${base}/api/rooms`);
  assert.equal(unauth.status, 401);
  assert.equal(unauth.data.code, 'UNAUTHORIZED');
  const denied = await httpJson(`${base}/api/rooms`, {
    headers: { Cookie: cookie, Origin: 'https://unrelated.example' },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.data.code, 'FORBIDDEN');
  const created = (
    await httpJson(`${base}/api/rooms`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'HTTP创建', isPublic: true }),
    })
  ).data;
  assert.equal(created.success, true);
  const publicList = await httpJson(`${base}/api/rooms?mode=public`);
  assert.equal(publicList.status, 200);
  assert.equal(publicList.data.rooms[0].id, created.room.id);
  for (const key of [
    'currentState',
    'queue',
    'password',
    'passwordHash',
    'ownerToken',
  ])
    assert.equal(key in publicList.data.rooms[0], false);
  function connect(credential) {
    const socket = client(base, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Cookie: credential },
    });
    sockets.push(socket);
    return socket;
  }
  const bad = connect('');
  const [rejected] = await once(bad, 'connect_error');
  assert.equal(rejected.data.code, 'UNAUTHORIZED');
  const owner = connect(cookie);
  await once(owner, 'connect');
  const joined = await ack(owner, 'room:join', {
    roomId: created.room.id,
    userName: 'spoofed',
    ownerToken: 'fake',
  });
  assert.equal(joined.room.ownerAccountId, 'owner');
  assert.equal(joined.members[0].accountId, 'owner');
  await ack(owner, 'room:sync-applied', {
    revision: joined.room.revision,
    controllerEpoch: joined.room.controllerEpoch,
  });
  const ready = await ack(owner, 'room:ready', {
    revision: joined.room.revision,
  });
  assert.equal(ready.room.canControl, true);
  const sent = await ack(owner, 'chat:message', {
    content: 'Socket消息',
    type: 'text',
    commandId: 'transport-chat',
  });
  assert.equal(sent.success, true);
  const history = (
    await httpJson(`${base}/api/rooms/${created.room.id}/messages`, {
      headers: { Cookie: cookie },
    })
  ).data;
  assert.equal(history.messages[0].content, 'Socket消息');
  const stranger = connect(`auth=${f.credential('stranger')}`);
  await once(stranger, 'connect');
  await ack(stranger, 'room:create', {
    name: '别的房间',
    userName: 'stranger',
  });
  const signal = await ack(owner, 'voice:offer', {
    targetUserId: stranger.id,
    offer: { type: 'offer', sdp: 'fixture' },
  });
  assert.equal(signal.code, 'FORBIDDEN');
  const list = await ack(stranger, 'room:list');
  assert.equal(list[0].currentState, undefined);
  assert.equal(list[0].ownerToken, undefined);
  const left = await ack(owner, 'room:leave');
  assert.equal(left.success, true);
  const persisted = (
    await httpJson(`${base}/api/rooms/${created.room.id}`, {
      headers: { Cookie: cookie },
    })
  ).data;
  assert.equal(persisted.success, true);
});

test('private room membership survives restart without storing its plaintext password on the client', (t) => {
  const f = setup(t);
  const room = f.service.create(identities.owner, {
    name: '长期私密房',
    password: 'test-only-password',
  });
  f.join('guest', room.id, 'guest', 'test-only-password');
  f.service.leave('guest', false);
  const restarted = new RoomService(f.store, { now: f.now });
  assert.equal(
    restarted.join(identities.guest, room.id, {}, 'guest-return').id,
    room.id
  );
  assert.equal(
    restarted.join(identities.owner, room.id, {}, 'owner-return').id,
    room.id
  );
  expectCode(
    () => restarted.join(identities.stranger, room.id, {}, 'stranger'),
    'PASSWORD_REQUIRED'
  );
  assert.equal(restarted.list({ accountId: '' }, 'public').length, 0);
});

test('chat retention deletes expired text but keeps sequence high-water marks and read cursors after reopening', (t) => {
  const f = setup(t, { chatRetentionMs: 1000 });
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('owner', id, 'chat:message', { content: '会过期的消息' });
  const seq = f.store.lastSeq(id);
  f.command('guest', id, 'chat:read', { seq });
  f.advance(1001);
  f.service.tick();
  assert.equal(f.store.messages(id).length, 0);
  assert.equal(f.store.lastSeq(id), seq);
  assert.equal(f.store.membership(id, 'guest').last_read_seq, seq);
  assert.equal(f.store.unread(id, 'guest'), 0);
  const reopened = openRoomStore(f.filename);
  assert.equal(new RoomStore(reopened).lastSeq(id), seq);
  reopened.close();
  f.command('owner', id, 'chat:message', { content: '新的消息' });
  assert.ok(f.store.lastSeq(id) > seq);
  assert.equal(f.store.unread(id, 'guest'), 1);
});

test('station owner can exempt a durable room from archiving; ordinary room owners cannot', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  expectCode(
    () => f.command('owner', id, 'room:settings', { autoArchive: false }),
    'FORBIDDEN'
  );
  f.service.execute(
    { ...identities.owner, role: 'owner' },
    id,
    'room:settings',
    { autoArchive: false }
  );
  f.service.leave('owner', true);
  f.advance(35 * 86400000);
  f.service.tick();
  assert.equal(f.store.get(id).settings.autoArchive, false);
  assert.equal(f.store.get(id).lifecycle, 'sleeping');
});

test('room capacity counts accounts: eight people fit, extra tabs are free, the ninth is rejected', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  for (let index = 0; index < 7; index++)
    f.service.join({ accountId: `member-${index}` }, id, {}, `member-${index}`);
  f.join('owner', id, 'owner-second-tab');
  expectCode(
    () => f.service.join({ accountId: 'ninth' }, id, {}, 'ninth'),
    'ROOM_FULL'
  );
  assert.equal(
    new Set(f.service.members(id).map((member) => member.accountId)).size,
    8
  );
});
test('a connection already in another room cannot switch into a full room', (t) => {
  const f = setup(t);
  const full = createAndHost(f);
  for (let index = 0; index < 7; index++)
    f.service.join(
      { accountId: `member-${index}` },
      full,
      {},
      `member-${index}`
    );
  const { id: other } = f.service.create(identities.host, {
    name: '另一个房间',
    isPublic: true,
  });
  f.join('stranger', other, 'switcher');
  expectCode(() => f.join('stranger', full, 'switcher'), 'ROOM_FULL');
  assert.equal(
    new Set(f.service.members(full).map((member) => member.accountId)).size,
    8
  );
  // 被拒绝时仍留在原房间
  assert.equal(f.service.sessions.get('switcher').roomId, other);
});
test('chat supports stable older pages and reconnect replay without giving outsiders message access', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  const sequences = [];
  for (let index = 0; index < 145; index++) {
    sequences.push(
      f.store.addMessage({
        id: crypto.randomUUID(),
        roomId: id,
        accountId: 'owner',
        content: `message-${index}`,
        type: 'text',
        timestamp: f.now(),
      }).seq
    );
  }
  const latest = f.store.latestMessages(id, 100);
  assert.equal(latest[0].content, 'message-45');
  const older = f.service.history(identities.guest, id, 0, 50, latest[0].seq);
  assert.equal(older.length, 45);
  assert.equal(older[0].content, 'message-0');
  assert.equal(older[44].content, 'message-44');
  const gap = f.service.history(identities.guest, id, sequences[0], 100);
  const remaining = f.service.history(
    identities.guest,
    id,
    gap[gap.length - 1].seq,
    100
  );
  assert.equal(gap.length + remaining.length, 144);
  assert.equal(
    new Set([...gap, ...remaining].map((message) => message.id)).size,
    144
  );
  expectCode(
    () => f.service.history(identities.stranger, id, 0, 50, latest[0].seq),
    'FORBIDDEN'
  );
});

test('real HTTP and Socket chat history agree on older and newer pages without changing unread state', async (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  const other = f.service.create(identities.host, { name: '其他房间' });
  const expected = [];
  for (let index = 0; index < 145; index++) {
    expected.push(
      f.store.addMessage({
        id: crypto.randomUUID(),
        roomId: id,
        accountId: 'guest',
        content: `page-${index}`,
        type: 'text',
        timestamp: f.now(),
      })
    );
    if (index % 20 === 0)
      f.store.addMessage({
        id: crypto.randomUUID(),
        roomId: other.id,
        accountId: 'host',
        content: 'other-room',
        type: 'text',
        timestamp: f.now(),
      });
  }
  const handler = createRoomHttpHandler(f.service, f.authenticate);
  const http = createServer(async (req, res) => {
    if (!(await handler(req, res))) {
      res.statusCode = 404;
      res.end();
    }
  });
  const io = new Server(http, { transports: ['websocket'] });
  const transport = new RoomSocketServer(io, f.service, f.authenticate);
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}`;
  const cookie = `auth=${f.credential('owner')}`;
  const socket = client(base, {
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { Cookie: cookie },
  });
  f.cleanup(async () => {
    socket.disconnect();
    transport.destroy();
    await new Promise((resolve) => io.close(resolve));
    if (http.listening) await new Promise((resolve) => http.close(resolve));
  });
  await once(socket, 'connect');
  const joined = await ack(socket, 'room:join', { roomId: id });
  assert.equal(joined.messages.length, 100);
  assert.equal(joined.messages[0].id, expected[45].id);
  async function matchingPage(query) {
    const wire = await ack(socket, 'chat:history', { roomId: id, ...query });
    const httpPage = await httpJson(
      `${base}/api/rooms/${id}/messages?${new URLSearchParams(
        Object.entries(query).map(([key, value]) => [key, String(value)])
      )}`,
      { headers: { Cookie: cookie } }
    );
    assert.equal(httpPage.status, 200);
    assert.equal(wire.success, true);
    assert.deepEqual(httpPage.data.messages, wire.messages);
    assert.equal(httpPage.data.lastMessageSeq, wire.lastMessageSeq);
    assert.equal(httpPage.data.unreadCount, 145);
    assert.equal(wire.unreadCount, 145);
    return httpPage.data.messages;
  }
  const firstOlder = await matchingPage({
    beforeSeq: joined.messages[0].seq,
    limit: 20,
  });
  assert.deepEqual(
    firstOlder.map((message) => message.id),
    expected.slice(25, 45).map((message) => message.id)
  );
  const secondOlder = await matchingPage({
    beforeSeq: firstOlder[0].seq,
    limit: 20,
  });
  const earliest = await matchingPage({
    beforeSeq: secondOlder[0].seq,
    limit: 20,
  });
  const combined = [
    ...earliest,
    ...secondOlder,
    ...firstOlder,
    ...joined.messages,
  ];
  assert.deepEqual(
    combined.map((message) => message.id),
    expected.map((message) => message.id)
  );
  assert.equal(new Set(combined.map((message) => message.id)).size, 145);
  const newer = await matchingPage({ afterSeq: expected[99].seq, limit: 100 });
  assert.deepEqual(
    newer.map((message) => message.id),
    expected.slice(100).map((message) => message.id)
  );
  assert.equal(
    (await matchingPage({ beforeSeq: expected[0].seq, limit: 20 })).length,
    0
  );
  assert.deepEqual(
    (
      await matchingPage({
        afterSeq: expected[144].seq,
        beforeSeq: expected[45].seq,
        limit: 20,
      })
    ).map((message) => message.id),
    firstOlder.map((message) => message.id)
  );
  const invalid = await httpJson(
    `${base}/api/rooms/${id}/messages?beforeSeq=not-a-number`,
    { headers: { Cookie: cookie } }
  );
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.code, 'INVALID_INPUT');
  const outsider = await httpJson(
    `${base}/api/rooms/${id}/messages?beforeSeq=${expected[45].seq}`,
    { headers: { Cookie: `auth=${f.credential('stranger')}` } }
  );
  assert.equal(outsider.status, 403);
  assert.equal(outsider.data.code, 'FORBIDDEN');
  assert.equal(
    (
      await httpJson(
        `${base}/api/rooms/${id}/messages?beforeSeq=${expected[45].seq}`
      )
    ).status,
    401
  );
  assert.equal(f.store.unread(id, 'owner'), 145);
});

test('guessing a room password is rate limited per account, and the right password still works after the window', (t) => {
  const f = setup(t);
  const room = f.service.create(identities.owner, {
    name: '限流测试房',
    password: 'right-password',
  });
  for (let i = 0; i < 10; i++)
    expectCode(
      () => f.join('stranger', room.id, 'stranger', `wrong-${i}`),
      'WRONG_PASSWORD'
    );
  // 第 11 次即使密码正确也先被限流，攻击者无法继续枚举
  expectCode(
    () => f.join('stranger', room.id, 'stranger', 'right-password'),
    'RATE_LIMITED'
  );
  // 其他账号不受影响
  f.join('guest', room.id, 'guest', 'right-password');
  f.advance(60000);
  f.join('stranger', room.id, 'stranger', 'right-password');
});

test('room covers: owners upload and remove; public rooms show them to everyone, private rooms only to members', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  const png =
    'data:image/png;base64,' +
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).toString('base64');
  expectCode(
    () => f.command('guest', id, 'room:cover', { image: png }),
    'FORBIDDEN'
  );
  expectCode(
    () =>
      f.command('owner', id, 'room:cover', {
        image: 'data:text/html;base64,PGgxPg==',
      }),
    'INVALID_INPUT'
  );
  f.command('owner', id, 'room:cover', { image: png });
  const summary = f.service.list(identities.stranger, 'public')[0];
  assert.match(summary.coverUrl, new RegExp(`/api/rooms/${id}/cover\\?v=`));
  assert.equal(f.service.readCover(null, id).mime, 'image/png');
  f.command('owner', id, 'room:settings', { isPublic: false });
  expectCode(() => f.service.readCover(null, id), 'FORBIDDEN');
  assert.equal(f.service.readCover(identities.guest, id).data.length, 8);
  f.command('owner', id, 'play:change', {
    ...video(),
    poster: 'https://img.test/poster.jpg',
  });
  assert.equal(
    f.service.read(identities.guest, id).nowPlaying.poster,
    'https://img.test/poster.jpg'
  );
  f.command('owner', id, 'room:cover', { image: null });
  assert.equal(f.service.read(identities.guest, id).coverUrl, null);
  expectCode(() => f.service.readCover(identities.guest, id), 'NOT_FOUND');
});

// ------------------------------------------------------------------ SyncTV 式房间管理

test('role defaults and per-member permission overrides decide what a member may do', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  let guest = f.service.read(identities.guest, id);
  assert.equal(guest.myRole, 'member');
  assert.deepEqual(guest.myPermissions, [
    'playback',
    'changeMedia',
    'addMedia',
    'chat',
  ]);
  f.command('guest', id, 'play:change', video());
  // 房主收回这名成员的播放权限
  f.command('owner', id, 'room:member-permissions', {
    accountId: 'guest',
    permissions: ['chat'],
  });
  expectCode(
    () => f.command('guest', id, 'play:pause', { currentTime: 3 }),
    'NO_CONTROL_PERMISSION'
  );
  expectCode(
    () =>
      f.command('guest', id, 'queue:add', {
        title: '电影',
        href: '/play?source=fixture&id=x',
      }),
    'FORBIDDEN'
  );
  guest = f.service.read(identities.guest, id);
  assert.deepEqual(guest.myPermissions, ['chat']);
  assert.equal(
    guest.roster.find((member) => member.accountId === 'guest')
      .customPermissions,
    true
  );
  // 恢复角色默认
  f.command('owner', id, 'room:member-permissions', {
    accountId: 'guest',
    permissions: null,
  });
  f.command('guest', id, 'play:pause', { currentTime: 3 });
});

test('admins manage members but not other admins or the owner; only the owner sets room permissions', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('host', id);
  f.join('guest', id);
  f.command('owner', id, 'room:authorize-host', {
    accountId: 'host',
    canHost: true,
  });
  expectCode(
    () => f.command('host', id, 'room:kick', { accountId: 'owner' }),
    'FORBIDDEN'
  );
  expectCode(
    () => f.command('host', id, 'room:settings', { memberCanControl: false }),
    'FORBIDDEN'
  );
  f.command('host', id, 'room:settings', { chatEnabled: false });
  expectCode(
    () => f.command('guest', id, 'chat:message', { content: '你好' }),
    'CHAT_DISABLED'
  );
  // 管理员仍可以发言
  f.command('host', id, 'chat:message', { content: '公告' });
  f.command('host', id, 'room:kick', { accountId: 'guest' });
  assert.equal(f.store.membership(id, 'guest'), undefined);
  assert.ok(
    f.events.some(
      ([target, event]) => target === 'guest' && event === 'room:kicked'
    )
  );
});

test('a kicked and banned account cannot rejoin until unbanned', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('owner', id, 'room:kick', { accountId: 'guest', ban: true });
  expectCode(() => f.join('guest', id), 'BANNED');
  f.command('owner', id, 'room:unban', { accountId: 'guest' });
  assert.equal(f.join('guest', id).id, id);
});

test('rooms that require approval admit people only after an admin approves', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.command('owner', id, 'room:settings', { requireApproval: true });
  expectCode(() => f.join('guest', id), 'JOIN_PENDING');
  // 重复申请只登记一次
  expectCode(() => f.join('guest', id), 'JOIN_PENDING');
  const owner = f.service.read(identities.owner, id);
  assert.deepEqual(
    owner.joinRequests.map((request) => request.accountId),
    ['guest']
  );
  f.command('owner', id, 'room:join-review', {
    accountId: 'guest',
    approve: true,
  });
  assert.equal(f.join('guest', id).id, id);
  expectCode(() => f.join('stranger', id), 'JOIN_PENDING');
  f.command('owner', id, 'room:join-review', {
    accountId: 'stranger',
    approve: false,
  });
  expectCode(() => f.join('stranger', id), 'JOIN_PENDING');
});

test('ownership can be transferred to a member, and the old owner stays as admin', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  expectCode(
    () => f.command('guest', id, 'room:transfer', { accountId: 'guest' }),
    'FORBIDDEN'
  );
  f.command('owner', id, 'room:transfer', { accountId: 'guest' });
  const room = f.service.read(identities.guest, id);
  assert.equal(room.ownerAccountId, 'guest');
  assert.equal(room.myRole, 'owner');
  assert.equal(f.service.read(identities.owner, id).myRole, 'admin');
});

test('people delete their own messages; managers can delete anyone’s', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  const mine = f.command('guest', id, 'chat:message', {
    content: '我的',
  }).message;
  const owners = f.command('owner', id, 'chat:message', {
    content: '房主',
  }).message;
  expectCode(
    () => f.command('guest', id, 'chat:delete', { id: owners.id }),
    'FORBIDDEN'
  );
  f.command('guest', id, 'chat:delete', { id: mine.id });
  f.command('owner', id, 'chat:delete', { id: owners.id });
  assert.equal(f.store.messages(id).length, 0);
  assert.ok(f.events.some(([, event]) => event === 'chat:deleted'));
});

test('the playlist can be cleared by managers, and settings carry auto play and member limits', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('guest', id, 'queue:add', {
    title: '一',
    href: '/play?source=fixture&id=1',
  });
  expectCode(() => f.command('guest', id, 'queue:clear'), 'FORBIDDEN');
  f.command('owner', id, 'queue:clear');
  assert.equal(f.store.get(id).queue.length, 0);
  f.command('owner', id, 'room:settings', {
    autoPlay: { enabled: true, mode: 'loop' },
    maxMembers: 2,
  });
  const settings = f.service.read(identities.owner, id).settings;
  assert.deepEqual(settings.autoPlay, { enabled: true, mode: 'loop' });
  assert.equal(settings.maxMembers, 2);
  expectCode(() => f.join('stranger', id), 'ROOM_FULL');
});

test('the room pauses while someone buffers and continues when everyone is ready', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('owner', id, 'play:change', video(100));
  f.advance(10000);
  // 成员没有控制权也能报告缓冲
  f.command('owner', id, 'room:member-permissions', {
    accountId: 'guest',
    permissions: ['chat'],
  });
  f.command('guest', id, 'play:buffering', { buffering: true });
  let state = f.store.get(id).currentState;
  assert.equal(state.isPlaying, false);
  assert.equal(state.autoPaused, true);
  assert.deepEqual(state.waitingFor, ['guest']);
  assert.equal(state.currentTime, 110);
  f.command('owner', id, 'play:buffering', { buffering: true });
  assert.deepEqual(f.store.get(id).currentState.waitingFor, ['guest', 'owner']);
  f.advance(3000);
  f.command('guest', id, 'play:buffering', { buffering: false });
  assert.equal(f.store.get(id).currentState.isPlaying, false);
  f.command('owner', id, 'play:buffering', { buffering: false });
  state = f.store.get(id).currentState;
  assert.equal(state.isPlaying, true);
  assert.equal(state.currentTime, 110);
  assert.equal(state.autoPaused, undefined);
});

test('a manual pause is never resumed by buffering, and waiting stops after 30 seconds', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('owner', id, 'play:change', video(10));
  f.command('owner', id, 'play:pause', { currentTime: 10 });
  f.command('guest', id, 'play:buffering', { buffering: true });
  assert.equal(f.store.get(id).currentState.waitingFor, undefined);
  f.command('owner', id, 'play:play', { currentTime: 10 });
  f.command('guest', id, 'play:buffering', { buffering: true });
  assert.equal(f.store.get(id).currentState.isPlaying, false);
  f.advance(30000);
  f.service.tick();
  const state = f.store.get(id).currentState;
  assert.equal(state.isPlaying, true);
  assert.equal(state.waitingFor, undefined);
});

test('waiting for buffering can be turned off in the room settings', (t) => {
  const f = setup(t);
  const id = createAndHost(f);
  f.join('guest', id);
  f.command('owner', id, 'room:settings', { waitForBuffering: false });
  f.command('owner', id, 'play:change', video(10));
  f.command('guest', id, 'play:buffering', { buffering: true });
  assert.equal(f.store.get(id).currentState.isPlaying, true);
});

test('legacy room data is wiped exactly once when the rebuilt rooms start', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tongmutvplus-room-reset-')
  );
  const filename = path.join(directory, 'test.sqlite');
  try {
    // 旧版本留下的数据库：有房间、没有版本记录
    const Database = require('better-sqlite3');
    const legacy = new Database(filename);
    legacy.exec(
      fs.readFileSync(
        path.join(__dirname, '../migrations/013_persistent_rooms.sql'),
        'utf8'
      )
    );
    const insert = legacy.prepare(
      "INSERT INTO watch_rooms (id,owner_account_id,name,description,password_hash,is_public,room_type,settings_json,state_json,queue_json,revision,controller_epoch,created_at,updated_at,empty_since,lifecycle,archived_at) VALUES (?,'owner','旧房间','',NULL,1,'movie','{}',NULL,'[]',1,0,1,1,NULL,'active',NULL)"
    );
    insert.run('old-room');
    legacy.close();

    const db = openRoomStore(filename);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM watch_rooms').get().n,
      0
    );
    db.prepare(
      "INSERT INTO watch_rooms (id,owner_account_id,name,description,password_hash,is_public,room_type,settings_json,state_json,queue_json,revision,controller_epoch,created_at,updated_at,empty_since,lifecycle,archived_at) VALUES ('new-room','owner','新房间','',NULL,1,'movie','{}',NULL,'[]',1,0,1,1,NULL,'active',NULL)"
    ).run();
    db.close();

    const reopened = openRoomStore(filename);
    assert.deepEqual(
      reopened
        .prepare('SELECT id FROM watch_rooms')
        .all()
        .map((row) => row.id),
      ['new-room']
    );
    reopened.close();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
