'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { TogetherStore } = require('./store.cjs');
const key = Buffer.alloc(32, 7).toString('hex');
const fixture = () => {
  const db = new Database(':memory:');
  return { db, store: new TogetherStore(db, { encryptionKey: key }) };
};
test('encrypted identity is durable and unique', () => {
  const { db, store } = fixture();
  const a = store.identity('alice', '1');
  assert.equal(a.id, store.identity('alice', '1').id);
  assert.notEqual(a.id, store.identity('bob', '1').id);
  assert.equal(
    new TogetherStore(db, { encryptionKey: key }).identity('alice', '1')
      .password,
    a.password
  );
  assert(
    !JSON.stringify(
      db.prepare('SELECT * FROM together_identities').all()
    ).includes(a.password)
  );
  db.close();
});
test('account recreation never reuses identity and late replies cannot revive it', () => {
  const { db, store } = fixture();
  const a = store.identity('alice', '1');
  store.revokeAccount('alice');
  assert.notEqual(a.id, store.identity('alice', '1').id);
  assert.notEqual(a.id, store.identity('alice', '2').id);
  assert.throws(
    () =>
      store.saveSession(a.id, 'late', { accessToken: 'x' }, Date.now() + 10000),
    /revoked/i
  );
  db.close();
});
test('device sessions are encrypted and independently revocable', () => {
  const { db, store } = fixture();
  const a = store.identity('alice', '1');
  const credentials = {
    accessToken: 'private-access',
    refreshToken: 'private-refresh',
  };
  for (const id of ['a', 'b'])
    store.saveSession(a.id, id, credentials, Date.now() + 10000);
  assert.deepEqual(store.session(a.id, 'a').credentials, credentials);
  assert(
    !JSON.stringify(
      db.prepare('SELECT * FROM together_sessions').all()
    ).includes('private-access')
  );
  store.revokeSession('alice', 'a');
  assert.equal(store.session(a.id, 'a'), null);
  assert(store.session(a.id, 'b'));
  store.revokeAccount('alice');
  assert.equal(store.session(a.id, 'b'), null);
  db.close();
});
test('expired sessions and wrong keys fail closed', () => {
  const { db, store } = fixture();
  const a = store.identity('alice', '1');
  store.saveSession(a.id, 'expired', { accessToken: 'x' }, Date.now() - 1);
  assert.equal(store.session(a.id, 'expired'), null);
  assert.throws(() =>
    new TogetherStore(db, {
      encryptionKey: Buffer.alloc(32, 8).toString('hex'),
    }).identity('alice', '1')
  );
  assert.throws(
    () => new TogetherStore(db, { encryptionKey: '' }),
    /encryption/i
  );
  db.close();
});

test('disable revokes sessions without replacing identity and orphan cleanup survives restart', () => {
  const { db, store } = fixture();
  const a = store.identity('alice', '1');
  store.saveSession(a.id, 'a', { accessToken: 'private' }, Date.now() + 10000);
  store.revokeAccountSessions('alice');
  assert.equal(store.session(a.id, 'a'), null);
  assert.equal(store.identity('alice', '1').id, a.id);
  store.queueRevocation({
    accessToken: 'late-private',
    refreshToken: 'late-refresh',
  });
  const restarted = new TogetherStore(db, { encryptionKey: key });
  assert.equal(restarted.pendingRevocations().length, 2);
  assert(
    !JSON.stringify(
      db.prepare('SELECT * FROM together_cleanup').all()
    ).includes('late-private')
  );
  for (const row of restarted.pendingRevocations())
    restarted.completeRevocation(row.id);
  assert.equal(restarted.pendingRevocations().length, 0);
  db.close();
});
