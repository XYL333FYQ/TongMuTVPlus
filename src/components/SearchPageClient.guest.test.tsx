jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => mockParams,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/auth', () => ({ getAuthInfoFromBrowserCookie: jest.fn() }));
jest.mock('@/lib/db.client', () => ({
  getSearchHistory: jest.fn(async () => []),
  addSearchHistory: jest.fn(),
  clearSearchHistory: jest.fn(),
  deleteSearchHistory: jest.fn(),
  subscribeToDataUpdates: jest.fn(() => () => undefined),
}));
jest.mock('@/lib/utils', () => ({ processImageUrl: (url: string) => url }));
jest.mock('@/lib/special-source.client', () => ({
  SPECIAL_SOURCE_PATH: '/under',
  isSpecialSourceContext: () => false,
  appendSpecialSourceParam: (url: string) => url,
}));
jest.mock('@/lib/danmaku/traditional-to-simplified', () => ({
  loadTraditionalToSimplifiedConverter: async () => (text: string) => text,
  getLoadedTraditionalToSimplifiedConverter: () => null,
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/VideoCard', () => ({
  __esModule: true,
  default: (props: {
    title: string;
    from: string;
    cmsData?: { desc?: string; episodes?: string[] };
  }) => (
    <span
      data-testid='video-card'
      data-from={props.from}
      data-cms={JSON.stringify(props.cmsData)}
    >
      {props.title}
    </span>
  ),
}));
jest.mock('@/components/VirtualScrollableGrid', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/SearchResultFilter', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/SearchSuggestions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/catalog/CapsuleSwitch', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ContinueWatching', () => ({
  __esModule: true,
  default: () => <span>私人继续观看</span>,
}));
jest.mock('@/components/PansouSearch', () => ({
  __esModule: true,
  default: () => null,
  CLOUD_TYPE_NAMES: {},
}));
jest.mock('@/components/AcgSearch', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ProxyImage', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/catalog/PublicPoster', () => ({
  __esModule: true,
  default: (props: { alt: string }) => (
    <span role='img' aria-label={props.alt} data-testid='public-poster' />
  ),
}));
jest.mock('@/components/feedback/ImageViewer', () => ({
  __esModule: true,
  default: () => null,
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  addSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import { SearchPageClient } from './SearchPageClient';

const mockParams = new URLSearchParams('q=测试');
const mockPush = jest.fn();
const fetchMock = jest.fn();
const cachedResult = {
  id: 'private-1',
  title: '测试私人影片',
  source: 'private',
  source_name: '私人影库',
  year: '2025',
  poster: '',
  episodes: ['https://private.test/play.m3u8?secret=credential'],
  episodes_titles: ['正片'],
  desc: '来源提供的影片简介',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem(
    'search_cache_测试',
    JSON.stringify({
      status: 'complete',
      results: [cachedResult],
      query: '测试',
      updatedAt: Date.now(),
    })
  );
  global.fetch = fetchMock;
  (window as unknown as { RUNTIME_CONFIG: unknown }).RUNTIME_CONFIG = {
    PRIVATE_LIBRARY_ENABLED: true,
    NETDISK_SEARCH_ENABLED: true,
    MAGNET_SEARCH_ENABLED: true,
  };
});

it('uses public metadata for guests, ignores authenticated playback caches, and preserves the saved private-library preference', async () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue(null);
  localStorage.setItem('searchPrivateLibraryOnly', 'true');
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        {
          id: '10',
          title: '测试公开影片',
          provider: 'douban',
          mediaType: 'movie',
          poster: '',
          year: '2025',
          description: '',
          rate: '',
        },
      ],
    }),
  });
  render(<SearchPageClient />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '观看 测试公开影片' })
    ).toBeInTheDocument()
  );
  expect(screen.queryByTestId('video-card')).not.toBeInTheDocument();
  expect(screen.getByTestId('public-poster')).toBeInTheDocument();
  expect(screen.queryByText('测试私人影片')).not.toBeInTheDocument();
  expect(getSearchHistory).not.toHaveBeenCalled();
  expect(addSearchHistory).not.toHaveBeenCalled();
  expect(subscribeToDataUpdates).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/public/catalog?mode=search&q=%E6%B5%8B%E8%AF%95',
    expect.any(Object)
  );
  expect(
    fetchMock.mock.calls.every(([url]) =>
      String(url).startsWith('/api/public/catalog?')
    )
  ).toBe(true);
  expect(localStorage.getItem('searchPrivateLibraryOnly')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '观看 测试公开影片' }));
  const target = new URL(mockPush.mock.calls[0][0], 'https://tongmu.test');
  expect(target.pathname).toBe('/play');
  expect(target.searchParams.get('title')).toBe('测试公开影片');
  expect(target.searchParams.has('source')).toBe(false);
});

it('retains the existing authenticated search-cache path', async () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'alice',
    role: 'user',
  });
  render(<SearchPageClient />);
  await waitFor(() =>
    expect(screen.getByTestId('video-card')).toHaveTextContent('测试私人影片')
  );
  expect(screen.getByTestId('video-card').getAttribute('data-from')).toBe(
    'search'
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(['agg', 'all'])(
  'passes source details to authenticated %s poster cards without another metadata lookup',
  async (viewMode) => {
    (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
      username: 'alice',
      role: 'user',
    });
    localStorage.setItem(
      'defaultAggregateSearch',
      JSON.stringify(viewMode === 'agg')
    );
    render(<SearchPageClient />);
    const card = await screen.findByTestId('video-card');
    await waitFor(() =>
      expect(JSON.parse(card.getAttribute('data-cms') || '{}')).toEqual({
        desc: cachedResult.desc,
        episodes: cachedResult.episodes,
        episodes_titles: cachedResult.episodes_titles,
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  }
);
