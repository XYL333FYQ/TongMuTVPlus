/* eslint-disable @typescript-eslint/no-explicit-any */
import { resetPlayerEnvironmentForTest } from './env';
import { WatchPlayer } from './WatchPlayer';

const instances: any[] = [];

jest.mock('artplayer', () => {
  class FakeArt {
    option: any;
    handlers = new Map<string, Array<(...args: any[]) => void>>();
    video: any;
    template: any = {};
    notice = { show: '' };
    currentTime = 0;
    duration = 100;
    paused = true;
    fullscreenWeb = false;
    destroyed = false;
    switchedTo = '';
    static PLAYBACK_RATE: number[] = [];
    static USE_RAF = false;
    constructor(option: any) {
      this.option = option;
      this.video = document.createElement('video');
      instances.push(this);
    }
    on(event: string, handler: (...args: any[]) => void) {
      const list = this.handlers.get(event) || [];
      list.push(handler);
      this.handlers.set(event, list);
    }
    off() {
      return undefined;
    }
    emit(event: string, ...args: any[]) {
      (this.handlers.get(event) || []).forEach((handler) => handler(...args));
    }
    set switch(url: string) {
      this.switchedTo = url;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  return { __esModule: true, default: FakeArt };
});
jest.mock('hls.js', () => ({ __esModule: true, default: jest.fn() }));

const env = {
  webkit: false,
  ios: false,
  harmony: false,
  nativeHls: false,
  webgpu: false,
};

beforeEach(() => {
  instances.length = 0;
  resetPlayerEnvironmentForTest({ ...env });
  jest.useRealTimers();
});

const source = (url: string, extra: any = {}) => ({
  url,
  source: 'ffzy',
  title: '测试',
  ...extra,
});

test('creates once, then switches source without rebuilding', async () => {
  const dispose = jest.fn();
  const plugin = jest.fn(() => dispose);
  const player = new WatchPlayer({
    container: document.createElement('div'),
    plugins: [plugin],
  });
  await player.load(source('https://a/1.mp4'));
  expect(instances).toHaveLength(1);
  expect(plugin).toHaveBeenCalledTimes(1);
  await player.load(source('https://a/2.mp4'));
  expect(instances).toHaveLength(1);
  expect(instances[0].switchedTo).toBe('https://a/2.mp4');
  player.destroy();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(instances[0].destroyed).toBe(true);
});

test('webkit rebuilds the instance and restores position on rebuild', async () => {
  resetPlayerEnvironmentForTest({ ...env, webkit: true });
  const dispose = jest.fn();
  const player = new WatchPlayer({
    container: document.createElement('div'),
    plugins: [() => dispose],
  });
  await player.load(source('https://a/1.mp4'));
  instances[0].currentTime = 42;
  instances[0].paused = false;
  await player.rebuild();
  expect(instances).toHaveLength(2);
  expect(dispose).toHaveBeenCalledTimes(1);
  instances[1].emit('video:canplay');
  expect(instances[1].currentTime).toBe(42);
});

test('private sources load with CORS and fall back once on error', async () => {
  const onError = jest.fn();
  const player = new WatchPlayer({
    container: document.createElement('div'),
    onError,
  });
  await player.load(
    source('https://cdn/v.mkv', { source: 'xiaoya', mediaType: 'file' })
  );
  const art = instances[0];
  expect(art.option.moreVideoAttr.crossOrigin).toBe('anonymous');
  art.video.crossOrigin = 'anonymous';
  art.video.load = jest.fn();
  art.video.play = jest.fn(() => Promise.resolve());
  art.emit('error');
  expect(art.video.hasAttribute('crossorigin')).toBe(false);
  expect(onError).not.toHaveBeenCalled();
  art.emit('error');
  expect(onError).toHaveBeenCalledWith('视频播放失败');
});

test('listeners survive a rebuild', async () => {
  resetPlayerEnvironmentForTest({ ...env, webkit: true });
  const player = new WatchPlayer({ container: document.createElement('div') });
  const handler = jest.fn();
  player.on('play', handler);
  await player.load(source('https://a/1.mp4'));
  await player.load(source('https://a/2.mp4'));
  instances[1].emit('play');
  expect(handler).toHaveBeenCalledTimes(1);
});
