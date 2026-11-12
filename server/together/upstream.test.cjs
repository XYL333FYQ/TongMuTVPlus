'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { SyncTvUpstream } = require('./upstream.cjs');
function fixture() {
  const calls = [];
  const fetch = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, options, body });
    let data = {};
    if (url.endsWith('/api/auth/login/start'))
      data = { loginSessionId: body.username };
    else if (url.endsWith('/api/auth/direct-password/login'))
      data = {
        accessToken: 'access-' + body.loginSessionId,
        refreshToken: 'refresh-' + body.loginSessionId,
        user: { id: 'usr_test' },
      };
    else if (url.endsWith('/api/admin/users')) data = { id: 'usr_created' };
    else data = { ok: true };
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return {
    calls,
    client: new SyncTvUpstream({
      baseUrl: 'http://synctv:8080',
      adminUsername: 'bootstrap',
      adminPassword: 'private-bootstrap',
      fetch,
    }),
  };
}
test('privileged credentials are only used to create ordinary upstream users', async () => {
  const { client, calls } = fixture();
  await client.createUser({
    username: 'tm_test',
    password: 'generated-secret',
  });
  const create = calls.find((c) => c.url.endsWith('/api/admin/users'));
  assert.equal(create.options.headers.Authorization, 'Bearer access-bootstrap');
  assert.equal(create.body.role, 3);
  assert.equal(create.body.status, 1);
  const own = await client.login('tm_test', 'generated-secret');
  await client.request('GET', '/api/rooms', undefined, own.accessToken);
  assert.equal(
    calls.at(-1).options.headers.Authorization,
    'Bearer access-tm_test'
  );
  assert.equal(calls.at(-1).options.redirect, 'error');
});
test('absolute or traversal paths cannot redirect credentials to another service', async () => {
  const { client, calls } = fixture();
  for (const path of [
    'https://evil.invalid/api/rooms',
    '//evil.invalid/api/rooms',
    '/api/../admin',
    '/api/%2e%2e/admin',
  ]) {
    await assert.rejects(
      client.request('GET', path, undefined, 'private'),
      /path/i
    );
  }
  assert.equal(calls.length, 0);
});
test('malformed login responses and upstream failures do not expose credentials', async () => {
  const bad = new SyncTvUpstream({
    baseUrl: 'http://synctv:8080',
    adminUsername: 'a',
    adminPassword: 'secret',
    fetch: async () => new Response('{}'),
  });
  await assert.rejects(bad.login('alice', 'private-password'), /response/i);
  const failed = new SyncTvUpstream({
    baseUrl: 'http://synctv:8080',
    adminUsername: 'a',
    adminPassword: 'secret',
    fetch: async () => {
      throw new Error('private-password');
    },
  });
  await assert.rejects(
    failed.login('alice', 'private-password'),
    (e) => e.status === 503 && !e.message.includes('private-password')
  );
});

test('login respects upstream Retry-After, renews the login challenge and queues concurrent attempts', async () => {
  const calls = [],
    delays = [];
  let throttled = true;
  const client = new SyncTvUpstream({
    baseUrl: 'http://synctv:8080',
    adminUsername: 'root',
    adminPassword: 'secret',
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push([new URL(url).pathname, body]);
      if (url.endsWith('/start'))
        return new Response(JSON.stringify({ loginSessionId: body.username }));
      if (throttled) {
        throttled = false;
        return new Response('{}', {
          status: 429,
          headers: { 'Retry-After': '11' },
        });
      }
      return new Response(
        JSON.stringify({
          accessToken: 'a',
          refreshToken: 'r',
          user: { id: 'usr_a' },
        })
      );
    },
  });
  await Promise.all([
    client.login('alice', 'private'),
    client.login('bob', 'private'),
  ]);
  assert.deepEqual(delays, [11000]);
  assert.deepEqual(
    calls.filter((c) => c[0].endsWith('/start')).map((c) => c[1].username),
    ['alice', 'alice', 'bob']
  );
});
