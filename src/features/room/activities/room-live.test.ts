import {
  liveActivityHref,
  normalizeActivityReturnHref,
  parseWebLiveReference,
} from './room-live';

it.each([
  '/live?source=iptv&id=1',
  '/web-live?platform=huya&roomId=123',
  '/music?tab=search',
  '/tv/live/play?source=a&id=b',
])('retains an internal activity selection: %s', (href) => {
  expect(normalizeActivityReturnHref(href)).toBe(href);
});
it.each([
  '//evil.test/live',
  'https://evil.test/music',
  'javascript:alert(1)',
  '/admin',
  '/watch-room',
  '/api/logout',
])('rejects an unrelated or external activity return target: %s', (href) => {
  expect(normalizeActivityReturnHref(href)).toBeNull();
});
it('dispatches platform live by its canonical reference and ordinary TV streams to their adapter', () => {
  const base = {
    type: 'live' as const,
    channelId: 'a',
    channelName: 'A',
    channelUrl: 'https://example.test/web-live?roomId=123&platform=huya',
  };
  expect(parseWebLiveReference(base)).toEqual({
    platform: 'huya',
    roomId: '123',
  });
  expect(liveActivityHref(base)).toBe('/web-live?platform=huya&roomId=123');
  expect(
    liveActivityHref({ ...base, channelUrl: 'https://media.test/live.m3u8' })
  ).toBe('/live');
});
