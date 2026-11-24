/**
 * 浏览器本地设置（localStorage / sessionStorage）的唯一入口。
 *
 * 组件和功能不直接碰浏览器存储，只经这里读写（STANDARD.md 公共零件“浏览器存储”）。
 * 键名一个都不改（含 moontv_*），值照旧存原样字符串：布尔是 'true' / 'false'，
 * 数字用 String()，对象用 JSON.stringify()，由调用方决定。
 * 存储不可用（隐私模式、配额满、服务端渲染）时读返回 null、写静默失败。
 */

export type SettingArea = 'local' | 'session';

interface SettingSpec {
  area: SettingArea;
  /** 是否随“本地设置云同步”上传（local-settings-sync 的白名单由此筛出） */
  sync: boolean;
}

const synced = { area: 'local', sync: true } as const;
const local = { area: 'local', sync: false } as const;
const session = { area: 'session', sync: false } as const;

/**
 * 所有固定键的登记。sync: true 的键按这里的先后组成云同步白名单，
 * 顺序就是原来 LOCAL_SETTINGS_KEYS 的顺序，不要随意调换。
 */
export const SETTINGS = {
  // —— 本地设置面板（云同步） ——
  defaultAggregateSearch: synced,
  saveLivePlayRecords: synced,
  enableOptimization: synced,
  preferStrategy: synced,
  preferMode: synced,
  speedTestTimeout: synced,
  maxConcurrentDownloads: synced,
  downloadThreadsPerTask: synced,
  downloadSegmentTimeout: synced,
  downloadMode: synced,
  filesystemSavePath: synced,
  fluidSearch: synced,
  tmdb_backdrop_disabled: synced,
  enableTrailers: synced,
  doubanProxyUrl: synced,
  doubanDataSource: synced,
  doubanDataSourceBackup: synced,
  doubanProxyUrlBackup: synced,
  animeDataSource: synced,
  animeDataSourceBackup: synced,
  animeCustomBaseUrl: synced,
  animeImageBaseUrl: synced,
  doubanImageProxyType: synced,
  doubanImageProxyUrl: synced,
  doubanImageProxyTypeBackup: synced,
  doubanImageProxyUrlBackup: synced,
  tmdbImageBaseUrl: synced,
  bufferStrategy: synced,
  nextEpisodePreCache: synced,
  nextEpisodeDanmakuPreload: synced,
  disablePlaybackThumbnail: synced,
  disableEpisodeTitleFetch: synced,
  disableAutoLoadDanmaku: synced,
  danmakuMaxCount: synced,
  danmaku_heatmap_disabled: synced,
  homeBannerEnabled: synced,
  homeBannerHeightScale: synced,
  homeContinueWatchingEnabled: synced,
  homeModules: synced,
  danmakuTraditionalToSimplified: synced,
  searchTraditionalToSimplified: synced,
  exactSearch: synced,
  // 播放器跳转时间：快捷快进与方向键步长分开存，两个键都跟着云同步走
  quickForwardSeconds: synced,
  seekStepSeconds: synced,

  // —— 站点外壳与提示 ——
  httpWarningDismissed: local,
  'tongmu:release-notice-seen': local,
  'tongmu:mini-player-offset': local,
  'tongmu:ios-install-hint-seen': local,
  hasSeenAnnouncement: local,
  announcementShown: session,

  // —— 账号菜单 ——
  // 云同步上次拉取 / 上传的时间（local-settings-sync 的 LOCAL_SETTINGS_SYNC_LAST_PULL_KEY）
  moontv_local_settings_sync_last_pull: local,
  // 直播直连开关：“恢复默认”时写回 false
  liveDirectConnect: local,

  // —— 首页缓存（一小时） ——
  homepage_movies: local,
  homepage_tvshows: local,
  homepage_variety: local,
  homepage_bangumi: local,
  homepage_duanju: local,
  homepage_upcoming: local,

  // —— 播放器（自己看和房间共用） ——
  tm_player_volume: local,
  preferredPlaybackRate: local,
  subtitleSize: local,
  danmaku_heatmap_enabled: local,
  enable_blockad: local,
  external_player_adblock: local,
  custom_ad_filter_code_cache: local,
  custom_ad_filter_version_cache: local,
  enable_anime4k: local,
  anime4k_mode: local,
  anime4k_scale: local,
  harmony_hls_playback_mode: local,
  netdisk_hls_playback_mode: local,
  directplay_proxy_domains: local,

  // —— 房间 ——
  'tm-together-chat-danmaku': local,
  'tm-together-dm-self': local,
  watch_room_screen_quality: local,
  watch_room_no_connect: local,
  watch_room_no_connect_timestamp: local,

  // —— 上游页面各自的设置和缓存（键名照旧；按最早用到它的文件分组） ——
  // app/admin/page.tsx
  admin_active_section: local,
  // app/books/read/page.tsx
  books_epub_reader_settings: local,
  books_epub_scrolled_positions: local,
  books_tts_settings: local,
  books_tts_voices_cache: local,
  // app/books/search/page.tsx
  book_search_state: session,
  // app/duanju/page.tsx
  duanju_state: session,
  // app/login/page.tsx
  rememberedCredentials: local,
  // app/manga/read/page.tsx
  mangaPageGap: local,
  mangaReadMode: local,
  mangaScaleMode: local,
  // app/manga/search/page.tsx
  manga_search_state: session,
  // app/music/MusicClient.tsx
  lyricsPiPMinimized: local,
  lyricsPiPOpacity: local,
  musicEqEnabled: local,
  musicEqGains: local,
  musicEqPreset: local,
  musicLoudnessEnabled: local,
  musicPitchRate: local,
  musicPlayState: local,
  musicReverbEnabled: local,
  musicReverbMainGain: local,
  musicReverbMix: local,
  musicReverbPreset: local,
  musicShowSpectrum: local,
  musicSurroundDistance: local,
  musicSurroundEnabled: local,
  musicSurroundSpeed: local,
  // app/source-search/page.tsx
  source_search_state: session,
  // app/tv/live/page.tsx
  tv_live_last_channel: local,
  // app/tv/live/play/page.tsx
  tv_player_muted: local,
  tv_player_volume: local,
  // app/tv/me/page.tsx
  moontv_local_remote_url: local,
  // app/tv/play/page.tsx
  tv_danmaku_enabled: local,
  tv_danmaku_settings: local,
  tv_playback_rate: local,
  // components/AcgSearch.tsx
  acgSearchSource: local,
  // components/SearchPageClient.tsx
  searchPrivateLibraryOnly: local,
  searchResultDisplayMode: local,
  // components/tv/TVRemoteReceiver.tsx
  moontv_tv_remote_device_id: local,
  // hooks/useAudioFocus.ts
  'tongmutvplus:audible-tab': local,
  // hooks/useVisualPreferences.ts
  'tm-visual-preferences-v1': local,
  // hooks/useWatchRoom.ts
  watch_room_info: local,
} as const satisfies Record<string, SettingSpec>;

/** 带变量的键：前缀登记在这里，后面拼影片、片源或搜索词 */
export const SETTING_FAMILIES = {
  banner_trending_cache_: local,
  xiaoya_correction_: local,
  search_cache_: session,
  book_search_cache_: session,
  manga_search_cache_: session,
  'ai-chat-': session,
  music_hot_search_: local,
  music_songlist_tags_: local,
  music_songlists_: local,
} as const satisfies Record<string, SettingSpec>;

type FixedKey = keyof typeof SETTINGS;
type FamilyKey = {
  [P in keyof typeof SETTING_FAMILIES]: `${P}${string}`;
}[keyof typeof SETTING_FAMILIES];
export type SettingKey = FixedKey | FamilyKey;

/** 同一页面里写入时派发，别的标签页靠浏览器自带的 storage 事件 */
const SAME_PAGE_EVENT = 'tm:setting';

function specOf(key: SettingKey): SettingSpec {
  if (key in SETTINGS) return SETTINGS[key as FixedKey];
  for (const prefix of Object.keys(SETTING_FAMILIES)) {
    if (key.startsWith(prefix))
      return SETTING_FAMILIES[prefix as keyof typeof SETTING_FAMILIES];
  }
  return local;
}

function storageOf(key: SettingKey): Storage | null {
  if (typeof window === 'undefined') return null;
  // 浏览器禁用存储时，连取 window.localStorage 都会抛错
  try {
    return specOf(key).area === 'session'
      ? window.sessionStorage
      : window.localStorage;
  } catch {
    return null;
  }
}

function announce(key: SettingKey, value: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SAME_PAGE_EVENT, { detail: { key, value } })
  );
}

export function readSetting(key: SettingKey): string | null {
  return readSettingStrict(key) ?? null;
}

/**
 * 和 readSetting 一样，但读不了（存储被禁用、抛错）时返回 undefined，好跟“没存过”（null）分开。
 * 需要在存储不可用时改走内存的地方用它（例如多个标签页抢声音）。
 */
export function readSettingStrict(key: SettingKey): string | null | undefined {
  const storage = storageOf(key);
  if (!storage) return undefined;
  try {
    return storage.getItem(key);
  } catch {
    return undefined;
  }
}

/** 返回这次有没有真的存进去（隐私模式、配额满时是 false，不抛错） */
export function writeSetting(key: SettingKey, value: string): boolean {
  let stored = false;
  try {
    const storage = storageOf(key);
    if (storage) {
      storage.setItem(key, value);
      stored = true;
    }
  } catch {
    // 隐私模式或配额满：这次存不下，不影响当前操作
  }
  announce(key, value);
  return stored;
}

export function removeSetting(key: SettingKey): void {
  try {
    storageOf(key)?.removeItem(key);
  } catch {
    // 同上
  }
  announce(key, null);
}

/** 'true' / 'false'，其他值（含没存过）用 fallback */
export function readBool(key: SettingKey, fallback: boolean): boolean {
  const value = readSetting(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

/** 没存过或不是有限数字时用 fallback；范围由调用方判断 */
export function readNumber(key: SettingKey, fallback: number): number {
  const value = readSetting(key);
  if (value === null || value.trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** 没存过或内容坏了时用 fallback；结构由调用方校验 */
export function readJson<T>(key: SettingKey, fallback: T): T {
  const value = readSetting(key);
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** 同页写入和别的标签页写入都会通知；返回退订函数 */
export function subscribeSetting(
  key: SettingKey,
  listener: (value: string | null) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onSamePage = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string; value: string | null }>)
      .detail;
    if (detail?.key === key) listener(detail.value);
  };
  const onOtherTab = (event: StorageEvent) => {
    if (event.key === key) listener(event.newValue);
  };
  window.addEventListener(SAME_PAGE_EVENT, onSamePage);
  window.addEventListener('storage', onOtherTab);
  return () => {
    window.removeEventListener(SAME_PAGE_EVENT, onSamePage);
    window.removeEventListener('storage', onOtherTab);
  };
}

/** 云同步白名单：登记里 sync: true 的键，顺序同登记 */
export function syncedSettingKeys(): SettingKey[] {
  return (Object.keys(SETTINGS) as FixedKey[]).filter(
    (key) => SETTINGS[key].sync
  );
}

/** 云端传来的键是不是白名单里的（只认登记过、随云同步的键） */
export function isSyncedSettingKey(key: string): key is SettingKey {
  return (
    Object.prototype.hasOwnProperty.call(SETTINGS, key) &&
    SETTINGS[key as FixedKey].sync
  );
}
