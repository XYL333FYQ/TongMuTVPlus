'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { createPrincipalResolver } = require('./principal.cjs');
function fixture() {
  let auth = {
    username: 'alice',
    role: 'user',
    tokenId: 'device',
    refreshToken: 'secret',
    refreshExpires: Date.now() + 100000,
  };
  let user = { role: 'user', banned: false, created_at: 1 };
  let valid = true;
  const resolve = createPrincipalResolver({
    authenticate: async () => auth,
    getUser: async () => user,
    verifySession: async () => valid,
    ownerUsername: 'root',
  });
  return {
    resolve,
    setAuth: (v) => {
      auth = v;
    },
    setUser: (v) => {
      user = v;
    },
    invalidate: () => {
      valid = false;
    },
  };
}
test('principal requires signed auth, durable device session and live account', async () => {
  const f = fixture();
  const p = await f.resolve();
  assert.equal(p.accountId, 'alice');
  assert.equal(p.sessionId, 'device');
  f.setUser(null);
  assert.equal(await f.resolve(), null);
  f.setUser({ role: 'user', created_at: 1, banned: true });
  assert.equal(await f.resolve(), null);
  f.setUser({ role: 'admin', created_at: 1, banned: false });
  assert.equal(await f.resolve(), null);
  f.setAuth(null);
  assert.equal(await f.resolve(), null);
});
test('revalidation refuses deleted/recreated users and revoked devices', async () => {
  const f = fixture(),
    p = await f.resolve();
  f.setUser({ role: 'user', banned: false, created_at: 2 });
  assert.equal(await p.revalidate(), null);
  const g = fixture(),
    q = await g.resolve();
  g.invalidate();
  assert.equal(await q.revalidate(), null);
});
test('configured owner is checked independently and local password-only mode is rejected', async () => {
  const f = fixture();
  f.setAuth({ password: 'shared' });
  assert.equal(await f.resolve(), null);
  f.setAuth({
    username: 'root',
    role: 'owner',
    tokenId: 'd',
    refreshToken: 's',
    refreshExpires: Date.now() + 10000,
  });
  const p = await f.resolve();
  assert.equal(p.accountId, 'root');
  f.setAuth({
    username: 'alice',
    role: 'owner',
    tokenId: 'd',
    refreshToken: 's',
    refreshExpires: Date.now() + 10000,
  });
  assert.equal(await f.resolve(), null);
});
