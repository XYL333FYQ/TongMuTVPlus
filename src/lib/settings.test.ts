import { LOCAL_SETTINGS_KEYS } from './local-settings-sync';
import {
  isSyncedSettingKey,
  readBool,
  readJson,
  readNumber,
  readSetting,
  removeSetting,
  subscribeSetting,
  writeSetting,
} from './settings';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.restoreAllMocks();
});

test('round-trips raw strings and keeps key names', () => {
  writeSetting('tm_player_volume', '0.3');
  expect(localStorage.getItem('tm_player_volume')).toBe('0.3');
  expect(readNumber('tm_player_volume', 1)).toBe(0.3);
  expect(readSetting('tm_player_volume')).toBe('0.3');
  removeSetting('tm_player_volume');
  expect(localStorage.getItem('tm_player_volume')).toBeNull();
});

test('booleans keep the true/false string format', () => {
  writeSetting('enable_blockad', 'false');
  expect(localStorage.getItem('enable_blockad')).toBe('false');
  expect(readBool('enable_blockad', true)).toBe(false);
  expect(readBool('fluidSearch', true)).toBe(true); // 没存过
  writeSetting('fluidSearch', 'yes');
  expect(readBool('fluidSearch', true)).toBe(true); // 认不出的值回落
});

test('numbers and json fall back on missing or broken values', () => {
  expect(readNumber('danmakuMaxCount', 5000)).toBe(5000);
  writeSetting('danmakuMaxCount', 'abc');
  expect(readNumber('danmakuMaxCount', 5000)).toBe(5000);
  writeSetting('directplay_proxy_domains', '["a.example"]');
  expect(readJson<string[]>('directplay_proxy_domains', [])).toEqual([
    'a.example',
  ]);
  writeSetting('directplay_proxy_domains', '{broken');
  expect(readJson<string[]>('directplay_proxy_domains', [])).toEqual([]);
});

test('session keys and key families go to the right storage', () => {
  writeSetting('announcementShown', '1');
  expect(sessionStorage.getItem('announcementShown')).toBe('1');
  expect(localStorage.getItem('announcementShown')).toBeNull();
  writeSetting('search_cache_tom', '{}');
  expect(sessionStorage.getItem('search_cache_tom')).toBe('{}');
  writeSetting('xiaoya_correction_xiaoya_1', '{}');
  expect(localStorage.getItem('xiaoya_correction_xiaoya_1')).toBe('{}');
});

test('a throwing storage reads null and writes nothing', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied');
  });
  expect(readSetting('subtitleSize')).toBeNull();
  expect(readBool('enable_blockad', true)).toBe(true);
  expect(() => writeSetting('subtitleSize', '3em')).not.toThrow();
  expect(() => removeSetting('subtitleSize')).not.toThrow();
});

test('listeners hear same-page writes and other-tab storage events', () => {
  const seen: (string | null)[] = [];
  const stop = subscribeSetting('homeBannerEnabled', (v) => seen.push(v));
  writeSetting('homeBannerEnabled', 'false');
  writeSetting('homeModules', '[]'); // 别的键不通知
  window.dispatchEvent(
    new StorageEvent('storage', { key: 'homeBannerEnabled', newValue: 'true' })
  );
  removeSetting('homeBannerEnabled');
  stop();
  writeSetting('homeBannerEnabled', 'true'); // 退订后不再通知
  expect(seen).toEqual(['false', 'true', null]);
});

test('LOCAL_SETTINGS_KEYS is unchanged', () => {
  expect(LOCAL_SETTINGS_KEYS).toEqual([
    'defaultAggregateSearch',
    'saveLivePlayRecords',
    'enableOptimization',
    'preferStrategy',
    'preferMode',
    'speedTestTimeout',
    'maxConcurrentDownloads',
    'downloadThreadsPerTask',
    'downloadSegmentTimeout',
    'downloadMode',
    'filesystemSavePath',
    'fluidSearch',
    'tmdb_backdrop_disabled',
    'enableTrailers',
    'doubanProxyUrl',
    'doubanDataSource',
    'doubanDataSourceBackup',
    'doubanProxyUrlBackup',
    'animeDataSource',
    'animeDataSourceBackup',
    'animeCustomBaseUrl',
    'animeImageBaseUrl',
    'doubanImageProxyType',
    'doubanImageProxyUrl',
    'doubanImageProxyTypeBackup',
    'doubanImageProxyUrlBackup',
    'tmdbImageBaseUrl',
    'bufferStrategy',
    'nextEpisodePreCache',
    'nextEpisodeDanmakuPreload',
    'disablePlaybackThumbnail',
    'disableEpisodeTitleFetch',
    'disableAutoLoadDanmaku',
    'danmakuMaxCount',
    'danmaku_heatmap_disabled',
    'homeBannerEnabled',
    'homeBannerHeightScale',
    'homeContinueWatchingEnabled',
    'homeModules',
    'danmakuTraditionalToSimplified',
    'searchTraditionalToSimplified',
    'exactSearch',
    'quickForwardSeconds',
    'seekStepSeconds',
  ]);
});

test('only synced keys from the registry are accepted from the cloud', () => {
  expect(isSyncedSettingKey('doubanProxyUrl')).toBe(true);
  // 账号菜单自己的时间戳和直连开关登记了，但不随云同步
  expect(isSyncedSettingKey('moontv_local_settings_sync_last_pull')).toBe(
    false
  );
  expect(isSyncedSettingKey('liveDirectConnect')).toBe(false);
  expect(isSyncedSettingKey('theme')).toBe(false);
  expect(isSyncedSettingKey('__proto__')).toBe(false);
});
