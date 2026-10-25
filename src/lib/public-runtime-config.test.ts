import { projectGuestRuntimeConfig } from './public-runtime-config';

it('keeps public sign-in settings while withholding private source and proxy credentials', () => {
  const configured = {
    STORAGE_TYPE: 'sqlite',
    DISPLAY_STORAGE_TYPE: 'sqlite',
    ENABLE_REGISTRATION: true,
    REQUIRE_REGISTRATION_INVITE_CODE: true,
    TURNSTILE_SITE_KEY: 'public-site-key',
    DOUBAN_PROXY: 'https://private:password@proxy.test/?token=hidden',
    DOUBAN_IMAGE_PROXY: 'https://proxy.test/?apikey=hidden',
    TMDB_IMAGE_BASE_URL: 'https://private:password@images.test',
    BANGUMI_API_BASE_URL: 'https://private.test/?token=hidden',
    HOME_BACKGROUND_IMAGE: 'https://private.test/?token=hidden',
    SPECIAL_SOURCE_APIS: ['https://private.test/source?apikey=hidden'],
    AI_ENABLED: true,
    OPENLIST_ENABLED: true,
    UNKNOWN_FUTURE_SECRET: 'hidden',
  };
  const result = projectGuestRuntimeConfig(configured);
  expect(result).toMatchObject({
    STORAGE_TYPE: 'sqlite',
    DISPLAY_STORAGE_TYPE: 'sqlite',
    ENABLE_REGISTRATION: true,
    REQUIRE_REGISTRATION_INVITE_CODE: true,
    TURNSTILE_SITE_KEY: 'public-site-key',
    DOUBAN_PROXY: '',
    DOUBAN_IMAGE_PROXY: '',
    SPECIAL_SOURCE_APIS: [],
    AI_ENABLED: false,
    OPENLIST_ENABLED: false,
  });
  expect(JSON.stringify(result)).not.toMatch(/hidden|password|private\.test/);
  expect(result).not.toHaveProperty('TMDB_IMAGE_BASE_URL');
  expect(result).not.toHaveProperty('UNKNOWN_FUTURE_SECRET');
  expect(configured.OPENLIST_ENABLED).toBe(true);
});

it('projects module availability booleans to guests without leaking credentials', () => {
  const configured = {
    SITE_MUSIC_ENABLED: true,
    SITE_BOOKS_ENABLED: false,
    SITE_TV_MODE_ENABLED: true,
    SITE_PRIVATE_LIBRARY_ENABLED: true,
    // 私密配置即使误传也必须被剔除
    MUSIC_BASE_URL: 'https://lxserver.test?token=hidden',
  };
  const result = projectGuestRuntimeConfig(configured);
  expect(result).toMatchObject({
    SITE_MUSIC_ENABLED: true,
    SITE_BOOKS_ENABLED: false,
    SITE_TV_MODE_ENABLED: true,
    SITE_PRIVATE_LIBRARY_ENABLED: true,
  });
  expect(result).not.toHaveProperty('MUSIC_BASE_URL');
  expect(JSON.stringify(result)).not.toMatch(/hidden/);
});

it('defaults missing availability flags to false for guests', () => {
  const result = projectGuestRuntimeConfig({});
  expect(result.SITE_MUSIC_ENABLED).toBe(false);
  expect(result.SITE_LIVE_ENABLED).toBe(false);
  expect(result.SITE_MOVIE_REQUEST_ENABLED).toBe(false);
});
