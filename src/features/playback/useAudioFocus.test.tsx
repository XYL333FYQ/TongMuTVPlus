import { act, cleanup, renderHook } from '@testing-library/react';

import { useAudioFocus } from './useAudioFocus';

const originalChannel = Object.getOwnPropertyDescriptor(
  globalThis,
  'BroadcastChannel'
);
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  let id = 0;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => `audio-owner-${++id}` },
  });
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: undefined,
  });
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  localStorage.clear();
  jest.useRealTimers();
  if (originalChannel)
    Object.defineProperty(globalThis, 'BroadcastChannel', originalChannel);
});

it('a same-page explicit sound claim mutes the previous player immediately without BroadcastChannel', () => {
  const movie = document.createElement('video');
  const live = document.createElement('video');
  const first = renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(live));
  expect(movie.muted).toBe(false);
  expect(live.muted).toBe(true);
  act(() => second.result.current.claimSound());
  expect(first.result.current.ownsSound).toBe(false);
  expect(second.result.current.ownsSound).toBe(true);
  expect(movie.muted).toBe(true);
  expect(live.muted).toBe(false);
});

it('registering an audio element does not steal the movie sound, and releasing its explicit claim restores the prior owner', () => {
  const movie = document.createElement('video');
  const music = document.createElement('audio');
  const first = renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(music));
  expect(first.result.current.ownsSound).toBe(true);
  expect(music.muted).toBe(true);
  act(() => second.result.current.claimSound());
  expect(movie.muted).toBe(true);
  second.unmount();
  expect(first.result.current.ownsSound).toBe(true);
  expect(movie.muted).toBe(false);
});

it('same-page sound remains exclusive even when browser storage is unavailable', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('restricted storage');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('restricted storage');
  });
  const movie = document.createElement('video');
  const live = document.createElement('video');
  renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(live));
  act(() => second.result.current.claimSound());
  expect(movie.muted).toBe(true);
  expect(live.muted).toBe(false);
});

it('a background player cannot bypass sound ownership through its own volume controls', () => {
  const movie = document.createElement('video');
  const live = document.createElement('video');
  renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(live));
  act(() => second.result.current.claimSound());
  act(() => {
    movie.muted = false;
    movie.dispatchEvent(new Event('volumechange'));
  });
  expect(movie.muted).toBe(true);
});

it('an initially muted decoder can adopt the intended audible preference only after sound registration', () => {
  const live = document.createElement('video');
  live.muted = true;
  renderHook(() => useAudioFocus(live, false));
  expect(live.muted).toBe(false);
});
