import { act, render, screen } from '@testing-library/react';

import { refreshPage } from '@/lib/page-refresh';

import BannerCarousel from './BannerCarousel';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => undefined,
}));
jest.mock('@/components/DetailPanel', () => () => null);
jest.mock('@/lib/tmdb-image-base', () => ({
  getGenreNames: () => [],
  getTMDBImageUrl: (value: string) => value,
}));
const originalFetch = global.fetch;
const mockFetch = jest.fn();
const item = (title: string) => ({
  id: 1,
  title,
  poster_path: '/fixture.jpg',
  backdrop_path: null,
  overview: '',
  genre_ids: [],
  vote_average: 0,
  release_date: '',
});
const response = (title: string) => ({
  ok: true,
  json: async () => ({ code: 200, source: 'TX', list: [item(title)] }),
});

beforeEach(() => {
  jest.useFakeTimers();
  document.documentElement.dataset.tmPlatform = 'app';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  localStorage.clear();
  localStorage.setItem(
    'banner_trending_cache_TX',
    JSON.stringify({ data: [item('原推荐')], timestamp: Date.now() })
  );
  mockFetch.mockReset();
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  delete document.documentElement.dataset.tmPlatform;
  jest.useRealTimers();
});

test('app refresh bypasses the 24-hour banner cache while retaining the working recommendation', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  render(<BannerCarousel />);
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('原推荐');
  let pending!: ReturnType<typeof refreshPage>;
  await act(async () => {
    pending = refreshPage('/');
  });
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/tmdb/trending',
    expect.objectContaining({
      signal: expect.any(AbortSignal),
      cache: 'no-store',
    })
  );
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('原推荐');
  await act(async () => finish(response('新推荐')));
  expect(await pending).toBe('success');
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('新推荐');
  expect(
    JSON.parse(localStorage.getItem('banner_trending_cache_TX')!).data[0].title
  ).toBe('新推荐');
});

test('late banner responses after leaving cannot publish content or cache writes', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const { unmount } = render(<BannerCarousel />);
  let pending!: ReturnType<typeof refreshPage>;
  await act(async () => {
    pending = refreshPage('/');
  });
  const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  expect(await pending).toBe('cancelled');
  await act(async () => finish(response('迟到推荐')));
  expect(
    JSON.parse(localStorage.getItem('banner_trending_cache_TX')!).data[0].title
  ).toBe('原推荐');
});

test('failed refresh keeps the existing recommendation and reports failure', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 503 });
  render(<BannerCarousel />);
  await act(async () => expect(await refreshPage('/')).toBe('failed'));
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('原推荐');
});

test.each(['web', 'desktop'])(
  '%s keeps its existing banner lifecycle without registering app refresh',
  async (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    render(<BannerCarousel />);
    expect(await refreshPage('/')).toBe('unavailable');
    expect(mockFetch).not.toHaveBeenCalled();
  }
);

test('an old initial request cannot overwrite a completed explicit refresh', async () => {
  localStorage.clear();
  let initial!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise((resolve) => (initial = resolve)));
  mockFetch.mockResolvedValueOnce(response('刷新推荐'));
  render(<BannerCarousel />);
  await act(async () => expect(await refreshPage('/')).toBe('success'));
  await act(async () => initial(response('旧请求')));
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
    '刷新推荐'
  );
  expect(
    JSON.parse(localStorage.getItem('banner_trending_cache_TX')!).data[0].title
  ).toBe('刷新推荐');
});
