import { act, cleanup, render } from '@testing-library/react';

import MediaSessionBridge from './MediaSessionBridge';

let playback: {
  controller: { video: HTMLVideoElement; play?: jest.Mock; pause?: jest.Mock };
  followingRoom: boolean;
  metadata: { title: string };
} | null;
let room: { currentRoom: { id: string }; canControl: boolean } | null;
let handlers: Record<string, (() => void) | null>;
let session: {
  metadata: { init: { title: string } } | null;
  playbackState: string;
  setActionHandler: jest.Mock;
};
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => playback,
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => room,
}));

beforeEach(() => {
  playback = null;
  room = null;
  handlers = {};
  session = {
    metadata: null,
    playbackState: 'none',
    setActionHandler: jest.fn((name, handler) => {
      handlers[name] = handler;
    }),
  };
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: session,
  });
  (window as unknown as { MediaMetadata: unknown }).MediaMetadata = class {
    constructor(public init: unknown) {}
  };
});
afterEach(() => {
  cleanup();
  document.querySelectorAll('video,audio').forEach((node) => node.remove());
  delete (navigator as unknown as { mediaSession?: unknown }).mediaSession;
  delete window.TMShell;
});
function media(playing = true) {
  const video = document.createElement('video');
  Object.defineProperty(video, 'paused', {
    configurable: true,
    value: !playing,
  });
  video.play = jest.fn().mockResolvedValue(undefined);
  video.pause = jest.fn();
  document.body.append(video);
  return video;
}

test('already playing media is discovered at mount and removal clears stale controls', async () => {
  const video = media();
  render(<MediaSessionBridge />);
  expect(session.playbackState).toBe('playing');
  await act(async () => {
    video.remove();
  });
  expect(session.playbackState).toBe('none');
  expect(session.metadata).toBeNull();
  handlers.play?.();
  expect(video.play).not.toHaveBeenCalled();
});

test('pausing one element keeps another playing element selected', () => {
  const first = media();
  const second = media();
  render(<MediaSessionBridge />);
  act(() => {
    first.dispatchEvent(new Event('play'));
  });
  Object.defineProperty(first, 'paused', { value: true });
  act(() => {
    first.dispatchEvent(new Event('pause'));
  });
  expect(session.playbackState).toBe('playing');
  handlers.pause?.();
  expect(second.pause).toHaveBeenCalledTimes(1);
  expect(first.pause).not.toHaveBeenCalled();
});

test('room listeners cannot bypass player controls through system actions; role changes apply immediately', () => {
  const video = media();
  const controller = {
    video,
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
  };
  playback = { controller, followingRoom: true, metadata: { title: '影片 A' } };
  room = { currentRoom: { id: 'room' }, canControl: false };
  const view = render(<MediaSessionBridge />);
  act(() => {
    video.dispatchEvent(new Event('play'));
  });
  handlers.pause?.();
  expect(video.pause).not.toHaveBeenCalled();
  expect(controller.pause).not.toHaveBeenCalled();
  room = { ...room, canControl: true };
  view.rerender(<MediaSessionBridge />);
  handlers.pause?.();
  expect(controller.pause).toHaveBeenCalledTimes(1);
  expect(video.pause).not.toHaveBeenCalled();
});

test('singleton metadata survives page title changes and updates without another play event', () => {
  const video = media();
  playback = {
    controller: { video },
    followingRoom: false,
    metadata: { title: '影片 A' },
  };
  const view = render(<MediaSessionBridge />);
  act(() => {
    video.dispatchEvent(new Event('play'));
  });
  expect(session.metadata?.init.title).toBe('影片 A');
  document.title = '搜索 · TongMuTV Plus';
  playback = { ...playback, metadata: { title: '影片 B' } };
  view.rerender(<MediaSessionBridge />);
  expect(session.metadata?.init.title).toBe('影片 B');
});

test('native action bridge works without browser MediaSession and is removed on unmount', () => {
  delete (navigator as unknown as { mediaSession?: unknown }).mediaSession;
  const video = media();
  const view = render(<MediaSessionBridge />);
  expect(window.__tmShellMediaAction?.('pause')).toBe(true);
  expect(video.pause).toHaveBeenCalledTimes(1);
  expect(window.__tmShellMediaAction?.('invalid')).toBe(false);
  view.unmount();
  expect(window.__tmShellMediaAction).toBeUndefined();
});

test('a rejected play promise is handled without changing actual playback state', async () => {
  const video = media(false);
  render(<MediaSessionBridge />);
  act(() => {
    video.dispatchEvent(new Event('play'));
  });
  video.play = jest.fn().mockRejectedValue(new Error('gesture required'));
  await act(async () => {
    handlers.play?.();
  });
  expect(session.playbackState).not.toBe('playing');
});

test('paused singleton selection survives metadata changes and uses its controller to resume', () => {
  const video = media();
  const controller = {
    video,
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
  };
  playback = { controller, followingRoom: false, metadata: { title: 'A' } };
  const view = render(<MediaSessionBridge />);
  Object.defineProperty(video, 'paused', { value: true });
  act(() => {
    video.dispatchEvent(new Event('pause'));
  });
  playback = { ...playback, metadata: { title: 'B' } };
  view.rerender(<MediaSessionBridge />);
  expect(session.playbackState).toBe('paused');
  handlers.play?.();
  expect(controller.play).toHaveBeenCalledTimes(1);
  expect(video.play).not.toHaveBeenCalled();
});

test('an unsupported action does not prevent other supported controls from registering', () => {
  session.setActionHandler.mockImplementation((name, handler) => {
    if (name === 'play') throw new Error('unsupported');
    handlers[name] = handler;
  });
  const video = media();
  render(<MediaSessionBridge />);
  handlers.pause?.();
  expect(video.pause).toHaveBeenCalledTimes(1);
});

test('a capable Android host owns the media session and receives actual paused/removed snapshots', async () => {
  const publish = jest.fn();
  Object.defineProperty(window, 'TMShell', {
    configurable: true,
    value: { setMediaState: publish },
  });
  const video = media();
  const view = render(<MediaSessionBridge />);
  expect(session.setActionHandler).not.toHaveBeenCalled();
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ v: 1, active: true, playing: true, canControl: true });
  Object.defineProperty(video, 'paused', { value: true });
  act(() => {
    video.dispatchEvent(new Event('pause'));
  });
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ active: true, playing: false });
  await act(async () => {
    video.remove();
  });
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ active: false, playing: false });
  view.unmount();
});

test('native metadata and room permission update without clearing the active session between renders', () => {
  const publish = jest.fn();
  Object.defineProperty(window, 'TMShell', {
    configurable: true,
    value: { setMediaState: publish },
  });
  const video = media();
  playback = {
    controller: { video },
    followingRoom: true,
    metadata: { title: 'Film A' },
  };
  room = { currentRoom: { id: 'room' }, canControl: false };
  const view = render(<MediaSessionBridge />);
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ title: 'Film A', canControl: false });
  publish.mockClear();
  room = { ...room, canControl: true };
  playback = { ...playback, metadata: { title: 'Film B' } };
  view.rerender(<MediaSessionBridge />);
  expect(publish.mock.calls.every(([raw]) => JSON.parse(raw).active)).toBe(
    true
  );
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ title: 'Film B', canControl: true });
  publish.mockClear();
  view.unmount();
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ active: false });
});

test('native PiP dimensions follow actual video metadata without another play event', () => {
  const publish = jest.fn();
  Object.defineProperty(window, 'TMShell', {
    configurable: true,
    value: { setMediaState: publish },
  });
  const video = media();
  Object.defineProperty(video, 'videoWidth', {
    configurable: true,
    value: 720,
  });
  Object.defineProperty(video, 'videoHeight', {
    configurable: true,
    value: 1280,
  });
  render(<MediaSessionBridge />);
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ videoWidth: 720, videoHeight: 1280 });
  Object.defineProperty(video, 'videoWidth', { value: 1920 });
  Object.defineProperty(video, 'videoHeight', { value: 1080 });
  act(() => {
    video.dispatchEvent(new Event('resize'));
  });
  expect(
    JSON.parse(publish.mock.calls[publish.mock.calls.length - 1][0])
  ).toMatchObject({ videoWidth: 1920, videoHeight: 1080 });
});
