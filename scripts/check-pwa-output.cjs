// Inspect the actual generated worker, not just its configuration.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let precache;
const routes = [];
const workbox = {
  clientsClaim() {},
  cleanupOutdatedCaches() {},
  precacheAndRoute(entries) {
    precache = entries;
  },
  registerRoute(match) {
    routes.push(match);
  },
  CacheFirst: class {},
  ExpirationPlugin: class {},
  CacheableResponsePlugin: class {},
};
const define = (_dependencies, factory) => factory(workbox);
vm.runInNewContext(
  fs.readFileSync('public/sw.js', 'utf8'),
  {
    define,
    self: { define, addEventListener() {} },
    importScripts() {},
  },
  { timeout: 2000 }
);
assert.ok(precache?.length, 'generated precache must include build assets');
for (const { url } of precache) {
  assert.ok(
    url.startsWith('/_next/'),
    `unexpected precached public/page resource: ${url}`
  );
}
for (const pathname of ['/', '/my', '/api/rooms', '/search', '/push-sw.js']) {
  assert.equal(
    routes.some(
      (match) =>
        typeof match === 'function' &&
        match({ url: new URL(pathname, 'https://tv.test'), sameOrigin: true })
    ),
    false,
    `dynamic resource unexpectedly intercepted: ${pathname}`
  );
}
console.log(
  `PASS: ${precache.length} build assets; no dynamic/public precache or page/API runtime cache`
);
