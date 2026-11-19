import type { LiveState } from '@/types/watch-room';

/** A stable application reference, rather than an expiring CDN stream URL. */
export function webLiveReference(platform: string, roomId: string) {
  const url = new URL('/web-live', window.location.origin);
  url.searchParams.set('platform', platform);
  url.searchParams.set('roomId', roomId);
  return url.href;
}

export function parseWebLiveReference(state: LiveState) {
  try {
    const url = new URL(state.channelUrl);
    const platform = url.searchParams.get('platform');
    const roomId = url.searchParams.get('roomId');
    if (url.pathname === '/web-live' && platform && roomId)
      return { platform, roomId };
  } catch {
    /* The compatibility reference below may not be an HTTP URL. */
  }
  const match = /^(huya|bilibili|douyin|douyu):(.+)$/.exec(state.channelUrl);
  if (match) return { platform: match[1], roomId: match[2] };
  return null;
}

export function liveActivityHref(state: LiveState) {
  const web = parseWebLiveReference(state);
  return web ? `/web-live?${new URLSearchParams(web)}` : '/live';
}

export function normalizeActivityReturnHref(value: string | null) {
  if (
    !value ||
    value.length > 8192 ||
    !value.startsWith('/') ||
    value.startsWith('//')
  )
    return null;
  try {
    const url = new URL(value, 'https://tongmu.invalid');
    if (url.origin !== 'https://tongmu.invalid') return null;
    if (
      !['/live', '/web-live', '/music'].includes(url.pathname) &&
      !url.pathname.startsWith('/tv/')
    )
      return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
