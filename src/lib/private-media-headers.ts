/** Responses carrying user-authorized source results must never enter shared caches. */
export const PRIVATE_MEDIA_HEADERS = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Vary: 'Cookie, Authorization',
};
