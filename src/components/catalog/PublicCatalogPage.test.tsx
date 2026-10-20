import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PublicCatalogPage from '@/components/catalog/PublicCatalogPage';

const mockPush = jest.fn();
let mockType = '';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () =>
    new URLSearchParams(mockType ? { type: mockType } : {}),
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/components/catalog/HomeRooms', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/catalog/HomeHero', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/catalog/PosterMotion', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
const originalFetch = global.fetch;
beforeEach(() => {
  mockType = '';
  mockPush.mockReset();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        {
          id: '88',
          title: '作品甲',
          poster: '',
          year: '2026',
          rate: '',
          mediaType: 'tv',
          provider: 'douban',
        },
      ],
      start: 0,
      hasMore: false,
    }),
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('all five homepage categories are browse links and only choosing a work goes to login', async () => {
  render(<PublicCatalogPage mode='home' />);
  for (const [label, href] of [
    ['电影', '/douban?type=movie'],
    ['剧集', '/douban?type=tv'],
    ['动漫', '/douban?type=anime'],
    ['综艺', '/douban?type=show'],
    ['短剧', '/duanju'],
  ]) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      href
    );
  }
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.click(
    (await screen.findAllByRole('button', { name: '查看影片介绍：作品甲' }))[0]
  );
  const login = new URL(mockPush.mock.calls[0][0], 'https://tongmu.test');
  expect(login.pathname).toBe('/login');
  const destination = new URL(
    login.searchParams.get('redirect')!,
    'https://tongmu.test'
  );
  expect(destination.pathname).toBe('/play');
  expect(destination.searchParams.get('title')).toBe('作品甲');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each(['anime', 'show', 'duanju'])(
  'library requests the actual %s category',
  async (type) => {
    mockType = type;
    render(<PublicCatalogPage mode='library' />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const request = new URL(
      (global.fetch as jest.Mock).mock.calls[0][0],
      'https://tongmu.test'
    );
    expect(request.searchParams.get('type')).toBe(type);
  }
);
