/** @jest-environment ./src/test/node-web-environment.cjs */

jest.mock('@/lib/config', () => ({ getConfig: jest.fn() }));
jest.mock('@/lib/douban', () => ({ fetchDoubanData: jest.fn() }));
jest.mock('@/lib/tmdb.client', () => ({ searchTMDBMulti: jest.fn() }));

import { NextRequest } from 'next/server';

import { getConfig } from '@/lib/config';
import { fetchDoubanData } from '@/lib/douban';
import { searchTMDBMulti } from '@/lib/tmdb.client';

import { GET } from './route';

const config = getConfig as jest.Mock;
const douban = fetchDoubanData as jest.Mock;
const tmdb = searchTMDBMulti as jest.Mock;
const get = (query: string) =>
  GET(new NextRequest(`https://tongmu.test/api/public/catalog?${query}`));

beforeEach(() => {
  jest.clearAllMocks();
  config.mockResolvedValue({
    SiteConfig: {},
    SourceConfig: [{ api: 'https://private.test?key=secret' }],
  });
});

it('projects only public metadata and strips signed queries from allowed image URLs', async () => {
  douban.mockResolvedValue([
    {
      id: '123',
      title: '测试影片',
      img: 'https://img1.doubanio.com/view/photo/s_ratio_poster/public/a.jpg?token=secret#private',
      year: '2025',
      episodes: ['https://private.test/film.m3u8?token=secret'],
      api: 'https://private.test',
      credentials: { password: 'secret' },
    },
  ]);
  const response = await get('mode=search&q=测试');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    items: [
      {
        id: '123',
        title: '测试影片',
        poster:
          'https://img1.doubanio.com/view/photo/s_ratio_poster/public/a.jpg',
        year: '2025',
        description: '',
        rate: '',
        mediaType: 'movie',
        provider: 'douban',
      },
    ],
    start: 0,
    hasMore: false,
  });
  expect(douban.mock.calls[0][0]).toBe(
    'https://movie.douban.com/j/subject_suggest?q=%E6%B5%8B%E8%AF%95'
  );
});

it('keeps the TMDB key server-side, excludes people, and does not echo error credentials', async () => {
  config.mockResolvedValue({ SiteConfig: { TMDBApiKey: 'private-api-key' } });
  tmdb.mockResolvedValue({
    code: 200,
    results: [
      {
        id: 1,
        title: '电影',
        media_type: 'movie',
        poster_path: '/poster.jpg',
        overview: '简介',
        vote_average: 8,
        release_date: '2024-02-01',
        episodes: ['secret'],
      },
      { id: 2, name: '演员', media_type: 'person' },
    ],
  });
  const response = await get('q=电影');
  const body = await response.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0].poster).toBe(
    'https://image.tmdb.org/t/p/w500/poster.jpg'
  );
  expect(JSON.stringify(body)).not.toMatch(/episodes|private-api-key|secret/);
  expect(douban).not.toHaveBeenCalled();
  tmdb.mockRejectedValueOnce(
    new Error('https://private.test/?api_key=private-api-key')
  );
  const failure = await get('q=电影');
  expect(failure.status).toBe(502);
  expect(await failure.text()).not.toContain('private-api-key');
});

it('uses a fixed public browse destination and rejects arbitrary poster origins', async () => {
  douban.mockResolvedValue({
    subjects: [
      {
        id: '5',
        title: '剧集',
        cover: 'https://private.test/film.m3u8?token=secret',
      },
    ],
  });
  const response = await get(
    'mode=browse&type=tv&tag=热门&start=20&limit=1&api=https://private.test'
  );
  const body = await response.json();
  expect(body.items[0].poster).toBe('');
  expect(body.items[0].mediaType).toBe('tv');
  expect(body.hasMore).toBe(true);
  expect(config).not.toHaveBeenCalled();
  const upstream = new URL(douban.mock.calls[0][0]);
  expect(upstream.origin).toBe('https://movie.douban.com');
  expect(upstream.searchParams.get('page_start')).toBe('20');
  expect(upstream.searchParams.has('api')).toBe(false);
});

it.each([
  'mode=wrong',
  'mode=search&q=',
  'q=test&limit=1000',
  'q=test&start=-1',
  'q=test&type=private',
])(
  'rejects invalid metadata parameters before upstream access: %s',
  async (query) => {
    expect((await get(query)).status).toBe(400);
    expect(douban).not.toHaveBeenCalled();
    expect(tmdb).not.toHaveBeenCalled();
    expect(config).not.toHaveBeenCalled();
  }
);
