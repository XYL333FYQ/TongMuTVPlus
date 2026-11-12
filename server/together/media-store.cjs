'use strict';
const crypto = require('node:crypto');
const { validRoom } = require('./tickets.cjs');
const string = (value, max = 2048) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  !/[\x00-\x1f]/.test(value);
class RoomMediaStore {
  constructor(identities) {
    this.identities = identities;
    this.db = identities.db;
    this.now = identities.now;
    this.db.exec(`
   CREATE TABLE IF NOT EXISTS together_media_references(
    id TEXT PRIMARY KEY,room_id TEXT NOT NULL,owner_identity_id TEXT NOT NULL,
    source TEXT NOT NULL,film_id TEXT NOT NULL,episode_index INTEGER NOT NULL,kind TEXT NOT NULL,
    request_id TEXT NOT NULL,playlist_id TEXT,metadata TEXT NOT NULL DEFAULT '{}',
    upstream_media_id TEXT,created_at INTEGER NOT NULL,
    UNIQUE(owner_identity_id,room_id,request_id)
   );
   CREATE INDEX IF NOT EXISTS together_media_room ON together_media_references(room_id,upstream_media_id);
   CREATE TABLE IF NOT EXISTS together_media_state(
    ref_id TEXT PRIMARY KEY,generation INTEGER NOT NULL,secret TEXT NOT NULL,expires_at INTEGER NOT NULL
   );
   CREATE TABLE IF NOT EXISTS together_media_resources(
    id TEXT PRIMARY KEY,ref_id TEXT NOT NULL,generation INTEGER NOT NULL,
    fingerprint TEXT NOT NULL,secret TEXT NOT NULL,expires_at INTEGER NOT NULL,
    UNIQUE(ref_id,generation,fingerprint)
   );
   CREATE INDEX IF NOT EXISTS together_media_resource_expiry ON together_media_resources(expires_at);
  `);
  }
  create(input) {
    const {
      roomId,
      ownerIdentityId,
      source,
      filmId,
      episodeIndex,
      kind,
      requestId,
      playlistId = null,
    } = input;
    if (
      !validRoom(roomId) ||
      !string(source) ||
      !string(filmId) ||
      !string(requestId, 128) ||
      !Number.isSafeInteger(episodeIndex) ||
      episodeIndex < 0 ||
      !['movie', 'music', 'live', 'screen'].includes(kind) ||
      (playlistId !== null && !/^pl_[A-Za-z0-9]{1,61}$/.test(playlistId))
    )
      throw new Error('Invalid immutable media reference');
    return this.db.transaction(() => {
      if (
        !this.db
          .prepare(
            'SELECT id FROM together_identities WHERE id=? AND revoked_at IS NULL'
          )
          .get(ownerIdentityId)
      )
        throw new Error('Media creator missing or revoked');
      const existing = this.db
        .prepare(
          'SELECT id FROM together_media_references WHERE owner_identity_id=? AND room_id=? AND request_id=?'
        )
        .get(ownerIdentityId, roomId, requestId);
      if (existing) {
        const ref = this.get(existing.id);
        if (
          !ref ||
          ref.source !== source ||
          ref.filmId !== filmId ||
          ref.episodeIndex !== episodeIndex ||
          ref.kind !== kind ||
          ref.playlistId !== playlistId
        )
          throw Object.assign(new Error('Media reference request conflict'), {
            status: 409,
          });
        return ref;
      }
      const id = 'tmmedia_' + crypto.randomUUID().replaceAll('-', '');
      this.db
        .prepare(
          'INSERT INTO together_media_references(id,room_id,owner_identity_id,source,film_id,episode_index,kind,request_id,playlist_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
        )
        .run(
          id,
          roomId,
          ownerIdentityId,
          source,
          filmId,
          episodeIndex,
          kind,
          requestId,
          playlistId,
          this.now()
        );
      return this.get(id);
    })();
  }
  get(id) {
    const row = this.db
      .prepare(
        `SELECT r.*,i.account_id,i.incarnation FROM together_media_references r JOIN together_identities i ON i.id=r.owner_identity_id
   WHERE r.id=? AND i.revoked_at IS NULL`
      )
      .get(id);
    return row
      ? {
          id: row.id,
          roomId: row.room_id,
          ownerIdentityId: row.owner_identity_id,
          ownerAccountId: row.account_id,
          ownerIncarnation: row.incarnation,
          source: row.source,
          filmId: row.film_id,
          episodeIndex: row.episode_index,
          kind: row.kind,
          requestId: row.request_id,
          playlistId: row.playlist_id,
          metadata: JSON.parse(row.metadata),
          upstreamMediaId: row.upstream_media_id,
          createdAt: row.created_at,
        }
      : null;
  }
  require(id) {
    const ref = this.get(id);
    if (!ref)
      throw Object.assign(
        new Error('Media reference missing or creator revoked'),
        { status: 404 }
      );
    return ref;
  }
  setMetadata(id, metadata) {
    this.require(id);
    const allowed = [
      'title',
      'episodeTitle',
      'format',
      'hasPoster',
      'subtitles',
      'duration',
    ];
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      Object.keys(metadata).some((key) => !allowed.includes(key))
    )
      throw new Error('Invalid public media metadata');
    const safe = {};
    for (const key of ['title', 'episodeTitle']) {
      if (metadata[key] !== undefined) {
        if (typeof metadata[key] !== 'string' || metadata[key].length > 500)
          throw new Error('Invalid media metadata');
        safe[key] = metadata[key];
      }
    }
    if (metadata.format !== undefined) {
      if (!['mp4', 'hls', 'audio', 'flv', 'unknown'].includes(metadata.format))
        throw new Error('Invalid media metadata');
      safe.format = metadata.format;
    }
    if (metadata.hasPoster !== undefined)
      safe.hasPoster = metadata.hasPoster === true;
    if (metadata.duration !== undefined) {
      if (!Number.isFinite(metadata.duration) || metadata.duration < 0)
        throw new Error('Invalid media metadata');
      safe.duration = metadata.duration;
    }
    if (metadata.subtitles !== undefined) {
      if (!Array.isArray(metadata.subtitles) || metadata.subtitles.length > 100)
        throw new Error('Invalid media metadata');
      safe.subtitles = metadata.subtitles.map((item) => {
        if (
          !item ||
          Object.keys(item).some(
            (key) => !['label', 'language', 'format'].includes(key)
          )
        )
          throw new Error('Invalid subtitle metadata');
        const result = {};
        for (const key of ['label', 'language', 'format']) {
          const value = item[key] || '';
          if (typeof value !== 'string' || value.length > 200)
            throw new Error('Invalid subtitle metadata');
          result[key] = value;
        }
        return result;
      });
    }
    this.db
      .prepare('UPDATE together_media_references SET metadata=? WHERE id=?')
      .run(JSON.stringify(safe), id);
  }
  bindMedia(id, mediaId) {
    this.require(id);
    if (!/^med_[A-Za-z0-9]{1,60}$/.test(mediaId))
      throw new Error('Invalid upstream media ID');
    const result = this.db
      .prepare(
        'UPDATE together_media_references SET upstream_media_id=? WHERE id=? AND (upstream_media_id IS NULL OR upstream_media_id=?)'
      )
      .run(mediaId, id, mediaId);
    if (!result.changes)
      throw new Error('Media reference already bound; conflict');
  }
  getByMediaId(roomId, mediaId) {
    const row = this.db
      .prepare(
        'SELECT id FROM together_media_references WHERE room_id=? AND upstream_media_id=?'
      )
      .get(roomId, mediaId);
    return row ? this.get(row.id) : null;
  }
  saveState(id, value, ttlMs = 30000) {
    this.require(id);
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 86400000)
      throw new Error('Invalid media state lifetime');
    return this.db.transaction(() => {
      const previous = this.db
        .prepare('SELECT generation FROM together_media_state WHERE ref_id=?')
        .get(id);
      const generation = (previous?.generation || 0) + 1,
        expiresAt = this.now() + ttlMs;
      const secret = this.identities.seal(value, id + ':state:' + generation);
      this.db
        .prepare(
          'INSERT INTO together_media_state(ref_id,generation,secret,expires_at) VALUES(?,?,?,?) ON CONFLICT(ref_id) DO UPDATE SET generation=excluded.generation,secret=excluded.secret,expires_at=excluded.expires_at'
        )
        .run(id, generation, secret, expiresAt);
      return { generation, expiresAt, value };
    })();
  }
  state(id) {
    if (!this.get(id)) return null;
    const row = this.db
      .prepare(
        'SELECT * FROM together_media_state WHERE ref_id=? AND expires_at>?'
      )
      .get(id, this.now());
    return row
      ? {
          generation: row.generation,
          expiresAt: row.expires_at,
          value: this.identities.open(
            row.secret,
            id + ':state:' + row.generation
          ),
        }
      : null;
  }
  createResource(id, generation, value, ttlMs = 300000) {
    this.require(id);
    const state = this.db
      .prepare('SELECT generation FROM together_media_state WHERE ref_id=?')
      .get(id);
    if (
      !state ||
      !Number.isSafeInteger(generation) ||
      generation < 1 ||
      generation > state.generation ||
      !Number.isSafeInteger(ttlMs) ||
      ttlMs <= 0 ||
      ttlMs > 300000
    )
      throw new Error('Invalid media resource lifetime or generation');
    const fingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
    let row = this.db
      .prepare(
        'SELECT id,expires_at FROM together_media_resources WHERE ref_id=? AND generation=? AND fingerprint=?'
      )
      .get(id, generation, fingerprint);
    if (row && row.expires_at > this.now() + Math.min(30000, ttlMs / 2))
      return { id: row.id, expiresAt: row.expires_at };
    const resourceId =
        row?.id || 'tmres_' + crypto.randomUUID().replaceAll('-', ''),
      expiresAt = this.now() + ttlMs;
    const secret = this.identities.seal(value, id + ':resource:' + resourceId);
    this.db
      .prepare(
        'INSERT INTO together_media_resources(id,ref_id,generation,fingerprint,secret,expires_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret,expires_at=excluded.expires_at'
      )
      .run(resourceId, id, generation, fingerprint, secret, expiresAt);
    return { id: resourceId, expiresAt };
  }
  resource(id, resourceId) {
    if (!this.get(id)) return null;
    const row = this.db
      .prepare(
        'SELECT * FROM together_media_resources WHERE id=? AND ref_id=? AND expires_at>?'
      )
      .get(resourceId, id, this.now());
    return row
      ? {
          id: row.id,
          generation: row.generation,
          expiresAt: row.expires_at,
          value: this.identities.open(row.secret, id + ':resource:' + row.id),
        }
      : null;
  }
  prune() {
    this.db
      .prepare('DELETE FROM together_media_resources WHERE expires_at<=?')
      .run(this.now());
  }
}
module.exports = { RoomMediaStore };
