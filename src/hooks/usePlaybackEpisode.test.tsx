import { act, renderHook } from '@testing-library/react';

import {
  parsePlaybackEpisodeIndex,
  usePlaybackEpisode,
} from './usePlaybackEpisode';

test('local episode selection survives the old URL; a new room URL still updates it', () => {
  const { result, rerender } = renderHook(
    ({ episode }) => usePlaybackEpisode(episode),
    { initialProps: { episode: '1' as string | null } }
  );
  act(() => result.current[1](1));
  expect(result.current[0]).toBe(1);
  rerender({ episode: '1' });
  expect(result.current[0]).toBe(1);
  rerender({ episode: '3' });
  expect(result.current[0]).toBe(2);
});

test('personal playback without an episode parameter preserves its local choice', () => {
  const { result } = renderHook(() => usePlaybackEpisode(null));
  expect(result.current[0]).toBe(0);
  act(() => result.current[1](3));
  expect(result.current[0]).toBe(3);
});

test('only positive integer episode parameters become zero-based indexes', () => {
  expect(parsePlaybackEpisodeIndex('2')).toBe(1);
  for (const value of [
    null,
    '',
    '0',
    '-1',
    '1.5',
    'Infinity',
    '2x',
    '9007199254740992',
  ]) {
    expect(parsePlaybackEpisodeIndex(value)).toBeUndefined();
  }
});
