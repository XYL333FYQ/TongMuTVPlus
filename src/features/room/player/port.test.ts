import { BACKGROUND_PAUSE_GRACE_MS, portFor } from './port';

function fakePlayer(video: HTMLVideoElement) {
  const handlers = new Map<string, () => void>();
  const player = {
    video,
    on: (name: string, handler: () => void) => {
      handlers.set(name, handler);
      return () => handlers.delete(name);
    },
  } as never;
  return { player, fire: (name: string) => handlers.get(name)?.() };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

test('player events from a video that left the page are ignored', () => {
  const video = document.createElement('video');
  document.body.appendChild(video);
  const { player, fire } = fakePlayer(video);
  const listener = jest.fn();
  portFor(player).on('pause', listener);
  fire('video:pause');
  jest.advanceTimersByTime(BACKGROUND_PAUSE_GRACE_MS);
  expect(listener).toHaveBeenCalledTimes(1);
  video.remove();
  fire('video:pause');
  jest.advanceTimersByTime(BACKGROUND_PAUSE_GRACE_MS);
  expect(listener).toHaveBeenCalledTimes(1);
});

test('a pause caused by the page going to the background is not a user pause', () => {
  const video = document.createElement('video');
  document.body.appendChild(video);
  const { player, fire } = fakePlayer(video);
  const listener = jest.fn();
  portFor(player).on('pause', listener);
  const visibility = jest
    .spyOn(document, 'visibilityState', 'get')
    .mockReturnValue('hidden');
  fire('video:pause');
  jest.advanceTimersByTime(BACKGROUND_PAUSE_GRACE_MS);
  expect(listener).not.toHaveBeenCalled();
  // 有的浏览器先暂停、过一会儿才把页面标成隐藏：同样不算
  visibility.mockReturnValue('visible');
  fire('video:pause');
  visibility.mockReturnValue('hidden');
  jest.advanceTimersByTime(BACKGROUND_PAUSE_GRACE_MS);
  expect(listener).not.toHaveBeenCalled();
  // 前台的暂停照常算用户操作
  visibility.mockReturnValue('visible');
  fire('video:pause');
  jest.advanceTimersByTime(BACKGROUND_PAUSE_GRACE_MS);
  expect(listener).toHaveBeenCalledTimes(1);
});

test('other events are reported immediately', () => {
  const video = document.createElement('video');
  document.body.appendChild(video);
  const { player, fire } = fakePlayer(video);
  const listener = jest.fn();
  portFor(player).on('seeked', listener);
  fire('video:seeked');
  expect(listener).toHaveBeenCalledTimes(1);
});

test('a play blocked by the browser reaches the sync engine as an error', async () => {
  const player = {
    video: document.createElement('video'),
    playOrThrow: () =>
      Promise.reject(new DOMException('blocked', 'NotAllowedError')),
    on: () => () => undefined,
  } as never;
  await expect(portFor(player).play()).rejects.toThrow('blocked');
});

test('a pause caused by a media error is not a user pause', () => {
  const video = document.createElement('video');
  document.body.appendChild(video);
  Object.defineProperty(video, 'error', {
    configurable: true,
    get: () => ({ code: 3, message: 'decode error' }),
  });
  const { player, fire } = fakePlayer(video);
  const listener = jest.fn();
  portFor(player).on('pause', listener);
  fire('video:pause');
  jest.advanceTimersByTime(BACKGROUND_PAUSE_GRACE_MS);
  expect(listener).not.toHaveBeenCalled();
});
