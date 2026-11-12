'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { resolveTogetherOperation } = require('./http-policy.cjs');
test('explicit room API mapping cannot reach admin, auth or arbitrary paths', () => {
  assert.equal(resolveTogetherOperation('POST', ['rooms']).path, '/api/rooms');
  assert.equal(
    resolveTogetherOperation('GET', ['rooms']).path,
    '/api/user/rooms'
  );
  assert.equal(
    resolveTogetherOperation('PUT', ['rooms', 'room_one', 'membership']).path,
    '/api/rooms/room_one/members/@me'
  );
  for (const segments of [
    ['admin', 'users'],
    ['auth', 'login'],
    ['rooms', '../admin'],
    ['rooms', 'room_one', '../settings'],
    ['rooms', 'room_one', 'movies'],
  ]) {
    assert.equal(resolveTogetherOperation('POST', segments), null);
  }
  assert.equal(
    resolveTogetherOperation('GET', ['rooms', 'room_one', 'settings']).roomId,
    'room_one'
  );
});
test('queries are reconstructed from a bounded allowlist and do not accept credentials', () => {
  const resolved = resolveTogetherOperation(
    'GET',
    ['directory'],
    new URLSearchParams('page=2&pageSize=20&search=abc')
  );
  assert.equal(
    resolved.path,
    '/api/user/rooms/discover?page=2&pageSize=20&search=abc'
  );
  for (const query of [
    'accessToken=secret',
    'page=2&page=3',
    'search=' + 'x'.repeat(201),
    'pageSize=10000',
  ]) {
    assert.throws(
      () =>
        resolveTogetherOperation(
          'GET',
          ['directory'],
          new URLSearchParams(query)
        ),
      /query/i
    );
  }
});
test('clock preserves nanoseconds as decimal strings and accepts only the public time query', () => {
  assert.equal(
    resolveTogetherOperation(
      'GET',
      ['clock'],
      new URLSearchParams('clientSentAtNanos=1794470000000000001')
    ).path,
    '/api/public/time?clientSentAtNanos=1794470000000000001'
  );
  assert.throws(() =>
    resolveTogetherOperation(
      'GET',
      ['clock'],
      new URLSearchParams('clientSentAtNanos=NaN')
    )
  );
  assert.equal(resolveTogetherOperation('POST', ['clock']), null);
});
