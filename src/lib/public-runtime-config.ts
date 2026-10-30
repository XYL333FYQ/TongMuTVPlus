// Guests only need presentation and public sign-in settings. Configured source,
// proxy and private-library URLs stay on the server until authentication.
const PUBLIC_RUNTIME_KEYS = [
  'STORAGE_TYPE',
  'DISPLAY_STORAGE_TYPE',
  'ENABLE_REGISTRATION',
  'REQUIRE_REGISTRATION_INVITE_CODE',
  'LOGIN_REQUIRE_TURNSTILE',
  'REGISTRATION_REQUIRE_TURNSTILE',
  'TURNSTILE_SITE_KEY',
  'ENABLE_OIDC_LOGIN',
  'ENABLE_OIDC_REGISTRATION',
  'OIDC_BUTTON_TEXT',
  'ENABLE_TELEGRAM_LOGIN',
  'TELEGRAM_BOT_USERNAME',
  'RATE_BADGE_STYLE',
  'CLIENT_DOWNLOAD_BASE_URL',
  // 模块开放状态是纯布尔值：访客也需要区分「未开放」与「需要登录」。
  'SITE_TV_MODE_ENABLED',
  'SITE_PRIVATE_LIBRARY_ENABLED',
  'SITE_MOVIE_REQUEST_ENABLED',
  'SITE_LIVE_ENABLED',
  'SITE_WEB_LIVE_ENABLED',
  'SITE_ADVANCED_RECOMMENDATION_ENABLED',
  'SITE_MUSIC_ENABLED',
  'SITE_MANGA_ENABLED',
  'SITE_BOOKS_ENABLED',
] as const;

export function projectGuestRuntimeConfig(
  configured: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    LOCAL_SETTINGS_SYNC_MODE: 'off',
    DOUBAN_PROXY_TYPE: 'direct',
    DOUBAN_PROXY: '',
    DOUBAN_IMAGE_PROXY_TYPE: 'direct',
    DOUBAN_IMAGE_PROXY: '',
    CUSTOM_CATEGORIES: [],
    SPECIAL_SOURCE_APIS: [],
    ENABLE_TV_MODE: false,
    ENABLE_TVBOX_SUBSCRIBE: false,
    ENABLE_OFFLINE_DOWNLOAD: false,
    OPENLIST_ENABLED: false,
    EMBY_ENABLED: false,
    XIAOYA_ENABLED: false,
    PRIVATE_LIBRARY_ENABLED: false,
    AI_ENABLED: false,
    AI_ENABLE_HOMEPAGE_ENTRY: false,
    AI_ENABLE_VIDEOCARD_ENTRY: false,
    AI_ENABLE_PLAYPAGE_ENTRY: false,
    EnableComments: false,
    AIConfig: { EnableAIComments: false },
    LIVE_ENABLED: false,
    WEB_LIVE_ENABLED: false,
    ADVANCED_RECOMMENDATION_ENABLED: false,
    MUSIC_ENABLED: false,
    SUWAYOMI_ENABLED: false,
    BOOKS_ENABLED: false,
    NETDISK_SEARCH_ENABLED: false,
    MAGNET_SEARCH_ENABLED: false,
    NETDISK_TRANSFER_ENABLED: false,
    NETDISK_TEMP_PLAY_ENABLED: false,
    MAGNET_SAVE_PRIVATE_LIBRARY_ENABLED: false,
    SITE_TV_MODE_ENABLED: false,
    SITE_PRIVATE_LIBRARY_ENABLED: false,
    SITE_MOVIE_REQUEST_ENABLED: false,
    SITE_LIVE_ENABLED: false,
    SITE_WEB_LIVE_ENABLED: false,
    SITE_ADVANCED_RECOMMENDATION_ENABLED: false,
    SITE_MUSIC_ENABLED: false,
    SITE_MANGA_ENABLED: false,
    SITE_BOOKS_ENABLED: false,
  };
  for (const key of PUBLIC_RUNTIME_KEYS) {
    if (Object.prototype.hasOwnProperty.call(configured, key)) {
      result[key] = configured[key];
    }
  }
  result.DOUBAN_IMAGE_PROXY_TYPE = guestDoubanImageProxyType(
    configured.DOUBAN_IMAGE_PROXY_TYPE
  );
  return result;
}

// 豆瓣海报的取图方式，游客也要能看到海报：
// - 公开镜像（腾讯/阿里 CDN、img3）只是个方式名，不含任何私密地址，原样给游客；
// - 站长自定义的代理地址可能带密钥，不给游客，改走本站中转（游客可用，仅限海报图床）；
// - 以前一律给 direct：浏览器直连豆瓣会被拒（HTTP 418），游客海报大面积先失败再换路。
const PUBLIC_IMAGE_PROXY_TYPES = new Set([
  'cmliussss-cdn-tencent',
  'cmliussss-cdn-ali',
  'img3',
  'server',
  'direct',
]);

function guestDoubanImageProxyType(configured: unknown): string {
  if (
    typeof configured === 'string' &&
    PUBLIC_IMAGE_PROXY_TYPES.has(configured)
  )
    return configured;
  if (configured === 'custom') return 'server';
  return 'cmliussss-cdn-tencent';
}
