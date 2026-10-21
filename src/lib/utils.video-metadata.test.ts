jest.mock('hls.js', () => ({
  __esModule: true,
  default: class {
    constructor() {
      throw new Error('MP4 不应进入 HLS 清单解析');
    }
  },
}));

import { getVideoResolutionFromM3u8, SpeedTestError } from './utils';

const createElement = document.createElement.bind(document);
const originalFetch = global.fetch;
let video: HTMLVideoElement;
let mode: 'metadata' | 'error' | 'timeout';

beforeEach(() => {
  mode = 'metadata';
  global.fetch = jest.fn().mockResolvedValue({});
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const node = createElement(tag);
    if (tag === 'video') {
      video = node as HTMLVideoElement;
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      const source = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        'src'
      );
      Object.defineProperty(video, 'src', {
        get: () => source?.get?.call(video),
        set: (value: string) => {
          source?.set?.call(video, value);
          if (mode !== 'timeout')
            queueMicrotask(() =>
              video.dispatchEvent(
                new Event(mode === 'metadata' ? 'loadedmetadata' : 'error')
              )
            );
        },
      });
      jest.spyOn(video, 'load').mockImplementation(() => undefined);
    }
    return node;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

test('MP4 地址带查询参数时用原生元数据返回真实清晰度', async () => {
  await expect(
    getVideoResolutionFromM3u8('https://media.example/test.MP4?token=keep')
  ).resolves.toEqual({
    quality: '1080p',
    loadSpeed: '未知',
    pingTime: expect.any(Number),
    bitrate: '未知',
  });
  expect(video.hasAttribute('src')).toBe(false);
});

test('MP4 元数据失败保留真实不可达错误并释放媒体请求', async () => {
  mode = 'error';
  await expect(
    getVideoResolutionFromM3u8('https://media.example/broken.mp4')
  ).rejects.toMatchObject({ name: 'SpeedTestError', type: 'unreachable' });
  expect(video.hasAttribute('src')).toBe(false);
});

test('MP4 元数据超时返回超时错误而不是虚构清晰度', async () => {
  mode = 'timeout';
  const result = getVideoResolutionFromM3u8(
    'https://media.example/slow.mp4',
    10
  );
  await expect(result).rejects.toBeInstanceOf(SpeedTestError);
  expect(video.hasAttribute('src')).toBe(false);
});
