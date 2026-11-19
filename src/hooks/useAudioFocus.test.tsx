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

/** jsdom 的媒体元素永远是暂停的：这里让测试能控制“正在播放” */
function media(kind: 'video' | 'audio' = 'video') {
  const element = document.createElement(kind);
  let paused = true;
  Object.defineProperty(element, 'paused', { get: () => paused });
  Object.defineProperty(element, 'ended', { get: () => false });
  return Object.assign(element, {
    start() {
      paused = false;
      element.dispatchEvent(new Event('play'));
    },
    stop() {
      paused = true;
      element.dispatchEvent(new Event('pause'));
    },
  });
}

it('registering players that are not playing mutes nobody', () => {
  const movie = media();
  const live = media();
  renderHook(() => useAudioFocus(movie));
  renderHook(() => useAudioFocus(live));
  expect(movie.muted).toBe(false);
  expect(live.muted).toBe(false);
});

it('a same-page explicit sound claim mutes the previous player immediately without BroadcastChannel', () => {
  const movie = media();
  const live = media();
  const first = renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(live));
  act(() => movie.start());
  expect(first.result.current.ownsSound).toBe(true);
  act(() => second.result.current.claimSound());
  expect(first.result.current.ownsSound).toBe(false);
  expect(second.result.current.ownsSound).toBe(true);
  expect(movie.muted).toBe(true);
  expect(live.muted).toBe(false);
});

it('pressing play takes the sound from the player that was audible', () => {
  const movie = media();
  const tv = media();
  const first = renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(tv));
  act(() => movie.start());
  act(() => tv.start());
  expect(second.result.current.ownsSound).toBe(true);
  expect(first.result.current.ownsSound).toBe(false);
  expect(movie.muted).toBe(true);
  expect(tv.muted).toBe(false);
});

it('a paused player does not keep the sound: the next player that plays is audible', () => {
  const oldTab = media();
  const newTab = media();
  renderHook(() => useAudioFocus(oldTab));
  const second = renderHook(() => useAudioFocus(newTab));
  act(() => oldTab.start());
  act(() => oldTab.stop());
  // 没有用户操作的播放也能拿到没人占着的声音
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value: { isActive: false },
  });
  act(() => newTab.start());
  expect(second.result.current.ownsSound).toBe(true);
  expect(newTab.muted).toBe(false);
  delete (navigator as unknown as Record<string, unknown>).userActivation;
});

it('an automatic play without a user gesture does not steal sound from an audible player', () => {
  const solo = media();
  const room = media();
  renderHook(() => useAudioFocus(solo));
  const second = renderHook(() => useAudioFocus(room));
  act(() => solo.start());
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value: { isActive: false },
  });
  act(() => room.start());
  expect(second.result.current.ownsSound).toBe(false);
  expect(room.muted).toBe(true);
  expect(solo.muted).toBe(false);
  delete (navigator as unknown as Record<string, unknown>).userActivation;
});

it('when the audible player pauses, a player that is still playing gets its sound back', () => {
  const movie = media();
  const music = media('audio');
  const first = renderHook(() => useAudioFocus(movie));
  renderHook(() => useAudioFocus(music));
  act(() => movie.start());
  act(() => music.start());
  expect(movie.muted).toBe(true);
  act(() => music.stop());
  expect(first.result.current.ownsSound).toBe(true);
  expect(movie.muted).toBe(false);
});

it('registering an audio element does not steal the movie sound, and releasing its explicit claim restores the prior owner', () => {
  const movie = media();
  const music = media('audio');
  const first = renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(music));
  act(() => movie.start());
  expect(first.result.current.ownsSound).toBe(true);
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
  const movie = media();
  const live = media();
  renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(live));
  act(() => second.result.current.claimSound());
  expect(movie.muted).toBe(true);
  expect(live.muted).toBe(false);
});

it('turning the sound back on in a muted player means "listen here" instead of being muted again', () => {
  const movie = media();
  const live = media();
  const first = renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(live));
  act(() => second.result.current.claimSound());
  expect(movie.muted).toBe(true);
  act(() => {
    movie.muted = false;
    movie.dispatchEvent(new Event('volumechange'));
  });
  expect(first.result.current.ownsSound).toBe(true);
  expect(movie.muted).toBe(false);
  expect(live.muted).toBe(true);
});

it('a player unmuting itself without a user gesture stays muted while another one is audible', () => {
  const movie = media();
  const live = media();
  renderHook(() => useAudioFocus(movie));
  const second = renderHook(() => useAudioFocus(live));
  act(() => second.result.current.claimSound());
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value: { isActive: false },
  });
  act(() => {
    movie.muted = false;
    movie.dispatchEvent(new Event('volumechange'));
  });
  expect(movie.muted).toBe(true);
  delete (navigator as unknown as Record<string, unknown>).userActivation;
});

it('an initially muted decoder can adopt the intended audible preference only after sound registration', () => {
  const live = media();
  live.muted = true;
  renderHook(() => useAudioFocus(live, false));
  expect(live.muted).toBe(false);
});
