import {
  roomPlaybackSelection,
  waitForSelectedPlayer,
} from './playback-selection';
test('room selection retains original source/film/episode and uses only the authorized gateway', () => {
  const selection = roomPlaybackSelection({
    id: 'tmmedia_' + 'a'.repeat(32),
    source: 'cms',
    filmId: 'film',
    episodeIndex: 1,
    title: 'Film',
    episodeTitle: 'Second',
    streamPath:
      '/api/together/media/tmmedia_' + 'a'.repeat(32) + '/stream.m3u8',
    subtitles: [],
  });
  expect(selection.href).toContain('episode=2');
  expect(selection.detail?.id).toBe('film');
  expect(selection.detail?.episodes[1]).toContain('/api/together/media/');
  expect(() =>
    roomPlaybackSelection({ ...selection, id: 'invalid' } as never)
  ).toThrow();
});
test('pending player readiness is cancelled without controlling the old personal video', async () => {
  const abort = new AbortController();
  const port = {
    read: () => ({
      ready: true,
      mediaHref: '/play?source=cms&id=personal',
      currentTime: 10,
      playing: true,
      playbackRate: 1,
    }),
  };
  const pending = waitForSelectedPlayer(
    port as never,
    '/play?source=cms&id=room',
    abort.signal
  );
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
