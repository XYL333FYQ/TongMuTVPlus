const assert = require('node:assert/strict');
const test = require('node:test');
const options = require('./pwa-options.cjs');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('updates and reconnects never force a running playback to reload', () => {
  assert.equal(options.register, false);
  assert.equal(options.dynamicStartUrl, false);
  assert.equal(options.skipWaiting, false);
  assert.equal(options.reloadOnOnline, false);
  assert.equal(options.cacheOnFrontEndNav, false);
  assert.equal(options.cacheStartUrl, false);
});

test('the internal App Router build manifest is excluded without dropping served static assets', () => {
  const excluded = (name) =>
    (options.buildExcludes || []).some((rule) => rule.test(name));
  assert.equal(excluded('app-build-manifest.json'), true);
  assert.equal(excluded('static/chunks/app/layout-123abc.js'), false);
  assert.equal(excluded('static/build-id/_buildManifest.js'), false);
});

test('activation removes only old dynamic responses, preserving media and unrelated caches', async () => {
  const handlers = new Map();
  const deleted = [];
  const requests = [
    { url: 'https://tv.test/my', type: 'text/html' },
    {
      url: 'https://tv.test/api/rooms',
      type: 'application/json; charset=utf-8',
    },
    { url: 'https://tv.test/search?_rsc=1', type: 'text/x-component' },
    { url: 'https://tv.test/movie.mp4', type: 'video/mp4' },
    { url: 'https://outside.test/api/a', type: 'application/json' },
  ];
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../public/push-sw.js'), 'utf8'),
    {
      URL,
      self: {
        location: { origin: 'https://tv.test' },
        addEventListener: (name, fn) => handlers.set(name, fn),
      },
      caches: {
        keys: async () => ['others', 'offline-videos'],
        open: async (name) => {
          assert.equal(name, 'others');
          return {
            keys: async () => requests,
            match: async (request) => ({
              headers: { get: () => request.type },
            }),
            delete: async (request) => deleted.push(request.url),
          };
        },
      },
    }
  );
  let pending;
  assert.ok(handlers.has('activate'));
  handlers.get('activate')({
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.deepEqual(
    deleted,
    requests.slice(0, 3).map((request) => request.url)
  );
  assert.equal(handlers.has('install'), false);
});

test('runtime cache accepts only immutable same-origin build assets', () => {
  const matches = (path, origin = 'https://tv.test') =>
    options.runtimeCaching.some((rule) =>
      rule.urlPattern({
        url: new URL(path, origin),
        sameOrigin: origin === 'https://tv.test',
      })
    );
  assert.ok(matches('/_next/static/chunks/app/layout-123abc.js'));
  assert.ok(matches('/_next/static/css/123abc.css'));
  for (const path of [
    '/',
    '/my',
    '/api/rooms',
    '/search?_rsc=abc',
    '/sw.js',
    '/push-sw.js',
  ]) {
    assert.equal(matches(path), false, path);
  }
  assert.equal(matches('/_next/static/a.js', 'https://external.test'), false);
});
