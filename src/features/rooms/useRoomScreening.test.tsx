jest.mock('@/lib/motion', () => ({
  useReducedMotionSetting: () => mockReduced,
}));

import { act, renderHook } from '@testing-library/react';

import useRoomScreening from './useRoomScreening';

let mockReduced = false;
function playingVideo() {
  const video = document.createElement('video');
  Object.defineProperties(video, {
    paused: { value: false, configurable: true },
    readyState: { value: 4 },
  });
  return video;
}
beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
});
afterEach(() => {
  jest.useRealTimers();
  delete document.documentElement.dataset.tmRoomScreening;
});

test('only dims after three seconds of decoded playback and wakes on interaction', () => {
  const video = playingVideo();
  const { result } = renderHook(() => useRoomScreening(video, true));
  act(() => jest.advanceTimersByTime(2999));
  expect(result.current).toBe(false);
  act(() => jest.advanceTimersByTime(1));
  expect(result.current).toBe(true);
  act(() => window.dispatchEvent(new Event('pointermove')));
  expect(result.current).toBe(false);
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current).toBe(true);
  act(() => video.dispatchEvent(new Event('waiting')));
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current).toBe(false);
});

test('an open dialog keeps its controls readable while video continues', () => {
  const dialog = document.createElement('section');
  dialog.setAttribute('role', 'dialog');
  document.body.appendChild(dialog);
  const video = playingVideo();
  const { result } = renderHook(() => useRoomScreening(video, true));
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current).toBe(false);
  dialog.remove();
  act(() => window.dispatchEvent(new Event('pointerdown')));
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current).toBe(true);
});

test('reduced motion, personal viewing and cleanup disable screening without controlling video', () => {
  const video = playingVideo();
  const play = jest.spyOn(video, 'play');
  const pause = jest.spyOn(video, 'pause');
  const { result, rerender, unmount } = renderHook(
    ({ following }) => useRoomScreening(video, following),
    { initialProps: { following: true } }
  );
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current).toBe(true);
  mockReduced = true;
  rerender({ following: true });
  expect(result.current).toBe(false);
  mockReduced = false;
  rerender({ following: false });
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current).toBe(false);
  expect(play).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
  unmount();
  expect(document.documentElement.dataset.tmRoomScreening).toBeUndefined();
});
