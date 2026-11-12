'use strict';
const crypto = require('node:crypto');

class TogetherStore {
  constructor(db, { encryptionKey, now = Date.now } = {}) {
    if (!/^[a-f0-9]{64}$/i.test(encryptionKey || ''))
      throw new Error('Together encryption key must contain 32 bytes in hex');
    this.db = db;
    this.key = Buffer.from(encryptionKey, 'hex');
    this.now = now;
    db.exec(`
      CREATE TABLE IF NOT EXISTS together_identities (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, incarnation TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE, secret TEXT NOT NULL, upstream_user_id TEXT,
        revoked_at INTEGER, created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS together_active_account ON together_identities(account_id) WHERE revoked_at IS NULL;
      CREATE TABLE IF NOT EXISTS together_cleanup (id TEXT PRIMARY KEY, secret TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS together_sessions (
        id TEXT PRIMARY KEY, identity_id TEXT NOT NULL, site_token_id TEXT NOT NULL,
        secret TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER,
        upstream_revoked INTEGER NOT NULL DEFAULT 0,
        UNIQUE(identity_id, site_token_id)
      );
    `);
  }
  seal(value, context) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const data = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), data]
      .map((v) => v.toString('base64url'))
      .join('.');
  }
  open(value, context) {
    const parts = value.split('.').map((v) => Buffer.from(v, 'base64url'));
    if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16)
      throw new Error('Invalid encrypted together credential');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, parts[0]);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(parts[1]);
    return JSON.parse(
      Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString(
        'utf8'
      )
    );
  }
  identity(accountId, incarnation) {
    if (!accountId || !incarnation)
      throw new Error('Account and incarnation are required');
    return this.db.transaction(() => {
      let row = this.db
        .prepare(
          'SELECT * FROM together_identities WHERE account_id = ? AND revoked_at IS NULL'
        )
        .get(accountId);
      if (row && row.incarnation !== incarnation) {
        this.revokeAccount(accountId);
        row = null;
      }
      if (!row) {
        const id = crypto.randomUUID();
        const username = 'tm_' + id.replaceAll('-', '');
        const secret = this.seal(
          { password: 'Aa9!' + crypto.randomBytes(48).toString('base64url') },
          id
        );
        this.db
          .prepare(
            'INSERT INTO together_identities(id,account_id,incarnation,username,secret,created_at) VALUES(?,?,?,?,?,?)'
          )
          .run(id, accountId, incarnation, username, secret, this.now());
        row = this.db
          .prepare('SELECT * FROM together_identities WHERE id = ?')
          .get(id);
      }
      return {
        id: row.id,
        username: row.username,
        upstreamUserId: row.upstream_user_id,
        ...this.open(row.secret, row.id),
      };
    })();
  }
  bindUser(identityId, upstreamUserId) {
    if (!upstreamUserId) throw new Error('Upstream user id required');
    const result = this.db
      .prepare(
        'UPDATE together_identities SET upstream_user_id = ? WHERE id = ? AND revoked_at IS NULL'
      )
      .run(upstreamUserId, identityId);
    if (!result.changes) throw new Error('Together identity revoked');
  }
  saveSession(identityId, siteTokenId, credentials, expiresAt) {
    if (!siteTokenId || !Number.isFinite(expiresAt))
      throw new Error('Invalid together session');
    const id = crypto.randomUUID();
    const secret = this.seal(credentials, identityId + ':' + siteTokenId);
    const result = this.db
      .prepare(
        `
      INSERT INTO together_sessions(id,identity_id,site_token_id,secret,expires_at)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM together_identities WHERE id = ? AND revoked_at IS NULL)
      ON CONFLICT(identity_id,site_token_id) DO UPDATE SET secret=excluded.secret,expires_at=excluded.expires_at,revoked_at=NULL,upstream_revoked=0
      WHERE together_sessions.revoked_at IS NULL
    `
      )
      .run(id, identityId, siteTokenId, secret, expiresAt, identityId);
    if (!result.changes)
      throw new Error('Together identity or session revoked');
    return this.session(identityId, siteTokenId);
  }
  session(identityId, siteTokenId) {
    const row = this.db
      .prepare(
        `
      SELECT s.* FROM together_sessions s JOIN together_identities i ON i.id=s.identity_id
      WHERE s.identity_id=? AND s.site_token_id=? AND s.revoked_at IS NULL AND i.revoked_at IS NULL AND s.expires_at>?
    `
      )
      .get(identityId, siteTokenId, this.now());
    return row
      ? {
          id: row.id,
          expiresAt: row.expires_at,
          credentials: this.open(row.secret, identityId + ':' + siteTokenId),
        }
      : null;
  }
  revokeSession(accountId, siteTokenId) {
    this.db
      .prepare(
        `UPDATE together_sessions SET revoked_at=? WHERE site_token_id=? AND identity_id IN
      (SELECT id FROM together_identities WHERE account_id=?) AND revoked_at IS NULL`
      )
      .run(this.now(), siteTokenId, accountId);
  }
  revokeAccountSessions(accountId) {
    this.db
      .prepare(
        `UPDATE together_sessions SET revoked_at=? WHERE identity_id IN
      (SELECT id FROM together_identities WHERE account_id=?) AND revoked_at IS NULL`
      )
      .run(this.now(), accountId);
  }
  queueRevocation(credentials) {
    const id = crypto.randomUUID();
    this.db
      .prepare('INSERT INTO together_cleanup(id,secret) VALUES(?,?)')
      .run(id, this.seal(credentials, id));
  }
  revokeAccount(accountId) {
    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE together_sessions SET revoked_at=? WHERE identity_id IN
        (SELECT id FROM together_identities WHERE account_id=?) AND revoked_at IS NULL`
        )
        .run(this.now(), accountId);
      this.db
        .prepare(
          'UPDATE together_identities SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL'
        )
        .run(this.now(), accountId);
    })();
  }
  pendingRevocations() {
    return this.db
      .prepare(
        'SELECT * FROM together_sessions WHERE revoked_at IS NOT NULL AND upstream_revoked=0'
      )
      .all()
      .map((row) => ({
        id: row.id,
        credentials: this.open(
          row.secret,
          row.identity_id + ':' + row.site_token_id
        ),
      }))
      .concat(
        this.db
          .prepare('SELECT * FROM together_cleanup')
          .all()
          .map((row) => ({
            id: row.id,
            credentials: this.open(row.secret, row.id),
          }))
      );
  }
  completeRevocation(id) {
    this.db.prepare('DELETE FROM together_cleanup WHERE id=?').run(id);
    this.db
      .prepare(
        "UPDATE together_sessions SET upstream_revoked=1,secret='' WHERE id=? AND revoked_at IS NOT NULL"
      )
      .run(id);
  }
}
module.exports = { TogetherStore };
