'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createServer, request } = require('node:http');
const { once } = require('node:events');
const Database = require('better-sqlite3');
const { backup, restore, inspect } = require('./sqlite-maintenance.cjs');
const { openRoomStore, RoomStore } = require('../../server/room-store');
const { RoomService } = require('../../server/room-service');
const { createHealthHandler } = require('../../server/room-health');

function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tongmutvplus-recovery-')
  );
  const source = path.join(directory, 'live.db');
  const db = openRoomStore(source);
  db.exec(
    'CREATE TABLE users (username TEXT PRIMARY KEY, role TEXT, banned INTEGER DEFAULT 0); CREATE TABLE global_config (key TEXT PRIMARY KEY,value TEXT,updated_at INTEGER)'
  );
  const privateValue = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO users (username,role) VALUES (?,?)').run(
    'recovery-owner',
    'owner'
  );
  db.prepare(
    'INSERT INTO global_config (key,value,updated_at) VALUES (?,?,?)'
  ).run('private-config', privateValue, Date.now());
  const store = new RoomStore(db);
  const service = new RoomService(store, { config: { ownerReadyMs: 0 } });
  const identity = { accountId: 'recovery-owner', role: 'owner' };
  const room = service.create(identity, { name: '恢复演练', isPublic: false });
  service.join(identity, room.id, {}, 'recovery-session');
  service.ready('recovery-session', { revision: room.revision });
  service.execute(identity, room.id, 'queue:add', {
    title: '队列恢复',
    href: '/play?source=fixture&id=1',
  });
  const message = service.execute(identity, room.id, 'chat:message', {
    content: '应恢复的消息',
    type: 'text',
  }).message;
  service.execute(identity, room.id, 'chat:read', { seq: message.seq });
  service.execute(
    identity,
    room.id,
    'play:change',
    {
      type: 'play',
      videoId: '1',
      videoName: '恢复影片',
      source: 'fixture',
      url: 'https://example.test/video.mp4',
      currentTime: 123,
      isPlaying: true,
    },
    {},
    'recovery-session'
  );
  t.after(() => {
    if (db.open) db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    source,
    db,
    store,
    service,
    identity,
    room,
    privateValue,
  };
}

test('online backup includes WAL state and isolated recovery preserves ownership, media, chat and cursor', async (t) => {
  const f = fixture(t);
  assert.ok(fs.statSync(`${f.source}-wal`).size > 0);
  const output = path.join(f.directory, 'backup.sqlite');
  const report = await backup({ dbPath: f.source, output });
  assert.equal(report.integrity, 'ok');
  assert.equal(report.counts.watch_rooms, 1);
  assert.equal(JSON.stringify(report).includes(f.privateValue), false);
  f.db
    .prepare('INSERT INTO users (username,role) VALUES (?,?)')
    .run('after-backup', 'user');
  const target = path.join(f.directory, 'isolated', 'restored.db');
  const restored = restore({ backupPath: output, dbPath: target });
  assert.equal(restored.integrity, 'ok');
  assert.equal(restored.sha256, report.sha256);
  const db = openRoomStore(target);
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    assert.equal(
      db
        .prepare('SELECT value FROM global_config WHERE key = ?')
        .get('private-config').value,
      f.privateValue
    );
    const service = new RoomService(new RoomStore(db));
    const room = service.read(f.identity, f.room.id);
    assert.equal(room.ownerAccountId, 'recovery-owner');
    assert.equal(room.queue[0].title, '队列恢复');
    assert.equal(room.currentState.currentTime, 123);
    assert.equal(room.currentState.isPlaying, false);
    assert.equal(
      service.history(f.identity, f.room.id, 0, 100)[0].content,
      '应恢复的消息'
    );
    assert.equal(service.store.unread(f.room.id, f.identity.accountId), 0);
    assert.equal(service.store.lastSeq(f.room.id), f.store.lastSeq(f.room.id));
  } finally {
    db.close();
  }
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
});

test('restore refuses accidental overwrite, verifies checksum and preserves a rollback copy', async (t) => {
  const f = fixture(t);
  const output = path.join(f.directory, 'backup.sqlite');
  await backup({ dbPath: f.source, output });
  const target = path.join(f.directory, 'existing.db');
  const old = new Database(target);
  old.exec(
    "CREATE TABLE previous (value TEXT); INSERT INTO previous VALUES ('keep-me')"
  );
  old.close();
  assert.throws(
    () => restore({ backupPath: output, dbPath: target }),
    /Stop the service/
  );
  assert.throws(
    () =>
      restore({ backupPath: output, dbPath: target, replaceExisting: true }),
    /Stop the service/
  );
  const report = restore({
    backupPath: output,
    dbPath: target,
    replaceExisting: true,
    serviceStopped: true,
  });
  assert.ok(report.rollbackDirectory);
  const rollback = new Database(
    path.join(report.rollbackDirectory, 'existing.db'),
    { readonly: true }
  );
  try {
    assert.equal(
      rollback.prepare('SELECT value FROM previous').get().value,
      'keep-me'
    );
  } finally {
    rollback.close();
  }
  const manifest = JSON.parse(
    fs.readFileSync(`${output}.manifest.json`, 'utf8')
  );
  fs.writeFileSync(
    `${output}.manifest.json`,
    JSON.stringify({ ...manifest, sha256: 'invalid' })
  );
  assert.throws(
    () =>
      restore({ backupPath: output, dbPath: path.join(f.directory, 'bad.db') }),
    /checksum/
  );
  assert.equal(fs.existsSync(path.join(f.directory, 'bad.db')), false);
  assert.equal(inspect(target).counts.watch_rooms, 1);
});

test('health readiness verifies required SQLite and returns only safe deployment metadata', (t) => {
  const f = fixture(t);
  const state = {
    roomsRequired: true,
    roomDatabase: f.db,
    roomService: f.service,
  };
  const handler = createHealthHandler(() => state, {
    buildSha: 'fixture-commit',
  });
  function call(url, method = 'GET') {
    const response = {
      status: 0,
      body: '',
      writeHead(status) {
        this.status = status;
      },
      end(body) {
        this.body = body || '';
      },
    };
    assert.equal(handler({ url, method }, response), true);
    return response;
  }
  const live = call('/health');
  assert.equal(live.status, 200);
  assert.equal(JSON.parse(live.body).buildSha, 'fixture-commit');
  const ready = call('/health/ready');
  assert.equal(ready.status, 200);
  for (const secret of [f.source, f.privateValue, f.identity.accountId])
    assert.equal(ready.body.includes(secret), false);
  state.roomService = null;
  assert.equal(call('/health/ready').status, 503);
  assert.equal(call('/health').status, 200);
  assert.equal(call('/health', 'POST').status, 405);
  assert.equal(call('/health', 'HEAD').body, '');
});

test('health endpoints respond over HTTP and readiness fails after database closes', async (t) => {
  const f = fixture(t);
  const health = createHealthHandler(
    () => ({ roomsRequired: true, roomDatabase: f.db, roomService: f.service }),
    { buildSha: 'http-fixture' }
  );
  const server = createServer((req, res) => {
    if (!health(req, res)) {
      res.statusCode = 404;
      res.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const get = (pathname) =>
      new Promise((resolve, reject) => {
        const req = request(
          {
            host: '127.0.0.1',
            port: server.address().port,
            path: pathname,
            agent: false,
          },
          (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () =>
              resolve({
                status: res.statusCode,
                body: JSON.parse(Buffer.concat(chunks).toString()),
              })
            );
          }
        );
        req.on('error', reject);
        req.end();
      });
    const ready = await get('/health/ready');
    assert.equal(ready.status, 200);
    assert.equal(ready.body.buildSha, 'http-fixture');
    f.db.close();
    assert.equal((await get('/health/ready')).status, 503);
    assert.equal((await get('/health')).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
