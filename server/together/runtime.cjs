'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { getTogetherConfig } = require('./config.cjs');
const { TogetherStore } = require('./store.cjs');
const { RoomMediaStore } = require('./media-store.cjs');
const { TogetherBridge } = require('./bridge.cjs');
const { SyncTvUpstream } = require('./upstream.cjs');
const { TicketLeases } = require('./tickets.cjs');
const { registerTogetherLifecycle } = require('./lifecycle.cjs');
const SLOT = Symbol.for('tongmu.together.runtime.v1');
function readKey(directory, explicit) {
  if (explicit) return explicit;
  const file = path.join(directory, 'together-key');
  try {
    fs.writeFileSync(file, crypto.randomBytes(32).toString('hex') + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const key = fs.readFileSync(file, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error('Invalid persisted together encryption key');
  return key;
}
function createTogetherRuntime({
  config = getTogetherConfig(),
  upstream,
} = {}) {
  if (config.mode === 'legacy') return null;
  const directory = path.resolve(config.dataDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const key = readKey(directory, config.encryptionKey);
  const Database = require('better-sqlite3');
  const database = new Database(path.join(directory, 'together.db'));
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  const store = new TogetherStore(database, { encryptionKey: key }),
    tickets = new TicketLeases(),
    connections = new Set();
  upstream ||= new SyncTvUpstream({
    baseUrl: config.internalUrl,
    adminUsername: config.adminUsername,
    adminPassword: config.adminPassword,
  });
  const bridge = new TogetherBridge({
    store,
    upstream,
    validate: (p) => p.revalidate(),
    onRevoke(accountId, sessionId) {
      tickets.revoke(accountId, sessionId);
      for (const entry of [...connections])
        if (
          entry.principal.accountId === accountId &&
          (!sessionId || entry.principal.sessionId === sessionId)
        ) {
          connections.delete(entry);
          entry.close();
        }
    },
  });
  let checking = false,
    closed = false;
  const timer = setInterval(async () => {
    if (checking || closed) return;
    checking = true;
    try {
      for (const entry of [...connections]) {
        let valid = false;
        try {
          valid = !!(await entry.principal.revalidate());
        } catch {}
        if (!valid) {
          connections.delete(entry);
          entry.close();
        }
      }
      await bridge.flushRevocations();
    } finally {
      checking = false;
    }
  }, 5000);
  timer.unref();
  return {
    config,
    store,
    mediaStore: new RoomMediaStore(store),
    bridge,
    tickets,
    track(principal, close) {
      const entry = { principal, close };
      connections.add(entry);
      return () => connections.delete(entry);
    },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      for (const entry of connections) entry.close();
      connections.clear();
      database.close();
    },
  };
}
function getTogetherRuntime() {
  if (!globalThis[SLOT]) {
    const runtime = createTogetherRuntime();
    globalThis[SLOT] = { runtime };
    if (runtime) registerTogetherLifecycle(revokeTogether);
  }
  return globalThis[SLOT].runtime;
}
function revokeTogether(accountId, { sessionId, deleted = false } = {}) {
  const runtime = getTogetherRuntime();
  if (!runtime) return;
  if (deleted) runtime.bridge.revokeAccount(accountId);
  else if (sessionId) runtime.bridge.revokeSession(accountId, sessionId);
  else runtime.bridge.revokeAccountSessions(accountId);
}
module.exports = { createTogetherRuntime, getTogetherRuntime, revokeTogether };
