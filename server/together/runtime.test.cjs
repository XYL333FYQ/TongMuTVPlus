'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { createTogetherRuntime } = require('./runtime.cjs');
test('legacy runtime does not create databases or read secrets', () => {
  assert.equal(createTogetherRuntime({ config: { mode: 'legacy' } }), null);
});
test('runtime persists encrypted identities with durable key and revokes active connections', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tongmu-runtime-'));
  let runtime;
  try {
    const config = {
      mode: 'synctv',
      internalUrl: 'http://localhost:8080',
      adminUsername: 'root',
      adminPassword: 'secret',
      dataDirectory: directory,
    };
    const upstream = { logout: async () => {} };
    runtime = createTogetherRuntime({ config, upstream });
    const id = runtime.store.identity('alice', '1').id;
    const reference = runtime.mediaStore.create({
      roomId: 'room_one',
      ownerIdentityId: id,
      source: 'catalog',
      filmId: 'film-1',
      episodeIndex: 0,
      kind: 'movie',
      requestId: 'runtime-persistence',
    });
    const principal = {
      accountId: 'alice',
      incarnation: '1',
      sessionId: 'a',
      expiresAt: Date.now() + 10000,
      revalidate: async () => principal,
    };
    let closed = 0;
    runtime.track(principal, () => {
      closed++;
    });
    runtime.bridge.revokeSession('alice', 'b');
    assert.equal(closed, 0);
    runtime.bridge.revokeSession('alice', 'a');
    assert.equal(closed, 1);
    runtime.close();
    runtime = createTogetherRuntime({ config, upstream });
    assert.equal(runtime.store.identity('alice', '1').id, id);
    assert.equal(runtime.mediaStore.get(reference.id).filmId, 'film-1');
    runtime.close();
    assert(fs.existsSync(path.join(directory, 'together-key')));
    assert(fs.existsSync(path.join(directory, 'together.db')));
  } finally {
    runtime?.close();
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(os.tmpdir())
    );
    assert(path.basename(directory).startsWith('tongmu-runtime-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
