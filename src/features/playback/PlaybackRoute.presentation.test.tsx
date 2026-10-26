jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('source=directplay&id=fixture'),
}));

import { fireEvent, render } from '@testing-library/react';

import { PlaybackSessionContext } from './context';
import PlaybackRoute from './PlaybackRoute';

import type { PlaybackSession } from './context';

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
  unmount();
  expect(ratio()).toBe('');
});
