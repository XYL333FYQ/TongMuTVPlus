import { act, fireEvent, render, screen } from '@testing-library/react';

import { clearClientMemory } from '@/lib/client-memory';

import DoubanPage from './page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('type=movie'),
}));
jest.mock('@/hooks/useViewerIdentity', () => ({
  useViewerIdentity: () => ({ ready: true, isGuest: false }),
}));
jest.mock('@/lib/douban.client', () => ({
  getDoubanCategories: (...args: unknown[]) => mockCategories(...args),
  getDoubanRecommends: (...args: unknown[]) => mockRecommends(...args),
  getDoubanList: jest.fn(),
}));
jest.mock('@/lib/bangumi.client', () => ({
  GetBangumiCalendarData: jest.fn(),
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/VideoCard', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <article>{title}</article>,
}));
jest.mock('@/components/DoubanSelector', () => ({
  __esModule: true,
  default: ({
    onPrimaryChange,
  }: {
    onPrimaryChange: (value: string) => void;
  }) => <button onClick={() => onPrimaryChange('全部')}>推荐分类</button>,
}));
jest.mock('@/components/DoubanCustomSelector', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/BangumiScheduleTimeline', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/catalog/PublicCatalogPage', () => ({
  __esModule: true,
  default: () => null,
}));

const mockCategories = jest.fn();
const mockRecommends = jest.fn();
const page = (title: string) => ({
  code: 200,
  message: 'success',
  list: title ? [{ id: title, title, poster: '', rate: '', year: '' }] : [],
});
const originalObserver = global.IntersectionObserver;
let bounds: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockCategories.mockReset();
  mockRecommends.mockReset();
  global.IntersectionObserver = class {
    observe() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  } as unknown as typeof IntersectionObserver;
  bounds = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ bottom: 2000 } as DOMRect);
});
afterEach(() => {
  bounds.mockRestore();
  global.IntersectionObserver = originalObserver;
  document.documentElement.removeAttribute('data-tm-platform');
  clearClientMemory();
});

test('client tab return keeps loaded pages and continues at the next page', async () => {
  document.documentElement.dataset.tmPlatform = 'app';
  mockCategories
    .mockResolvedValueOnce(page('首批影片'))
    .mockResolvedValueOnce(page('第二批影片'))
    .mockResolvedValue(page('第三批影片'));
  const first = render(<DoubanPage />);
  await screen.findByText('首批影片');
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  await screen.findByText('第二批影片');
  first.unmount();
  render(<DoubanPage />);
  await screen.findByText('第二批影片');
  expect(screen.getByText('首批影片')).toBeInTheDocument();
  expect(mockCategories).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  await screen.findByText('第三批影片');
  expect(
    mockCategories.mock.calls.map(([request]) => request.pageStart)
  ).toEqual([0, 25, 50]);
});

test('leaving during pagination never remembers the uncompleted page counter', async () => {
  document.documentElement.dataset.tmPlatform = 'app';
  mockCategories
    .mockResolvedValueOnce(page('首批影片'))
    .mockImplementationOnce(() => new Promise(() => undefined))
    .mockResolvedValue(page('第二批影片'));
  const first = render(<DoubanPage />);
  await screen.findByText('首批影片');
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  first.unmount();
  render(<DoubanPage />);
  await screen.findByText('首批影片');
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  await screen.findByText('第二批影片');
  expect(
    mockCategories.mock.calls.map(([request]) => request.pageStart)
  ).toEqual([0, 25, 25]);
});

test('a failed next page can be retried without skipping films or replacing earlier films', async () => {
  mockCategories
    .mockResolvedValueOnce(page('首批影片'))
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(page('后续影片'))
    .mockResolvedValueOnce(page(''));
  render(<DoubanPage />);
  await screen.findByText('首批影片');
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  fireEvent.click(await screen.findByRole('button', { name: '重试加载' }));
  await screen.findByText('后续影片');
  expect(screen.getByText('首批影片')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  await screen.findByText('当前分类已加载完');
  expect(
    mockCategories.mock.calls.map(([request]) => request.pageStart)
  ).toEqual([0, 25, 25, 50]);
});

test('a late page from the previous category cannot appear after changing the filter', async () => {
  let resolveOldPage: (value: ReturnType<typeof page>) => void = () =>
    undefined;
  mockCategories
    .mockResolvedValueOnce(page('原分类影片'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOldPage = resolve;
        })
    );
  mockRecommends.mockResolvedValue(page('新分类影片'));
  render(<DoubanPage />);
  await screen.findByText('原分类影片');
  fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
  fireEvent.click(screen.getByRole('button', { name: '推荐分类' }));
  await screen.findByText('新分类影片');
  await act(async () => {
    resolveOldPage(page('不应出现的旧页'));
  });
  expect(screen.queryByText('不应出现的旧页')).not.toBeInTheDocument();
  expect(screen.getByText('新分类影片')).toBeInTheDocument();
});
