import { act, fireEvent, render, screen } from '@testing-library/react';

import SourceSearchPage from './page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));
jest.mock('@/lib/special-source.client', () => ({
  appendSpecialSourceParam: (url: string) => url,
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/shell/BackToTop', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/VideoCard', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <article>{title}</article>,
}));
jest.mock('@/components/catalog/CapsuleSwitch', () => ({
  __esModule: true,
  default: ({
    options,
    onChange,
  }: {
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
  }) => (
    <div>
      {options.map((option) => (
        <button key={option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

type Reply = { ok: boolean; body?: unknown } | Promise<never>;
const json = (body: unknown): Reply => ({ ok: true, body });
const video = (id: string) => ({
  id,
  title: id,
  poster: '',
  episodes: ['1'],
  source: 'a',
  source_name: 'A',
});

// 按地址分发假响应；同一地址可排队多次不同结果
let routes: Record<string, Array<Reply | (() => Promise<Reply>)>>;
const requested: string[] = [];
const originalFetch = global.fetch;
const originalObserver = global.IntersectionObserver;
let observerCallback: IntersectionObserverCallback | null = null;

const route = (
  url: string,
  ...replies: Array<Reply | (() => Promise<Reply>)>
) => {
  routes[url] = [...(routes[url] || []), ...replies];
};

beforeEach(() => {
  routes = {};
  requested.length = 0;
  sessionStorage.clear();
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const queue = routes[url];
    if (!queue || queue.length === 0) throw new Error(`unexpected ${url}`);
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    const reply = typeof next === 'function' ? await next() : await next;
    return {
      ok: reply.ok,
      status: reply.ok ? 200 : 500,
      json: async () => reply.body,
    } as Response;
  }) as typeof fetch;
  global.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      observerCallback = callback;
    }
    observe() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  global.fetch = originalFetch;
  global.IntersectionObserver = originalObserver;
  observerCallback = null;
});

const SOURCES = '/api/source-search/sources';
const cats = (source: string) =>
  `/api/source-search/categories?source=${source}`;
const list = (source: string, category: string, page: number) =>
  `/api/source-search/videos?source=${source}&categoryId=${category}&page=${page}`;

const reachBottom = () =>
  act(() => {
    observerCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });

test('a failed next page stops auto paging and can be retried without losing loaded films', async () => {
  route(SOURCES, json({ sources: [{ key: 'a', name: 'A' }] }));
  route(cats('a'), json({ categories: [{ id: '1', name: '电影' }] }));
  route(
    list('a', '1', 1),
    json({ results: [video('第一页')], page: 1, pageCount: 3 })
  );
  route(
    list('a', '1', 2),
    { ok: false },
    json({ results: [video('第二页')], page: 2, pageCount: 3 })
  );

  render(<SourceSearchPage />);
  await screen.findByText('第一页');

  reachBottom();
  expect(
    await screen.findByText('下一页加载失败，已保留当前内容')
  ).toBeInTheDocument();
  expect(screen.getByText('第一页')).toBeInTheDocument();

  // 哨兵仍在视口里也不能继续往后翻，否则会无限请求并跳过失败的那页
  reachBottom();
  reachBottom();
  expect(requested.filter((url) => url.includes('page=3'))).toHaveLength(0);

  fireEvent.click(screen.getByRole('button', { name: '重试加载' }));
  await screen.findByText('第二页');
  expect(screen.getByText('第一页')).toBeInTheDocument();
  expect(requested.filter((url) => url === list('a', '1', 2))).toHaveLength(2);
});

test('a late category reply from the previous source does not replace the current source', async () => {
  let releaseA: (reply: Reply) => void = () => undefined;
  route(
    SOURCES,
    json({
      sources: [
        { key: 'a', name: 'A' },
        { key: 'b', name: 'B' },
      ],
    })
  );
  route(cats('a'), () => new Promise<Reply>((resolve) => (releaseA = resolve)));
  route(cats('b'), json({ categories: [{ id: 'b1', name: 'B 分类' }] }));
  route(
    list('b', 'b1', 1),
    json({ results: [video('B 的影片')], page: 1, pageCount: 1 })
  );
  route(
    list('a', 'a1', 1),
    json({ results: [video('A 的影片')], page: 1, pageCount: 1 })
  );

  render(<SourceSearchPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'B' }));
  await screen.findByText('B 的影片');

  await act(async () => {
    releaseA(json({ categories: [{ id: 'a1', name: 'A 分类' }] }) as Reply);
  });

  expect(
    screen.queryByRole('button', { name: 'A 分类' })
  ).not.toBeInTheDocument();
  expect(screen.queryByText('A 的影片')).not.toBeInTheDocument();
  expect(screen.getByText('B 的影片')).toBeInTheDocument();
});

test('failing to load sources shows a retry instead of “no sources”', async () => {
  route(SOURCES, { ok: false }, json({ sources: [{ key: 'a', name: 'A' }] }));
  route(cats('a'), json({ categories: [] }));

  render(<SourceSearchPage />);
  expect(await screen.findByText('视频源暂时无法获取')).toBeInTheDocument();
  expect(screen.queryByText('暂无可用的视频源')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '重试加载' }));
  expect(await screen.findByRole('button', { name: 'A' })).toBeInTheDocument();
});
