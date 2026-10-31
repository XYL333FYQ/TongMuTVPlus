jest.mock('@/lib/config', () => ({
  API_CONFIG: {
    search: {
      headers: {},
      path: '?ac=videolist&wd=',
      pagePath: '?ac=videolist&wd={query}&pg={page}',
    },
    detail: { headers: {}, path: '?ac=videolist&ids=' },
  },
  getConfig: jest.fn(async () => ({
    SiteConfig: { SearchDownstreamMaxPage: 1 },
  })),
}));
jest.mock('@/lib/search-cache', () => ({
  getCachedSearchPage: jest.fn(() => undefined),
  setCachedSearchPage: jest.fn(),
}));
jest.mock('@/lib/html-text', () => ({
  cleanHtmlTags: (value: string) => value || '',
}));

import type { ApiSite } from './config';
import {
  getDetailFromApi,
  getDetailFromApiV2,
  parseCmsPlayUrls,
  searchFromApi,
} from './downstream';

const site: ApiSite = {
  key: 'fixture',
  name: '测试源',
  api: 'https://cms.example.test/api.php',
};
const signedHls =
  'https://cdn.example.test/stream/index.m3u8?sign=a%2Fb+%26&expires=123#t=10.5';
const signedMp4 =
  'https://cdn.example.test/film.MP4?token=a$b%2Fc+%3D&expires=456#t=4,12';

describe('standard CMS direct media URLs', () => {
  it('keeps signed HLS and MP4 query strings, dollar characters and fragments byte-for-byte', () => {
    expect(parseCmsPlayUrls(`第一集$${signedHls}#第二集$${signedMp4}`)).toEqual(
      {
        episodes: [signedHls, signedMp4],
        titles: ['第一集', '第二集'],
      }
    );
  });

  it('selects the longest valid route without combining lines or reordering episode names', () => {
    const result = parseCmsPlayUrls(
      `预告$https://cdn.example.test/preview.m3u8$$$上篇$${signedMp4}#中篇$${signedHls}#下篇$https://cdn.example.test/finale.mp4$$$另一线$https://cdn.example.test/other.m3u8`
    );
    expect(result.episodes).toEqual([
      signedMp4,
      signedHls,
      'https://cdn.example.test/finale.mp4',
    ]);
    expect(result.titles).toEqual(['上篇', '中篇', '下篇']);
    expect(
      parseCmsPlayUrls(
        '首条$https://cdn.example.test/first.mp4$$$后条$https://cdn.example.test/second.m3u8'
      ).titles
    ).toEqual(['首条']);
  });

  it('drops invalid entries while keeping valid titles aligned with their URLs', () => {
    expect(
      parseCmsPlayUrls(
        `网页$https://site.example.test/watch.html?url=index.m3u8#上篇$${signedHls}#危险$javascript:alert(1).mp4#下篇$${signedMp4}`
      )
    ).toEqual({ episodes: [signedHls, signedMp4], titles: ['上篇', '下篇'] });
  });

  it.each([
    'javascript:alert(1).m3u8',
    'data:video/mp4;base64,AAAA',
    'file:///video.mp4',
    'blob:https://site.example.test/id',
    '//cdn.example.test/video.mp4',
    '/video.mp4',
    'not-a-url.mp4',
    'https://',
    'https://site.example.test/watch.html?file=video.mp4',
    'https://site.example.test/video.m3u8.html',
    'https://site.example.test/video',
    'https://user:password@cdn.example.test/video.mp4',
    'https://cdn.example.test/video.mp4?token=a b',
    'https://cdn.example.test/video.mp4\r\nX-Header: value',
  ])(
    'does not treat a webpage, credential-bearing URL or unsafe scheme as playable: %s',
    (url) => {
      expect(parseCmsPlayUrls(`测试$${url}`)).toEqual({
        episodes: [],
        titles: [],
      });
    }
  );

  it('does not guess at malformed CMS data or a URL without the title separator', () => {
    for (const input of [null, undefined, {}, [], 42, signedHls, '']) {
      expect(parseCmsPlayUrls(input)).toEqual({ episodes: [], titles: [] });
    }
  });
});

describe('search and both detail consumers use the same CMS rules', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pagecount: 1,
        list: [
          {
            vod_id: '42',
            vod_name: '测试影片',
            vod_pic: '',
            vod_content: '',
            vod_play_url: `第一集$${signedHls}#第二集$${signedMp4}`,
          },
        ],
      }),
    });
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps a signed MP4/HLS title in source search instead of filtering it as zero episodes', async () => {
    const results = await searchFromApi(site, '测试');
    expect(results).toHaveLength(1);
    expect(results[0].episodes).toEqual([signedHls, signedMp4]);
    expect(results[0].episodes_titles).toEqual(['第一集', '第二集']);
    expect(results[0].source).toBe('fixture');
  });

  it.each([
    ['detail', getDetailFromApi],
    ['source-detail', getDetailFromApiV2],
  ] as const)(
    '%s returns complete playable URLs and titles without changing the public result shape',
    async (_name, detail) => {
      const result = await detail(site, '42');
      expect(result.episodes).toEqual([signedHls, signedMp4]);
      expect(result.episodes_titles).toEqual(['第一集', '第二集']);
      expect(result.id).toBe('42');
    }
  );
});
