import { isHlsPlaylistUrl } from './hls-url';

test.each([
  'https://cdn.test/a/index.m3u8',
  'https://cdn.test/a/index.m3u8?token=abc&expires=1',
  'https://cdn.test/a/INDEX.M3U8',
  ' https://cdn.test/a/index.m3u8 ',
])('recognizes HLS playlist %p', (url) => {
  expect(isHlsPlaylistUrl(url)).toBe(true);
});

test.each([
  'https://cdn.test/a/video.mp4',
  'https://cdn.test/a/video.mp4?file=x.m3u8',
  'https://cdn.test/play?id=1',
  '',
])('rejects non-playlist %p', (url) => {
  expect(isHlsPlaylistUrl(url)).toBe(false);
});
