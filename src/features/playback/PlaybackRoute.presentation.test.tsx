jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockRouteQuery),
}));

import { fireEvent, render } from '@testing-library/react';

import type { PlaybackSession } from './context';
import { PlaybackSessionContext } from './context';
import PlaybackRoute from './PlaybackRoute';

let mockRouteQuery = 'source=directplay&id=fixture';
beforeEach(() => {
  mockRouteQuery = 'source=directplay&id=fixture';
});

test('opening the current room film as a personal route changes mode once, while metadata URL updates do not create another intent', () => {
  const requestPlayback = jest.fn();
  const session = {
    href: `/play?${mockRouteQuery}`,
    followingRoom: true,
    requestPlayback,
  } as unknown as PlaybackSession;
  const view = render(
    <PlaybackSessionContext.Provider value={session}>
      <PlaybackRoute />
    </PlaybackSessionContext.Provider>
  );
  expect(requestPlayback).toHaveBeenCalledWith(session.href, 'personal');
  mockRouteQuery = new URLSearchParams({
    source: 'directplay',
    id: 'fixture',
    title: '来源补充',
  }).toString();
  view.rerender(
    <PlaybackSessionContext.Provider
      value={{ ...session, href: `/play?${mockRouteQuery}` }}
    >
      <PlaybackRoute />
    </PlaybackSessionContext.Provider>
  );
  expect(requestPlayback).toHaveBeenCalledTimes(1);
});

test('full-page presentation follows media dimensions without requesting playback again', () => {
  const video = document.createElement('video');
  const requestPlayback = jest.fn();
  const session = {
    controller: { video },
    requestPlayback,
  } as unknown as PlaybackSession;
  const { unmount } = render(
    <PlaybackSessionContext.Provider value={session}>
      <PlaybackRoute />
    </PlaybackSessionContext.Provider>
  );
  const ratio = () =>
    document.documentElement.style.getPropertyValue(
      '--tm-full-video-aspect-ratio'
    );
  expect(ratio()).toBe('16 / 9');
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 800 },
  });
  fireEvent.loadedMetadata(video);
  expect(ratio()).toBe('1920 / 800');
  expect(requestPlayback).toHaveBeenCalledTimes(1);
  expect(requestPlayback).toHaveBeenCalledWith(
    '/play?source=directplay&id=fixture',
    'personal'
  );
  unmount();
  expect(ratio()).toBe('');
});
