import {
  anchoredPlaybackTime,
  normalizePlaybackHref,
  playbackHrefFromState,
  playbackIdentity,
  queueItemFromHref,
  queuePlaybackHref,
} from './session';
import { parseAudioLease } from './useAudioFocus';

import type { PlayState } from '@/types/watch-room';

const state: PlayState = {
  type: 'play',
  source: 'catalog',
  videoId: 'film-1',
  videoName: '电影 & 剧集',
  episode: 2,
  url: 'https://media.test/a.m3u8?token=a%2Bb#t=10',
  currentTime: 20,
  isPlaying: true,
  playbackRate: 2,
  updatedAt: 10000,
};

test('playback can be retained independently of the visited route, without allowing external navigation', () => {
  expect(normalizePlaybackHref('/play?source=directplay&id=signed%2Burl')).toBe(
    '/play?source=directplay&id=signed%2Burl'
  );
  for (const href of [
    'https://outside.test/play',
    '//outside.test/play',
    'javascript:alert(1)',
    '/watch-room',
    '/playback',
  ])
    expect(normalizePlaybackHref(href)).toBeNull();
});
test('room playback identity follows source and episode, independent of display metadata', () => {
  const href = playbackHrefFromState(state);
  expect(new URL(href, 'https://test').searchParams.get('title')).toBe(
    state.videoName
  );
  expect(playbackIdentity(href)).toBe(
    playbackIdentity(href + '&poster=changed')
  );
  expect(playbackIdentity(href)).not.toBe(
    playbackIdentity(href.replace('episode=2', 'episode=3'))
  );
  expect(queueItemFromHref(href)).toMatchObject({
    title: state.videoName,
    source: 'catalog',
    videoId: 'film-1',
    episode: 2,
  });
});
test('returning viewers follow the server time anchor and rate instead of saved local progress', () => {
  expect(anchoredPlaybackTime(state, 13000)).toBe(26);
  expect(anchoredPlaybackTime(state, 12000, 1000)).toBe(26);
  expect(anchoredPlaybackTime({ ...state, isPlaying: false }, 1000000)).toBe(
    20
  );
  expect(anchoredPlaybackTime(state, 5000)).toBe(20);
});
test('an expired, malformed or missing audio lease never permanently locks out a new tab', () => {
  expect(parseAudioLease('{broken', 20)).toBeNull();
  expect(
    parseAudioLease(JSON.stringify({ id: 'old-tab', expiresAt: 20 }), 20)
  ).toBeNull();
  expect(
    parseAudioLease(
      JSON.stringify({ id: 'old-tab', expiresAt: 'tomorrow' }),
      20
    )
  ).toBeNull();
  expect(
    parseAudioLease(JSON.stringify({ id: 'active-tab', expiresAt: 30 }), 20)?.id
  ).toBe('active-tab');
});

test('catalog queue items carry the stated episode instead of silently resuming personal history', () => {
  const item = queueItemFromHref('/play?title=夜场&prefer=true&year=2026');
  const url = new URL(item.href, 'https://test');
  expect(item.episode).toBe(1);
  expect(url.searchParams.get('episode')).toBe('1');
  expect(url.searchParams.get('title')).toBe('夜场');
  expect(url.searchParams.get('prefer')).toBe('true');
  expect(queueItemFromHref('/play?source=cms&id=film&episode=2')).toMatchObject(
    { episode: 2 }
  );
});

test('older saved queue URLs receive their persisted episode at playback without a database rewrite', () => {
  expect(
    new URL(
      queuePlaybackHref('/play?title=旧片单&episode=2', 3),
      'https://test'
    ).searchParams.get('episode')
  ).toBe('3');
  expect(() => queuePlaybackHref('https://outside.test/play', 1)).toThrow();
});

test('a queue playback reference retains its item identity across the shared snapshot', () => {
  const href = queuePlaybackHref('/play?title=测试片', 3, 'waiting-1');
  expect(new URL(href, 'https://test').searchParams.get('queueId')).toBe(
    'waiting-1'
  );
  const shared = playbackHrefFromState({ ...state, queueItemId: 'waiting-1' });
  expect(new URL(shared, 'https://test').searchParams.get('queueId')).toBe(
    'waiting-1'
  );
});
