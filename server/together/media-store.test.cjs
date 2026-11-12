'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  Database = require('better-sqlite3');
const { TogetherStore } = require('./store.cjs');
const { RoomMediaStore } = require('./media-store.cjs');
function fixture() {
  let now = 1000;
  const db = new Database(':memory:');
  const identities = new TogetherStore(db, {
    encryptionKey: '07'.repeat(32),
    now: () => now,
  });
  const owner = identities.identity('alice', 'created-1');
  const media = new RoomMediaStore(identities);
  const input = {
    roomId: 'room_one',
    ownerIdentityId: owner.id,
    source: 'catalog',
    filmId: 'film-1',
    episodeIndex: 1,
    kind: 'movie',
    requestId: 'request-1',
  };
  return {
    db,
    identities,
    owner,
    media,
    input,
    advance: (ms) => {
      now += ms;
    },
  };
}
test('room source/film/episode references are immutable and actor request retries are idempotent', () => {
  const f = fixture();
  const first = f.media.create(f.input);
  assert.equal(first.id, f.media.create(f.input).id);
  assert.equal(first.episodeIndex, 1);
  assert.equal(first.filmId, 'film-1');
  assert.throws(
    () => f.media.create({ ...f.input, filmId: 'film-2' }),
    /conflict/i
  );
  assert.notEqual(
    first.id,
    f.media.create({ ...f.input, requestId: 'request-2', filmId: 'film-2' }).id
  );
  assert.throws(() => f.media.create({ ...f.input, episodeIndex: -1 }));
  f.db.close();
});
test('resolved URLs, headers and resource targets are encrypted and bound to the original reference', () => {
  const f = fixture();
  const ref = f.media.create(f.input);
  const secret = {
    url: 'https://source.test/movie.mp4?token=private-address',
    headers: { Authorization: 'Bearer private-header' },
    format: 'mp4',
  };
  const state = f.media.saveState(ref.id, secret, 30000);
  assert.equal(state.generation, 1);
  assert.deepEqual(f.media.state(ref.id).value, secret);
  const resource = f.media.createResource(ref.id, state.generation, {
    ...secret,
    kind: 'media',
  });
  assert.equal(
    resource.id,
    f.media.createResource(ref.id, state.generation, {
      ...secret,
      kind: 'media',
    }).id
  );
  assert.equal(f.media.resource(ref.id, resource.id).value.url, secret.url);
  const other = f.media.create({
    ...f.input,
    requestId: 'other',
    filmId: 'film-2',
  });
  assert.equal(f.media.resource(other.id, resource.id), null);
  for (const table of ['together_media_state', 'together_media_resources']) {
    const persisted = JSON.stringify(
      f.db.prepare('SELECT * FROM ' + table).all()
    );
    assert(!persisted.includes('private-address'));
    assert(!persisted.includes('private-header'));
  }
  f.db.close();
});
test('expired resources and revoked creators cannot authorize fresh media requests', () => {
  const f = fixture(),
    ref = f.media.create(f.input);
  const state = f.media.saveState(
    ref.id,
    { url: 'https://source.test/one.m3u8' },
    1000
  );
  const resource = f.media.createResource(
    ref.id,
    state.generation,
    { url: 'https://source.test/segment.m4s' },
    2000
  );
  f.advance(1001);
  assert.equal(f.media.state(ref.id), null);
  assert(f.media.resource(ref.id, resource.id));
  assert.equal(
    f.media.saveState(
      ref.id,
      { url: 'https://source.test/refreshed.m3u8' },
      1000
    ).generation,
    2
  );
  f.advance(1000);
  assert.equal(f.media.resource(ref.id, resource.id), null);
  f.identities.revokeAccount('alice');
  assert.equal(f.media.get(ref.id), null);
  assert.throws(
    () => f.media.saveState(ref.id, { url: 'https://source.test/old' }, 1000),
    /revoked|missing/i
  );
  f.db.close();
});
test('public metadata only accepts display fields and cannot accidentally persist raw addresses', () => {
  const f = fixture(),
    ref = f.media.create(f.input);
  f.media.setMetadata(ref.id, {
    title: 'Film',
    episodeTitle: 'Episode 2',
    format: 'hls',
    hasPoster: true,
    subtitles: [{ label: '中文', language: 'zh', format: 'vtt' }],
  });
  assert.equal(f.media.get(ref.id).metadata.title, 'Film');
  assert.throws(
    () =>
      f.media.setMetadata(ref.id, {
        title: 'Film',
        url: 'https://source.test/?token=secret',
      }),
    /metadata/i
  );
  f.media.bindMedia(ref.id, 'med_one');
  assert.equal(f.media.get(ref.id).upstreamMediaId, 'med_one');
  assert.throws(() => f.media.bindMedia(ref.id, 'med_two'), /bound|conflict/i);
  f.db.close();
});
