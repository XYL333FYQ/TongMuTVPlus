import { act, fireEvent, render, screen } from '@testing-library/react';

import MovieRequestPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const originalFetch = global.fetch;
let seasonReplies: Array<() => Promise<Response>>;
const posts: string[] = [];

const ok = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);

beforeEach(() => {
  seasonReplies = [];
  posts.length = 0;
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') {
      posts.push(String(init.body));
      return ok({ success: true });
    }
    if (url.startsWith('/api/movie-requests')) return ok({ requests: [] });
    if (url.startsWith('/api/tmdb/search')) {
      return ok({
        results: [
          {
            id: 1,
            name: '甲剧',
            media_type: 'tv',
            first_air_date: '2020-01-01',
          },
          {
            id: 2,
            name: '乙剧',
            media_type: 'tv',
            first_air_date: '2021-01-01',
          },
        ],
      });
    }
    if (url.startsWith('/api/tmdb/seasons')) {
      const next = seasonReplies.shift();
      if (!next) throw new Error('no season reply');
      return next();
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const search = async () => {
  fireEvent.change(screen.getByRole('textbox', { name: '输入想求的片名' }), {
    target: { value: '剧' },
  });
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  return screen.findAllByRole('button', { name: '求片' });
};

test('no “not found” message appears while typing before any search', async () => {
  render(<MovieRequestPage />);
  fireEvent.change(
    await screen.findByRole('textbox', { name: '输入想求的片名' }),
    { target: { value: '还没搜' } }
  );
  expect(screen.queryByText(/没有找到/)).not.toBeInTheDocument();
});

test('season confirm stays disabled until seasons load, and a failed load never offers the previous show’s seasons', async () => {
  render(<MovieRequestPage />);
  const [first, second] = await search();

  let release: (value: Response) => void = () => undefined;
  seasonReplies.push(
    () => new Promise<Response>((resolve) => (release = resolve))
  );
  fireEvent.click(first);
  const confirm = await screen.findByRole('button', { name: '确认' });
  expect(confirm).toBeDisabled();
  fireEvent.click(confirm);
  expect(posts).toHaveLength(0);

  await act(async () =>
    release({
      ok: true,
      status: 200,
      json: async () => ({
        seasons: [
          { season_number: 1, name: '甲剧 第 1 季' },
          { season_number: 2, name: '甲剧 第 2 季' },
        ],
      }),
    } as Response)
  );
  expect(screen.getByRole('button', { name: '确认' })).not.toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '取消' }));

  seasonReplies.push(() => Promise.reject(new Error('network')));
  fireEvent.click(second);
  expect(await screen.findByText('季度信息暂时无法获取')).toBeInTheDocument();
  expect(screen.queryByText('甲剧 第 1 季')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '确认' })).toBeDisabled();
});
