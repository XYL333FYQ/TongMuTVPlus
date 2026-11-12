'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  Database = require('better-sqlite3');
const { TogetherStore } = require('./store.cjs');
const { TogetherBridge } = require('./bridge.cjs');
function fixture() {
  const db = new Database(':memory:');
  const store = new TogetherStore(db, { encryptionKey: '07'.repeat(32) });
  const calls = [];
  let banned = false;
  const upstream = {
    async createUser(identity) {
      calls.push(['create', identity.username]);
      return { id: 'usr_' + identity.id.replaceAll('-', '') };
    },
    async login(username) {
      calls.push(['login', username]);
      return {
        accessToken: 'token-' + username,
        refreshToken: 'refresh-' + username,
      };
    },
    async request(method, path, body, token) {
      calls.push(['request', path, token]);
      return { ticket: 'once' };
    },
    async refresh() {
      return { accessToken: 'refreshed', refreshToken: 'new-refresh' };
    },
    async logout(credentials) {
      calls.push(['logout', credentials.accessToken]);
    },
  };
  const bridge = new TogetherBridge({
    store,
    upstream,
    validate: async (p) => (!banned ? p : null),
  });
  const principal = {
    accountId: 'alice',
    incarnation: 'created-1',
    sessionId: 'device-a',
    expiresAt: Date.now() + 60000,
  };
  return {
    db,
    store,
    upstream,
    calls,
    bridge,
    principal,
    ban: () => {
      banned = true;
    },
  };
}
test('concurrent requests provision exactly one ordinary identity and one per-device session', async () => {
  const f = fixture();
  await Promise.all([
    f.bridge.describe(f.principal),
    f.bridge.describe(f.principal),
  ]);
  assert.equal(f.calls.filter((c) => c[0] === 'create').length, 1);
  assert.equal(f.calls.filter((c) => c[0] === 'login').length, 1);
  const dto = await f.bridge.describe(f.principal);
  assert(!JSON.stringify(dto).includes('token-'));
  assert(!('password' in dto));
  await f.bridge.describe({ ...f.principal, sessionId: 'device-b' });
  assert.equal(f.calls.filter((c) => c[0] === 'login').length, 2);
  f.db.close();
});
test('room requests use individual credentials and never privileged credentials', async () => {
  const f = fixture();
  await f.bridge.request(f.principal, 'POST', '/api/tickets', {
    roomId: 'room_1',
  });
  const request = f.calls.find((c) => c[0] === 'request');
  assert(request[2].startsWith('token-tm_'));
  const first = await f.bridge.describe(f.principal),
    second = await f.bridge.describe({ ...f.principal, accountId: 'bob' });
  assert.notEqual(first.identityId, second.identityId);
  f.db.close();
});
test('unauthorized or banned sessions cannot provision users or receive late login responses', async () => {
  const f = fixture();
  f.ban();
  await assert.rejects(f.bridge.describe(f.principal), /Unauthorized/);
  assert.equal(f.calls.length, 0);
  f.db.close();
  const g = fixture();
  const original = g.upstream.login;
  g.upstream.login = async (...args) => {
    const r = await original(...args);
    g.ban();
    return r;
  };
  await assert.rejects(g.bridge.describe(g.principal), /Unauthorized/);
  assert.equal(
    g.db.prepare('SELECT count(*) AS n FROM together_sessions').get().n,
    0
  );
  g.db.close();
});
test('logout revokes locally before asynchronous upstream cleanup and leaves other devices intact', async () => {
  const f = fixture();
  await f.bridge.describe(f.principal);
  await f.bridge.describe({ ...f.principal, sessionId: 'device-b' });
  f.bridge.revokeSession('alice', 'device-a');
  const id = f.store.identity('alice', 'created-1').id;
  assert.equal(f.store.session(id, 'device-a'), null);
  assert(f.store.session(id, 'device-b'));
  await f.bridge.flushRevocations();
  assert(f.calls.some((c) => c[0] === 'logout'));
  assert.equal(f.store.pendingRevocations().length, 0);
  await assert.rejects(f.bridge.describe(f.principal), /revoked/i);
  f.db.close();
});

test('late login cleanup is durable when upstream is unreachable', async () => {
  const f = fixture();
  const login = f.upstream.login;
  f.upstream.login = async (...args) => {
    const result = await login(...args);
    f.ban();
    return result;
  };
  f.upstream.logout = async () => {
    throw new Error('offline');
  };
  await assert.rejects(f.bridge.describe(f.principal), /Unauthorized/);
  assert.equal(f.store.pendingRevocations().length, 1);
  await f.bridge.flushRevocations();
  assert.equal(f.store.pendingRevocations().length, 1);
  f.upstream.logout = async () => {};
  await f.bridge.flushRevocations();
  assert.equal(f.store.pendingRevocations().length, 0);
  f.db.close();
});
