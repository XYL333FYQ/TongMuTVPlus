import {
  type StreamVideo,
  attachFlvStream,
  attachHlsStream,
  createLivePlayer,
  detachFlvStream,
} from './media-engines';

function fakeHls() {
  const made: Array<Record<string, jest.Mock> & { config: unknown }> = [];
  class Hls {
    config: unknown;
    loadSource = jest.fn();
    attachMedia = jest.fn();
    destroy = jest.fn();
    constructor(config: unknown) {
      this.config = config;
      made.push(this as never);
    }
  }
  return { Hls, made };
}

test('挂 HLS 流前先拆掉原来的，配置叠在默认值上', () => {
  const { Hls, made } = fakeHls();
  const video = document.createElement('video') as StreamVideo;
  attachHlsStream(Hls, video, 'a.m3u8', { lowLatencyMode: true });
  attachHlsStream(Hls, video, 'b.m3u8');
  expect(made[0].destroy).toHaveBeenCalled();
  expect(made[0].config).toEqual({
    debug: false,
    enableWorker: true,
    lowLatencyMode: true,
  });
  expect(made[1].loadSource).toHaveBeenCalledWith('b.m3u8');
  expect(video.hls).toBe(made[1]);
});

test('FLV 出错回调在开始加载前挂上；拆掉时先停加载', () => {
  const order: string[] = [];
  const player = {
    attachMediaElement: jest.fn(),
    on: jest.fn(() => order.push('on')),
    load: jest.fn(() => order.push('load')),
    unload: jest.fn(),
    destroy: jest.fn(),
  };
  const flvjs = {
    createPlayer: jest.fn(() => player),
    Events: { ERROR: 'error' },
  };
  const video = document.createElement('video') as StreamVideo;
  attachFlvStream(flvjs, video, 'live.flv', { onError: jest.fn() });
  expect(flvjs.createPlayer).toHaveBeenCalledWith({
    type: 'flv',
    url: 'live.flv',
    isLive: true,
  });
  expect(order).toEqual(['on', 'load']);
  detachFlvStream(video);
  expect(player.unload).toHaveBeenCalled();
  expect(player.destroy).toHaveBeenCalled();
  expect(video.flv).toBeNull();
});

test('直播播放器带共同样子，调用方的图标叠在上面', () => {
  const Artplayer = jest.fn(function (this: unknown, options: unknown) {
    return { options };
  }) as unknown as new (options: Record<string, unknown>) => {
    options: Record<string, unknown>;
  };
  const art = createLivePlayer(Artplayer, {
    url: 'x',
    icons: { state: '<i></i>' },
  });
  expect(art.options).toMatchObject({
    isLive: true,
    url: 'x',
    theme: 'var(--tm-room-player-text)',
  });
  expect(Object.keys(art.options.icons as object)).toEqual([
    'loading',
    'state',
  ]);
});
