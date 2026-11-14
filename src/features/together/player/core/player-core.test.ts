import { defaultAdFilter, filterAds } from './ad-filter';
import { bufferConfig } from './hls-engine';
import {
  applyDanmakuFilter,
  limitDanmaku,
  matchDanmakuEpisode,
  narrowDanmakuSources,
} from './plugins/danmaku';
import { formatClock, formatDuration } from './plugins/format';
import { densityLabel, heatmapSegments } from './plugins/heatmap';
import { isM3u8LikePlayUrl } from './plugins/link-refresh';
import { engineOf } from './plugins/subtitles';
import {
  artplayerTypeFor,
  isHlsLikeUrl,
  isLazyDetailSource,
  isNetdiskMountSource,
  nativeHlsUrl,
  needsCrossOrigin,
  parseSourceForApi,
} from './source-policy';

describe('source policy', () => {
  test('lazy detail, netdisk mount and cross-origin sources', () => {
    expect(isLazyDetailSource('emby_home')).toBe(true);
    expect(isLazyDetailSource('script:abc')).toBe(true);
    expect(isLazyDetailSource('ffzy')).toBe(false);
    expect(isNetdiskMountSource('xiaoya')).toBe(true);
    expect(isNetdiskMountSource('netdisk-quark')).toBe(true);
    expect(isNetdiskMountSource('emby')).toBe(false);
    expect(needsCrossOrigin('emby_x')).toBe(true);
    expect(needsCrossOrigin('ffzy')).toBe(false);
    expect(parseSourceForApi('emby_home')).toEqual({
      source: 'emby',
      embyKey: 'home',
    });
    expect(parseSourceForApi('quark-temp')).toEqual({
      source: 'netdisk-quark',
    });
  });

  test('proxy m3u8 urls need an explicit type, files never do', () => {
    expect(artplayerTypeFor('/api/proxy-m3u8?url=x')).toBe('m3u8');
    expect(artplayerTypeFor('https://a/b.m3u8?x=1')).toBeUndefined();
    expect(artplayerTypeFor('/api/proxy-m3u8?url=x', 'file')).toBeUndefined();
    expect(isHlsLikeUrl('https://a/b.m3u8')).toBe(true);
    expect(isHlsLikeUrl('https://a/b.mp4')).toBe(false);
    expect(isHlsLikeUrl('https://a/b.m3u8', 'file')).toBe(false);
  });

  test('harmony native urls go through the ad-blocking proxy once', () => {
    const origin = 'https://site.test';
    expect(
      nativeHlsUrl('https://cdn/v.m3u8', { adBlock: true, source: 's', origin })
    ).toBe('/api/proxy-m3u8?url=https%3A%2F%2Fcdn%2Fv.m3u8&source=s');
    expect(
      nativeHlsUrl('/api/proxy-m3u8?url=x&adblock=false', {
        adBlock: true,
        source: 's',
        origin,
      })
    ).toBe('/api/proxy-m3u8?url=x');
    expect(
      nativeHlsUrl('/api/proxy/vod/m3u8?url=https%3A%2F%2Fcdn%2Fv.m3u8', {
        adBlock: true,
        source: 's',
        origin,
      })
    ).toContain('proxySegments=true');
    expect(
      nativeHlsUrl('https://cdn/v.m3u8', {
        adBlock: false,
        source: 's',
        origin,
      })
    ).toBe('https://cdn/v.m3u8');
  });
});

describe('ad filter', () => {
  const manifest = [
    '#EXTM3U',
    '#EXTINF:5,',
    'https://cdn/ok1.ts',
    '#EXT-X-DISCONTINUITY',
    '#EXTINF:5,',
    'https://cdn/ads/1.ts',
    '#EXTINF:5,',
    'https://cdn/ok2.ts',
  ].join('\n');

  test('drops ad segments and discontinuity markers', () => {
    const result = defaultAdFilter(manifest);
    expect(result).not.toContain('/ads/');
    expect(result).not.toContain('DISCONTINUITY');
    expect(result).toContain('ok1.ts');
    expect(result).toContain('ok2.ts');
    expect(filterAds('x', manifest)).toBe(result);
  });
});

describe('buffering', () => {
  test('rooms buffer at least two minutes ahead', () => {
    expect(bufferConfig('medium').maxBufferLength).toBe(30);
    const room = bufferConfig('medium', 120);
    expect(room.maxBufferLength).toBe(120);
    expect(room.maxBufferSize).toBeGreaterThanOrEqual(200e6);
    expect(bufferConfig('ultra', 120).maxBufferLength).toBe(120);
  });
});

describe('danmaku matching', () => {
  const animes = [
    { animeId: 1, animeTitle: '葬送的芙莉莲', startDate: '2023-09-29' },
    { animeId: 2, animeTitle: '葬送的芙莉莲 第二季', startDate: '2026-01-01' },
    { animeId: 3, animeTitle: '葬送的芙莉莲', startDate: '2020-01-01' },
  ] as never[];

  test('prefers exact title and year', () => {
    expect(narrowDanmakuSources(animes, '葬送的芙莉莲', '2023')).toHaveLength(
      1
    );
    expect(narrowDanmakuSources(animes, '葬送的芙莉莲')).toHaveLength(2);
    expect(narrowDanmakuSources(animes, '别的', '2026')).toHaveLength(1);
  });

  test('matches episodes by number, then by position', () => {
    const episodes = [
      { episodeId: 10, episodeTitle: '第1话' },
      { episodeId: 11, episodeTitle: '第2话' },
      { episodeId: 12, episodeTitle: '第3话' },
    ];
    expect(matchDanmakuEpisode(0, episodes, 'S01E03')?.episodeId).toBe(12);
    expect(matchDanmakuEpisode(1, episodes)?.episodeId).toBe(11);
    expect(matchDanmakuEpisode(9, episodes)?.episodeId).toBe(12);
    expect(matchDanmakuEpisode(0, [])).toBeNull();
  });

  test('filter rules and sampling', () => {
    const items = [{ text: '前方高能' }, { text: '哈哈哈' }, { text: '666' }];
    const config = {
      rules: [
        { keyword: '高能', type: 'normal', enabled: true, id: 'a' },
        { keyword: '^\\d+$', type: 'regex', enabled: true, id: 'b' },
        { keyword: '哈', type: 'normal', enabled: false, id: 'c' },
      ],
    } as never;
    expect(applyDanmakuFilter(items, config)).toEqual([{ text: '哈哈哈' }]);
    const { items: limited, original } = limitDanmaku([1, 2, 3, 4, 5, 6], 3);
    expect(limited).toEqual([1, 3, 5]);
    expect(original).toBe(6);
    expect(limitDanmaku([1, 2], 3).original).toBe(0);
  });
});

describe('small helpers', () => {
  test('heatmap density', () => {
    const data = heatmapSegments([1, 1, 1, 50], 100);
    expect(data).toHaveLength(20);
    expect(data[0]).toBe(1);
    expect(densityLabel(0.1)).toBe('低');
    expect(densityLabel(0.9)).toBe('极高');
    expect(heatmapSegments([], 100)).toEqual([]);
  });

  test('formatting', () => {
    expect(formatDuration(90)).toBe('1分30秒');
    expect(formatDuration(60)).toBe('1分钟');
    expect(formatDuration(10)).toBe('10秒');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(65)).toBe('1:05');
  });

  test('subtitle engines and link refresh urls', () => {
    expect(engineOf({ label: 'a', url: 'x', format: 'ASS' })).toBe('jassub');
    expect(engineOf({ label: 'a', url: 'x', codec: 'pgs' })).toBe('bitsub');
    expect(engineOf({ label: 'a', url: 'x', format: 'srt' })).toBe('native');
    expect(isM3u8LikePlayUrl('https://a/index.M3U8?x')).toBe(true);
    expect(isM3u8LikePlayUrl('https://a/v.mp4')).toBe(false);
  });
});
