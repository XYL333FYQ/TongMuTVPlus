import type { DoubanProxyType } from '@/lib/douban.client';
import type { DoubanImageProxyType } from '@/lib/utils';

/**
 * 根布局写进页面的 window.RUNTIME_CONFIG（src/app/layout.tsx 的 runtimeConfig；
 * 访客看到的是 lib/public-runtime-config 裁剪过的版本，所以每一项都可能没有）。
 */
interface ClientRuntimeConfig {
  STORAGE_TYPE: string;
  DISPLAY_STORAGE_TYPE: string;
  LOCAL_SETTINGS_SYNC_MODE: 'off' | 'manual' | 'auto';
  DOUBAN_PROXY_TYPE: DoubanProxyType;
  DOUBAN_PROXY: string;
  DOUBAN_IMAGE_PROXY_TYPE: DoubanImageProxyType;
  DOUBAN_IMAGE_PROXY: string;
  DISABLE_YELLOW_FILTER: boolean;
  CUSTOM_CATEGORIES: { name: string; type: 'movie' | 'tv'; query: string }[];
  FLUID_SEARCH: boolean;
  EnableComments: boolean;
  DANMAKU_AUTO_LOAD_DEFAULT: boolean;
  RecommendationDataSource: string;
  TMDB_IMAGE_BASE_URL: string;
  BANGUMI_DATA_SOURCE: string;
  BANGUMI_API_BASE_URL: string;
  BANGUMI_IMAGE_BASE_URL: string;
  ENABLE_TV_MODE: boolean;
  SITE_TV_MODE_ENABLED: boolean;
  ENABLE_TVBOX_SUBSCRIBE: boolean;
  ENABLE_OFFLINE_DOWNLOAD: boolean;
  ENABLE_ROOM_VOICE: boolean;
  VOICE_CHAT_STRATEGY: string;
  OPENLIST_ENABLED: boolean;
  EMBY_ENABLED: boolean;
  XIAOYA_ENABLED: boolean;
  PRIVATE_LIBRARY_ENABLED: boolean;
  SITE_PRIVATE_LIBRARY_ENABLED: boolean;
  LOGIN_BACKGROUND_IMAGE: string;
  REGISTER_BACKGROUND_IMAGE: string;
  HOME_BACKGROUND_IMAGE: string;
  PROGRESS_THUMB_TYPE: string;
  PROGRESS_THUMB_PRESET_ID: string;
  PROGRESS_THUMB_CUSTOM_URL: string;
  ENABLE_REGISTRATION: boolean;
  REQUIRE_REGISTRATION_INVITE_CODE: boolean;
  LOGIN_REQUIRE_TURNSTILE: boolean;
  REGISTRATION_REQUIRE_TURNSTILE: boolean;
  TURNSTILE_SITE_KEY: string;
  ENABLE_OIDC_LOGIN: boolean;
  ENABLE_OIDC_REGISTRATION: boolean;
  OIDC_BUTTON_TEXT: string;
  ENABLE_TELEGRAM_LOGIN: boolean;
  TELEGRAM_BOT_USERNAME: string;
  AI_ENABLED: boolean;
  AI_ENABLE_HOMEPAGE_ENTRY: boolean;
  AI_ENABLE_VIDEOCARD_ENTRY: boolean;
  AI_ENABLE_PLAYPAGE_ENTRY: boolean;
  AIConfig: { EnableAIComments?: boolean };
  AI_DEFAULT_MESSAGE_NO_VIDEO: string;
  AI_DEFAULT_MESSAGE_WITH_VIDEO: string;
  ENABLE_MOVIE_REQUEST: boolean;
  SITE_MOVIE_REQUEST_ENABLED: boolean;
  LIVE_ENABLED: boolean;
  SITE_LIVE_ENABLED: boolean;
  WEB_LIVE_ENABLED: boolean;
  SITE_WEB_LIVE_ENABLED: boolean;
  ADVANCED_RECOMMENDATION_ENABLED: boolean;
  SITE_ADVANCED_RECOMMENDATION_ENABLED: boolean;
  CUSTOM_AD_FILTER_VERSION: number;
  MUSIC_ENABLED: boolean;
  SITE_MUSIC_ENABLED: boolean;
  MUSIC_PROXY_ENABLED: boolean;
  SUWAYOMI_ENABLED: boolean;
  SITE_MANGA_ENABLED: boolean;
  BOOKS_ENABLED: boolean;
  SITE_BOOKS_ENABLED: boolean;
  NETDISK_SEARCH_ENABLED: boolean;
  MAGNET_SEARCH_ENABLED: boolean;
  MAGNET_SAVE_PRIVATE_LIBRARY_ENABLED: boolean;
  NETDISK_TRANSFER_ENABLED: boolean;
  NETDISK_TEMP_PLAY_ENABLED: boolean;
  FESTIVE_EFFECT_ENABLED: boolean;
  SPECIAL_SOURCE_APIS: unknown[];
  RATE_BADGE_STYLE: string;
  CLIENT_DOWNLOAD_BASE_URL: string;
  /** 下面两项根布局现在不写，读的地方按“没有”处理 */
  SITE_BASE: string;
  ENABLE_SOURCE_SEARCH: boolean;
}

declare global {
  interface Window {
    RUNTIME_CONFIG?: Partial<ClientRuntimeConfig>;
  }
}
