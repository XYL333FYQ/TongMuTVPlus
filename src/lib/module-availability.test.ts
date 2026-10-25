import { getModuleAvailability } from './module-availability';
import type { AdminConfig } from './admin.types';

const emptyConfig = {} as AdminConfig;

test('modules default to closed except movie request', () => {
  expect(getModuleAvailability(emptyConfig)).toEqual({
    live: false,
    webLive: false,
    music: false,
    books: false,
    manga: false,
    privateLibrary: false,
    movieRequest: true,
  });
});

test('live follows enabled sources, not just their presence', () => {
  expect(
    getModuleAvailability({
      LiveConfig: [{ key: 'a', name: 'a', url: 'u', from: 'custom' }],
    } as AdminConfig).live
  ).toBe(true);
  expect(
    getModuleAvailability({
      LiveConfig: [
        { key: 'a', name: 'a', url: 'u', from: 'custom', disabled: true },
      ],
    } as AdminConfig).live
  ).toBe(false);
});

test('manga requires both the switch and a server address', () => {
  expect(
    getModuleAvailability({
      SuwayomiConfig: { Enabled: true },
    } as AdminConfig).manga
  ).toBe(false);
  expect(
    getModuleAvailability({
      SuwayomiConfig: { Enabled: true, ServerURL: 'https://suwayomi.test' },
    } as AdminConfig).manga
  ).toBe(true);
});

test('private library opens through any configured media source', () => {
  const openList = {
    OpenListConfig: {
      Enabled: true,
      URL: 'https://openlist.test',
      Username: 'u',
      Password: 'p',
    },
  } as AdminConfig;
  expect(getModuleAvailability(openList).privateLibrary).toBe(true);

  const openListMissingPassword = {
    OpenListConfig: {
      Enabled: true,
      URL: 'https://openlist.test',
      Username: 'u',
    },
  } as AdminConfig;
  expect(getModuleAvailability(openListMissingPassword).privateLibrary).toBe(
    false
  );

  const emby = {
    EmbyConfig: {
      Sources: [{ key: 'e1', enabled: true, ServerURL: 'https://emby.test' }],
    },
  } as AdminConfig;
  expect(getModuleAvailability(emby).privateLibrary).toBe(true);

  const embyDisabledSource = {
    EmbyConfig: {
      Sources: [{ key: 'e1', enabled: false, ServerURL: 'https://emby.test' }],
    },
  } as AdminConfig;
  expect(getModuleAvailability(embyDisabledSource).privateLibrary).toBe(false);

  const xiaoya = {
    XiaoyaConfig: { Enabled: true, ServerURL: 'https://xiaoya.test' },
  } as AdminConfig;
  expect(getModuleAvailability(xiaoya).privateLibrary).toBe(true);
});

test('movie request stays open unless explicitly disabled', () => {
  expect(
    getModuleAvailability({
      SiteConfig: { EnableMovieRequest: false },
    } as AdminConfig).movieRequest
  ).toBe(false);
});
