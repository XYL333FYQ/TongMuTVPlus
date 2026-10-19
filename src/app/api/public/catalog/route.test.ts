/** @jest-environment ./src/test/node-web-environment.cjs */

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(),
  API_CONFIG: { search: { headers: {} } },
}));
jest.mock('@/lib/douban', () => ({ fetchDoubanData: jest.fn() }));
jest.mock('@/lib/tmdb.client', () => ({ searchTMDBMulti: jest.fn() }));
jest.mock('@/lib/duanju', () => ({ getDuanjuSources: jest.fn() }));

import { NextRequest } from 'next/server';

import { getConfig } from '@/lib/config';
import { fetchDoubanData } from '@/lib/douban';
import { getDuanjuSources } from '@/lib/duanju';
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

it.each([
  ['anime', '动画'],
  ['show', '综艺'],
])('browses %s without substituting a movie feed', async (type, category) => {
  douban.mockResolvedValue({
    items: [
      {
        id: '88',
        title: '公开作品',
        type: 'tv',
        pic: { normal: 'https://img1.doubanio.com/a.jpg' },
        rating: { value: 8 },
      },
    ],
  });
  const response = await get('type=' + type);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.items[0].title).toBe('公开作品');
  const upstream = new URL(douban.mock.calls[0][0]);
  expect(upstream.pathname).toBe('/rexxar/api/v2/tv/recommend');
  expect(upstream.searchParams.get('tags')).toContain(category);
  expect(JSON.stringify(body)).not.toMatch(/episodes|credentials|api_key/);
});

it('short dramas expose metadata only, including pagination, never source keys or play URLs', async () => {
  (getDuanjuSources as jest.Mock).mockResolvedValue([
    {
      key: 'private-source',
      api: 'https://private-source.test/api?token=secret',
      typeId: '7',
    },
  ]);
  const original = global.fetch;
  const upstream = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      list: [
        {
          vod_id: 17,
          vod_name: '短剧甲',
          vod_pic: 'https://public-images.test/a.jpg?token=secret',
          vod_play_url: '第1集$https://private.test/a.m3u8?token=secret',
          credentials: 'secret',
        },
      ],
      pagecount: 2,
    }),
  });
  global.fetch = upstream;
  try {
    const response = await get('type=duanju&limit=1');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0]).toMatchObject({
      title: '短剧甲',
      provider: 'cms',
      poster: 'https://public-images.test/a.jpg',
    });
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe('2:0');
    expect(JSON.stringify(body)).not.toMatch(
      /private-source|secret|episodes|vod_play|credentials/
    );
    expect(new URL(upstream.mock.calls[0][0]).searchParams.get('ac')).toBe(
      'list'
    );
    expect(new URL(upstream.mock.calls[0][0]).searchParams.get('t')).toBe('7');
    await get('type=duanju&limit=1&start=1&cursor=2:0');
    expect(new URL(upstream.mock.calls[1][0]).searchParams.get('pg')).toBe('2');
  } finally {
    global.fetch = original;
  }
});

it('rejects category-only types in public search rather than silently returning another category', async () => {
  expect((await get('mode=search&q=x&type=anime')).status).toBe(400);
  expect(douban).not.toHaveBeenCalled();
});
