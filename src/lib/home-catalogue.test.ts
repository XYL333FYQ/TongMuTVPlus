import { GetBangumiCalendarData } from './bangumi.client';
import { getDoubanCategories } from './douban.client';
import { loadHomeCatalogue } from './home-catalogue';

jest.mock('./bangumi.client', () => ({ GetBangumiCalendarData: jest.fn() }));
jest.mock('./douban.client', () => ({ getDoubanCategories: jest.fn() }));
const originalFetch = global.fetch;
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  global.fetch = originalFetch;
});

test('manual home refresh loads only visible sections and keeps their existing request parameters', async () => {
  (getDoubanCategories as jest.Mock).mockResolvedValue({
    code: 200,
    list: [{ id: '1', title: '新电影' }],
  });
  const result = await loadHomeCatalogue(['movies']);
  expect(getDoubanCategories).toHaveBeenCalledWith({
    kind: 'movie',
    category: '热门',
    type: '全部',
  });
  expect(GetBangumiCalendarData).not.toHaveBeenCalled();
  expect(result.data.movies?.[0].title).toBe('新电影');
  expect(result.failed).toEqual([]);
});

test('one failed section does not erase successful sections or pretend the refresh succeeded', async () => {
  (getDoubanCategories as jest.Mock).mockRejectedValue(new Error('offline'));
  (GetBangumiCalendarData as jest.Mock).mockResolvedValue([]);
  const result = await loadHomeCatalogue(['movies', 'bangumi']);
  expect(result.failed).toEqual(['movies']);
  expect(result.data).toEqual({ bangumi: [] });
});

test('upcoming entries retain the existing date ordering, including unknown dates last', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      code: 200,
      data: [
        { id: 3 },
        { id: 2, release_date: '2027-01-01' },
        { id: 1, release_date: '2026-12-01' },
      ],
    }),
  })) as unknown as typeof fetch;
  const result = await loadHomeCatalogue(['upcoming']);
  expect(result.data.upcoming?.map((item) => item.id)).toEqual([1, 2, 3]);
});

test('an aborted home refresh cannot return data for application to a different page', async () => {
  const controller = new AbortController();
  (getDoubanCategories as jest.Mock).mockImplementation(async () => {
    controller.abort();
    return { code: 200, list: [] };
  });
  await expect(
    loadHomeCatalogue(['movies'], controller.signal)
  ).rejects.toThrow();
});
