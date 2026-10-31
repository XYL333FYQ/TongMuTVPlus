import { fireEvent, render, screen } from '@testing-library/react';

import type { PlaybackSession } from './context';
import { PlaybackSessionContext } from './context';
import PlaybackSlot from './PlaybackSlot';

function fixture(video: HTMLVideoElement | null) {
  return {
    controller: video ? { video } : null,
    registerSlot: jest.fn(),
  } as unknown as PlaybackSession;
}

function dimensions(video: HTMLVideoElement, width: number, height: number) {
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: width },
    videoHeight: { configurable: true, value: height },
  });
}

test('uses real media dimensions and responds to resolution changes without replacing the slot', () => {
  const video = document.createElement('video');
  const session = fixture(video);
  render(
    <PlaybackSessionContext.Provider value={session}>
      <PlaybackSlot />
    </PlaybackSessionContext.Provider>
  );
  const slot = screen.getByLabelText('房间播放器');
  expect(slot.style.getPropertyValue('--tm-video-aspect-ratio')).toBe('16 / 9');
  dimensions(video, 1920, 800);
  fireEvent.loadedMetadata(video);
  expect(slot.style.getPropertyValue('--tm-video-aspect-ratio')).toBe(
    '1920 / 800'
  );
  dimensions(video, 720, 1280);
  fireEvent(video, new Event('resize'));
  expect(slot.style.getPropertyValue('--tm-video-aspect-ratio')).toBe(
    '720 / 1280'
  );
  expect(screen.getByLabelText('房间播放器')).toBe(slot);
  fireEvent.emptied(video);
  expect(slot.style.getPropertyValue('--tm-video-aspect-ratio')).toBe('16 / 9');
});

test('reads an already loaded video and detaches old listeners when changing controller', () => {
  const first = document.createElement('video');
  dimensions(first, 640, 480);
  const second = document.createElement('video');
  const removed = jest.spyOn(first, 'removeEventListener');
  const view = (session: PlaybackSession) => (
    <PlaybackSessionContext.Provider value={session}>
      <PlaybackSlot />
    </PlaybackSessionContext.Provider>
  );
  const { rerender, unmount } = render(view(fixture(first)));
  const slot = screen.getByLabelText('房间播放器');
  expect(slot.style.getPropertyValue('--tm-video-aspect-ratio')).toBe(
    '640 / 480'
  );
  rerender(view(fixture(second)));
  expect(slot.style.getPropertyValue('--tm-video-aspect-ratio')).toBe('16 / 9');
  expect(removed).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
  expect(removed).toHaveBeenCalledWith('resize', expect.any(Function));
  expect(removed).toHaveBeenCalledWith('emptied', expect.any(Function));
  dimensions(first, 1920, 800);
  fireEvent.loadedMetadata(first);
  expect(slot.style.getPropertyValue('--tm-video-aspect-ratio')).toBe('16 / 9');
  const secondRemoved = jest.spyOn(second, 'removeEventListener');
  unmount();
  expect(secondRemoved).toHaveBeenCalledWith('resize', expect.any(Function));
});
