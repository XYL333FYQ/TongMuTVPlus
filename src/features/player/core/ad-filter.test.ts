/* eslint-disable @typescript-eslint/no-explicit-any */

class BaseLoader {
  load: (...args: any[]) => void = () => undefined;
}
const Hls = { DefaultConfig: { loader: BaseLoader } };

beforeEach(() => {
  jest.resetModules();
  localStorage.clear();
  (window as any).RUNTIME_CONFIG = undefined;
  (global as any).fetch = jest.fn();
});

test('the first ad-filter loader picks up the cached custom filter code', async () => {
  localStorage.setItem(
    'custom_ad_filter_code_cache',
    'function filterAdsFromM3U8(type, m3u8Content) { return "custom:" + type; }'
  );
  localStorage.setItem('custom_ad_filter_version_cache', '3');
  (window as any).RUNTIME_CONFIG = { CUSTOM_AD_FILTER_VERSION: 3 };
  const { createAdFilterLoader, filterAds } = await import('./ad-filter');
  expect(filterAds('ffzy', '#EXTM3U')).toBe('#EXTM3U');
  createAdFilterLoader(Hls, () => 'ffzy');
  expect(filterAds('ffzy', '#EXTM3U')).toBe('custom:ffzy');
  // 版本号和缓存一致：不重新下载
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test('a new filter version is downloaded once', async () => {
  (window as any).RUNTIME_CONFIG = { CUSTOM_AD_FILTER_VERSION: 4 };
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      code: 'function filterAdsFromM3U8() { return "v4"; }',
    }),
  });
  const { createAdFilterLoader, filterAds } = await import('./ad-filter');
  createAdFilterLoader(Hls, () => 'ffzy');
  createAdFilterLoader(Hls, () => 'ffzy');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect((global as any).fetch).toHaveBeenCalledTimes(1);
  expect(filterAds('ffzy', '#EXTM3U')).toBe('v4');
  expect(localStorage.getItem('custom_ad_filter_version_cache')).toBe('4');
});
