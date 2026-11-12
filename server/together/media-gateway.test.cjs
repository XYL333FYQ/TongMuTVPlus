'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  Database = require('better-sqlite3');
const { TogetherStore } = require('./store.cjs');
const { RoomMediaStore } = require('./media-store.cjs');
const { RoomMediaGateway } = require('./media-gateway.cjs');
function fixture() {
  const db = new Database(':memory:'),
    identities = new TogetherStore(db, { encryptionKey: '07'.repeat(32) }),
    owner = identities.identity('alice', '1'),
    store = new RoomMediaStore(identities);
  const ref = store.create({
    roomId: 'room_one',
    ownerIdentityId: owner.id,
    source: 'catalog',
    filmId: 'film-1',
    episodeIndex: 1,
    kind: 'movie',
    requestId: 'gateway',
  });
  const calls = [];
  let resolves = 0;
  const descriptor = () => ({
    source: 'catalog',
    filmId: 'film-1',
    episodeIndex: 1,
    title: 'Film',
    episodeTitle: 'Episode 2',
    url: 'https://media.test/film/episode-2.mp4?token=' + resolves,
    format: 'mp4',
    headers: { Authorization: 'Bearer private-source' },
    subtitles: [],
    trustedHosts: [],
  });
  const gateway = new RoomMediaGateway({
    store,
    authorize: async (principal, reference) => {
      if (principal.accountId === 'outsider' || reference.roomId !== 'room_one')
        throw Object.assign(new Error('Forbidden'), { status: 403 });
    },
    resolveSource: async () => {
      resolves++;
      return descriptor();
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(Buffer.from([1, 2, 3, 4]), {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': 'bytes 4-7/12',
          'Content-Length': '4',
          'Accept-Ranges': 'bytes',
        },
      });
    },
  });
  return {
    db,
    store,
    ref,
    gateway,
    calls,
    descriptor,
    get resolves() {
      return resolves;
    },
  };
}
const actor = { accountId: 'bob' };
test('member MP4 requests preserve Range and expose no upstream credential or cookie headers', async () => {
  const f = fixture();
  const response = await f.gateway.open(actor, f.ref.id, 'stream', {
    method: 'GET',
    headers: new Headers({ Range: 'bytes=4-7', Cookie: 'site-cookie' }),
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 4-7/12');
  assert.deepEqual(
    [...new Uint8Array(await response.arrayBuffer())],
    [1, 2, 3, 4]
  );
  assert.equal(f.calls[0].init.headers.get('range'), 'bytes=4-7');
  assert.equal(f.calls[0].init.headers.get('cookie'), null);
  assert.equal(
    f.calls[0].init.headers.get('authorization'),
    'Bearer private-source'
  );
  assert.match(response.headers.get('cache-control'), /no-store/);
  const dto = await f.gateway.describe(actor, f.ref.id);
  assert(!JSON.stringify(dto).includes('private-source'));
  assert(!JSON.stringify(dto).includes('media.test'));
  assert.equal(dto.episodeIndex, 1);
  assert.equal(dto.filmId, 'film-1');
  f.db.close();
});
test('outsiders, malformed ranges and mixed-film resolver responses are rejected before streaming', async () => {
  const f = fixture();
  await assert.rejects(
    f.gateway.open({ accountId: 'outsider' }, f.ref.id, 'stream', {
      headers: new Headers(),
    }),
    (e) => e.status === 403
  );
  assert.equal(f.resolves, 0);
  assert.equal(f.calls.length, 0);
  await assert.rejects(
    f.gateway.open(actor, f.ref.id, 'stream', {
      headers: new Headers({ Range: 'bytes=8-4' }),
    }),
    (e) => e.status === 416
  );
  f.gateway.resolveSource = async () => ({
    ...f.descriptor(),
    filmId: 'another-film',
  });
  await assert.rejects(f.gateway.describe(actor, f.ref.id), /reference|film/i);
  assert.equal(f.store.state(f.ref.id), null);
  f.db.close();
});
test('expired root URLs resolve the same immutable episode once and retry with the refreshed address', async () => {
  const f = fixture();
  let attempted = 0;
  f.gateway.fetch = async (url) => {
    attempted++;
    return attempted === 1
      ? new Response(null, { status: 403 })
      : new Response('actual-media', {
          headers: { 'Content-Type': 'video/mp4' },
        });
  };
  const response = await f.gateway.open(actor, f.ref.id, 'stream', {
    headers: new Headers(),
  });
  assert.equal(await response.text(), 'actual-media');
  assert.equal(f.resolves, 2);
  assert.equal(f.store.get(f.ref.id).filmId, 'film-1');
  assert.equal(f.store.get(f.ref.id).episodeIndex, 1);
  f.db.close();
});
test('inline HLS keys stay behind authorized opaque resources without outbound fetch', async () => {
  const f = fixture();
  try {
    f.gateway.resolveSource = async () => ({
      ...f.descriptor(),
      format: 'hls',
    });
    f.gateway.fetch = async () =>
      new Response(
        '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="data:application/octet-stream;base64,AQEBAQEBAQEBAQEBAQEBAQ=="\n#EXTINF:6,\npart.m4s\n'
      );
    const text = await (await f.gateway.open(actor, f.ref.id, 'stream')).text();
    assert(!text.includes('base64'));
    const keyId = text
      .match(/URI="([^"]+)"/)[1]
      .split('/')
      .at(-1);
    f.gateway.fetch = async () => {
      throw new Error('Inline keys must not be fetched');
    };
    const key = await f.gateway.open(actor, f.ref.id, 'resource/' + keyId);
    assert.deepEqual(Buffer.from(await key.arrayBuffer()), Buffer.alloc(16, 1));
  } finally {
    f.db.close();
  }
});
test('nested HLS and keys use opaque member resources; credentials do not cross origins', async () => {
  const f = fixture();
  f.gateway.resolveSource = async () => ({
    ...f.descriptor(),
    url: 'https://media.test/master.m3u8?token=secret',
    format: 'hls',
  });
  f.gateway.fetch = async (url, init) => {
    f.calls.push({ url, init });
    if (url.includes('master.m3u8'))
      return new Response(
        '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvariant.m3u8?token=secret\n',
        { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } }
      );
    if (url.includes('variant.m3u8'))
      return new Response(
        '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.test/key.bin?token=secret"\n#EXT-X-MAP:URI="init.mp4?token=secret"\n#EXTINF:6,\npart.m4s?token=secret\n',
        { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } }
      );
    return new Response(Buffer.alloc(16), {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  };
  const master = await (
    await f.gateway.open(actor, f.ref.id, 'stream', { headers: new Headers() })
  ).text();
  assert(!master.includes('secret'));
  assert(!master.includes('media.test'));
  const variantId = master
    .split('\n')
    .find((line) => line.startsWith('/api/'))
    .split('/')
    .at(-1);
  const variant = await (
    await f.gateway.open(actor, f.ref.id, 'resource/' + variantId, {
      headers: new Headers(),
    })
  ).text();
  assert(!variant.includes('secret'));
  const keyId = variant
    .match(/#EXT-X-KEY:.*URI="([^"]+)"/)[1]
    .split('/')
    .at(-1);
  await f.gateway.open(actor, f.ref.id, 'resource/' + keyId, {
    headers: new Headers(),
  });
  const keyRequest = f.calls.find((call) =>
    call.url.startsWith('https://cdn.test')
  );
  assert.equal(keyRequest.init.headers.get('authorization'), null);
  const other = f.store.create({
    roomId: 'room_one',
    ownerIdentityId: f.ref.ownerIdentityId,
    source: 'catalog',
    filmId: 'film-2',
    episodeIndex: 0,
    kind: 'movie',
    requestId: 'other',
  });
  await assert.rejects(
    f.gateway.open(actor, other.id, 'resource/' + keyId, {
      headers: new Headers(),
    }),
    (e) => e.status === 404
  );
  f.db.close();
});
