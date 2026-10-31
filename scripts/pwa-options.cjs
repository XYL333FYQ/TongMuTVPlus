// Only immutable build assets belong in the runtime cache. Account pages,
// API/RSC responses and media downloads keep their own existing lifecycles.
module.exports = {
  dest: 'public',
  // Register directly, avoiding next-pwa's history wrapping and next-data cache.
  register: false,
  dynamicStartUrl: false,
  skipWaiting: false,
  reloadOnOnline: false,
  cacheOnFrontEndNav: false,
  cacheStartUrl: false,
  // Public contains large optional media and authenticated auxiliary files.
  // Installing the worker must not eagerly fetch every one of them.
  publicExcludes: ['!**/*'],
  importScripts: ['/push-sw.js'],
  runtimeCaching: [
    {
      urlPattern: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith('/_next/static/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-assets',
        expiration: { maxEntries: 256, maxAgeSeconds: 31536000 },
        cacheableResponse: { statuses: [200] },
      },
    },
  ],
};
