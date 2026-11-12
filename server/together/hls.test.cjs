'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { rewritePlaylist } = require('./hls.cjs');
test('rewrites variants, media maps, keys and subtitles without exposing original credentials', () => {
  const seen = [];
  const manifest =
    '#EXTM3U\n#provider token=private-token\n#EXT-X-MEDIA:TYPE=SUBTITLES,URI="sub/list.m3u8?token=private-token"\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin?token=private-token"\n#EXT-X-MAP:URI="init.mp4?token=private-token"\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nvariant/list.m3u8?token=private-token\n#EXTINF:6,\npart.m4s?token=private-token\n';
  const result = rewritePlaylist(
    manifest,
    'https://media.test/root/master.m3u8',
    (url, context) => {
      seen.push({ url, ...context });
      return '/api/together/media/ref/resource/' + seen.length;
    }
  );
  assert(!result.includes('private-token'));
  assert(!result.includes('media.test'));
  assert.deepEqual(
    seen.map((r) => r.kind),
    ['playlist', 'key', 'media', 'playlist', 'media']
  );
  assert.equal(
    seen[3].url,
    'https://media.test/root/variant/list.m3u8?token=private-token'
  );
});
test('HLS variables are resolved server-side and passed privately to child playlists', () => {
  const seen = [];
  const text =
    '#EXTM3U\n#EXT-X-DEFINE:QUERYPARAM="auth"\n#EXT-X-DEFINE:NAME="folder",VALUE="files"\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n{$folder}/index.m3u8?auth={$auth}\n';
  const output = rewritePlaylist(
    text,
    'https://media.test/root/master.m3u8?auth=private',
    (url, context) => {
      seen.push({ url, ...context });
      return '/api/together/media/ref/resource/one';
    }
  );
  assert(!output.includes('DEFINE'));
  assert(!output.includes('private'));
  assert.equal(
    seen[0].url,
    'https://media.test/root/files/index.m3u8?auth=private'
  );
  const child =
    '#EXTM3U\n#EXT-X-DEFINE:IMPORT="auth"\n#EXTINF:6,\npiece.m4s?auth={$auth}\n';
  let childUrl;
  rewritePlaylist(
    child,
    'https://media.test/root/files/index.m3u8',
    (url) => {
      childUrl = url;
      return '/api/together/media/ref/resource/two';
    },
    seen[0].variables
  );
  assert.equal(
    childUrl,
    'https://media.test/root/files/piece.m4s?auth=private'
  );
});
test('invalid manifests, unresolved variables and non-media protocols fail closed', () => {
  const rewrite = () => '/api/together/media/ref/resource/id';
  for (const text of [
    '<html>login</html>',
    '#EXTM3U\n{$unknown}/file.m4s',
    '#EXTM3U\nfile:///etc/passwd',
    '#EXTM3U\n#EXT-X-KEY:URI=secret.bin',
  ]) {
    assert.throws(() =>
      rewritePlaylist(text, 'https://media.test/master.m3u8', rewrite)
    );
  }
  assert.throws(() =>
    rewritePlaylist(
      '#EXTM3U\npart.m4s',
      'https://media.test/root',
      () => '//evil.test/file'
    )
  );
});
test('BOM and CRLF are normalized and resource selectors survive signed-query refreshes', () => {
  let selector;
  const output = rewritePlaylist(
    '\uFEFF#EXTM3U\r\n#EXTINF:6,\r\nsegments/part01.m4s?signature=old\r\n',
    'https://media.test/master.m3u8',
    (url, context) => {
      selector = context.selector;
      return '/api/together/media/ref/resource/id';
    }
  );
  assert(output.startsWith('#EXTM3U\n'));
  assert(!output.includes('\r'));
  assert.equal(selector, 'segments/part01.m4s');
});
