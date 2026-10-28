import { act, cleanup, render } from '@testing-library/react';

import MusicClient from './MusicClient';

jest.mock(
  'styled-jsx/style',
  () => ({ __esModule: true, default: () => null }),
  { virtual: true }
);
jest.mock('next/navigation', () => ({
  usePathname: () => '/music',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/hooks/useRoomMusicActivity', () => ({
  useRoomMusicActivity: () => ({
    hasRoom: false,
    isInRoom: false,
    active: false,
    canControl: false,
    publishing: false,
    share: jest.fn(async () => undefined),
    publish: jest.fn(async () => undefined),
    beginLocalPlayback: jest.fn(async () => true),
  }),
}));
jest.mock('@/features/playback/RoomActivityActions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/features/playback/useAudioFocus', () => ({
  useAudioFocus: () => ({ ownsSound: true, claimSound: jest.fn() }),
}));
jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/LyricsPiPWindow', () => ({
  __esModule: true,
  default: () => null,
}));

const song = (id: string) => ({
  id,
  name: `歌 ${id}`,
  artist: '歌手',
  album: '专辑',
  pic: '',
  platform: 'wy',
  duration: 200,
});

type Deferred = { resolve: (value: unknown) => void };
let playCalls: Array<{ songId: string; deferred: Deferred }>;
const originalFetch = global.fetch;

const playReply = (id: string) => ({
  success: true,
  data: {
    song: { cover: `cover-${id}` },
    lyric: { lyric: `[00:01.00]歌词 ${id}` },
    play: { directUrl: `https://cdn.test/${id}.mp3` },
  },
});

beforeEach(() => {
  playCalls = [];
  Object.defineProperty(window, 'RUNTIME_CONFIG', {
    configurable: true,
    // 不走本站代理：先请求播放地址，再把地址交给 <audio>
    value: { MUSIC_PROXY_ENABLED: false, MUSIC_ENABLED: true },
  });
  jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  jest
    .spyOn(HTMLMediaElement.prototype, 'load')
    .mockImplementation(() => undefined);
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/music/v2/play')) {
      const body = JSON.parse(String(init?.body));
      return new Promise((resolve) => {
        playCalls.push({
          songId: body.song.songId,
          deferred: {
            resolve: (value) =>
              resolve({ ok: true, json: async () => value } as Response),
          },
        });
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

const play = (id: string) =>
  act(async () => {
    window.dispatchEvent(
      new CustomEvent('music:play-song', {
        detail: { song: song(id), index: 0 },
      })
    );
    await Promise.resolve();
  });
const audioSrc = () =>
  (document.querySelector('audio') as HTMLAudioElement | null)?.getAttribute(
    'src'
  );

it('a slow answer for song A cannot take over the player after the user already chose song B', async () => {
  render(<MusicClient />);
  await play('A');
  await play('B');
  expect(playCalls.map((call) => call.songId)).toEqual(['A', 'B']);
  // B 先回来，A 很晚才回来
  await act(async () => {
    playCalls[1].deferred.resolve(playReply('B'));
  });
  expect(audioSrc()).toBe('https://cdn.test/B.mp3');
  await act(async () => {
    playCalls[0].deferred.resolve(playReply('A'));
  });
  expect(audioSrc()).toBe('https://cdn.test/B.mp3');
});

it('the answer for the song that is still current is applied', async () => {
  render(<MusicClient />);
  await play('A');
  await act(async () => {
    playCalls[0].deferred.resolve(playReply('A'));
  });
  expect(audioSrc()).toBe('https://cdn.test/A.mp3');
});
