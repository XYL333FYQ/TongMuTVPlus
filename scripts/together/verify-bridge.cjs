'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const { parseEnv } = require('node:util');
const envFile = process.argv[2];
if (!envFile)
  throw new Error(
    'Usage: node scripts/together/verify-bridge.cjs <isolated-env-file>'
  );
const env = parseEnv(fs.readFileSync(envFile, 'utf8'));
if (env.TOGETHER_TEST_ISOLATED !== 'true' || env.TOGETHER_BACKEND !== 'synctv')
  throw new Error('Explicit isolated SyncTV test environment required');
const base =
  env.TOGETHER_TEST_ORIGIN || 'http://127.0.0.1:' + (env.PORT || 18300);
const target = new URL(base);
if (
  target.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
  target.pathname !== '/' ||
  target.search ||
  target.hash
)
  throw new Error('Only an isolated loopback site may be tested');
const {
  synctv,
} = require('../../src/features/rooms/synctv/protocol/client.js');
const engine = require.resolve('engine.io', {
  paths: [require.resolve('socket.io')],
});
const WS = require(require.resolve('ws', { paths: [engine] }));
fs.mkdirSync(path.resolve('output/synctv-implementation'), { recursive: true });
const results = [];
const sockets = new Set();
let cleanupOwner, cleanupRoom, cleanupUser;
async function request(url, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data };
}
async function login(username, password) {
  const { response } = await request('/api/login', {
    method: 'POST',
    body: { username, password },
  });
  assert.equal(response.status, 200, 'site login failed');
  const cookie = response.headers
    .getSetCookie()
    .filter((c) => c.startsWith('auth='))
    .map((c) => c.split(';')[0])
    .join('; ');
  assert(cookie);
  return cookie;
}
async function ok(url, options) {
  const result = await request(url, options);
  assert.equal(
    result.response.status,
    200,
    url +
      ' failed, status ' +
      result.response.status +
      ' code ' +
      (result.data.code || result.data.error || '')
  );
  return result.data;
}
function timed(promise, description, milliseconds = 10000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Timed out: ' + description)),
        milliseconds
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
async function connect(cookie, roomId) {
  const { ticket } = await ok('/api/together/tickets', {
    cookie,
    method: 'POST',
    body: { roomId },
  });
  const ws = new WS(
    base.replace('http:', 'ws:') +
      '/sync/ws/' +
      roomId +
      '?ticket=' +
      encodeURIComponent(ticket),
    { headers: { Cookie: cookie, Origin: base } }
  );
  sockets.add(ws);
  ws.once('close', () => sockets.delete(ws));
  const messages = [];
  ws.on('message', (data) => {
    messages.push(synctv.client.ServerMessage.decode(data));
  });
  await timed(
    new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    }),
    'websocket open'
  );
  const timestamp = Date.now();
  await timed(
    new Promise((resolve, reject) => {
      const listener = (data) => {
        try {
          if (
            Number(
              synctv.client.ServerMessage.decode(data).heartbeatAck?.timestamp
            ) > 0
          ) {
            ws.off('message', listener);
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      };
      ws.on('message', listener);
      ws.send(
        synctv.client.ClientMessage.encode({
          heartbeat: { timestamp },
        }).finish(),
        { binary: true }
      );
    }),
    'protobuf heartbeat'
  );
  return { ws, messages, ticket };
}
(async () => {
  const anonymous = await request('/api/together/session');
  assert.equal(anonymous.response.status, 401);
  results.push('anonymous rejected');
  const owner = await login(env.USERNAME, env.PASSWORD);
  cleanupOwner = owner;
  const memberName =
      'bridge_accept_' +
      Date.now() +
      '_' +
      crypto.randomBytes(3).toString('hex'),
    memberPassword = 'Aa9' + crypto.randomBytes(20).toString('hex');
  await ok('/api/admin/user', {
    cookie: owner,
    method: 'POST',
    body: {
      action: 'add',
      targetUsername: memberName,
      targetPassword: memberPassword,
    },
  });
  cleanupUser = memberName;
  const member = await login(memberName, memberPassword);
  const first = await ok('/api/together/session', { cookie: owner }),
    second = await ok('/api/together/session', { cookie: member });
  assert.notEqual(first.identityId, second.identityId);
  assert.notEqual(first.upstreamUserId, second.upstreamUserId);
  assert.deepEqual(Object.keys(second).sort(), [
    'displayName',
    'identityId',
    'upstreamUserId',
  ]);
  results.push(
    'two site accounts have distinct ordinary upstream identities and safe DTOs'
  );
  const room = await ok('/api/together/rooms', {
    cookie: owner,
    method: 'POST',
    body: { name: 'Site bridge acceptance ' + Date.now(), isPublic: false },
  });
  assert(room.id?.startsWith('room_'));
  const roomId = room.id;
  cleanupRoom = roomId;
  const outsider = await request('/api/together/tickets', {
    cookie: member,
    method: 'POST',
    body: { roomId },
  });
  assert([401, 403, 404].includes(outsider.response.status));
  results.push('outsider cannot acquire room realtime ticket');
  await ok('/api/together/rooms/' + roomId + '/membership', {
    cookie: member,
    method: 'PUT',
    body: {},
  });
  const denied = await request('/api/together/rooms/' + roomId, {
    cookie: member,
    method: 'DELETE',
  });
  assert.equal(denied.response.status, 403);
  results.push('ordinary member cannot delete owner room');
  const host = await connect(owner, roomId),
    guest = await connect(member, roomId);
  results.push(
    'two site-authenticated sockets complete real SyncTV protobuf heartbeats'
  );
  const closed = timed(
    new Promise((resolve) => guest.ws.once('close', resolve)),
    'logout socket revocation',
    7000
  );
  await ok('/api/logout', { cookie: member, method: 'POST', body: {} });
  await closed;
  assert.equal(
    (await request('/api/together/session', { cookie: member })).response
      .status,
    401
  );
  results.push('site logout revokes bridge access and closes live socket');
  const memberAgain = await login(memberName, memberPassword);
  assert.equal(
    (await ok('/api/together/session', { cookie: memberAgain })).identityId,
    second.identityId
  );
  const bannedConnection = await connect(memberAgain, roomId);
  const banClosed = timed(
    new Promise((resolve) => bannedConnection.ws.once('close', resolve)),
    'ban socket revocation',
    7000
  );
  await ok('/api/admin/user', {
    cookie: owner,
    method: 'POST',
    body: { action: 'ban', targetUsername: memberName },
  });
  await banClosed;
  assert.equal(
    (await request('/api/together/session', { cookie: memberAgain })).response
      .status,
    401
  );
  results.push('site disable revokes all bridge devices and closes socket');
  await ok('/api/admin/user', {
    cookie: owner,
    method: 'POST',
    body: { action: 'deleteUser', targetUsername: memberName },
  });
  await ok('/api/admin/user', {
    cookie: owner,
    method: 'POST',
    body: {
      action: 'add',
      targetUsername: memberName,
      targetPassword: memberPassword,
    },
  });
  const recreated = await login(memberName, memberPassword);
  const third = await ok('/api/together/session', { cookie: recreated });
  assert.notEqual(third.identityId, second.identityId);
  assert.notEqual(third.upstreamUserId, second.upstreamUserId);
  results.push('same-name account recreation cannot inherit upstream identity');
  host.ws.close();
  await ok('/api/together/rooms/' + roomId, {
    cookie: owner,
    method: 'DELETE',
  });
  cleanupRoom = null;
  await ok('/api/admin/user', {
    cookie: owner,
    method: 'POST',
    body: { action: 'deleteUser', targetUsername: memberName },
  });
  cleanupUser = null;
  fs.writeFileSync(
    path.resolve(
      'output/synctv-implementation/bridge-integration-results.json'
    ),
    JSON.stringify({ passed: results.length, results }, null, 2)
  );
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
})()
  .catch((error) => {
    console.error(error.message);
    fs.writeFileSync(
      path.resolve(
        'output/synctv-implementation/bridge-integration-results.json'
      ),
      JSON.stringify(
        { passed: results.length, results, failure: error.message },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const socket of sockets) socket.terminate();
    if (cleanupOwner && cleanupRoom)
      await request('/api/together/rooms/' + cleanupRoom, {
        cookie: cleanupOwner,
        method: 'DELETE',
      }).catch(() => {});
    if (cleanupOwner && cleanupUser)
      await request('/api/admin/user', {
        cookie: cleanupOwner,
        method: 'POST',
        body: { action: 'deleteUser', targetUsername: cleanupUser },
      }).catch(() => {});
  });
