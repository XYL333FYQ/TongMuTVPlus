import { publicPosterCandidates } from './public-poster';

const douban =
  'https://img9.doubanio.com/view/photo/l_ratio_poster/public/p1.jpg';
const relay = '/api/image-proxy?url=' + encodeURIComponent(douban);

test('douban posters try the public mirror, then the site relay, then direct', () => {
  expect(publicPosterCandidates(douban, undefined)).toEqual([
    'https://img.doubanio.cmliussss.net/view/photo/l_ratio_poster/public/p1.jpg',
    relay,
    douban,
  ]);
  expect(publicPosterCandidates(douban, 'cmliussss-cdn-ali')[0]).toBe(
    'https://img.doubanio.cmliussss.com/view/photo/l_ratio_poster/public/p1.jpg'
  );
  expect(publicPosterCandidates(douban, 'img3')[0]).toBe(
    'https://img3.doubanio.com/view/photo/l_ratio_poster/public/p1.jpg'
  );
});

test('server and direct site settings are respected', () => {
  expect(publicPosterCandidates(douban, 'server')).toEqual([relay, douban]);
  expect(publicPosterCandidates(douban, 'direct')).toEqual([douban, relay]);
});

test('other hosts load directly first and fall back to the relay', () => {
  const tmdb = 'https://image.tmdb.org/t/p/w500/a.jpg';
  expect(publicPosterCandidates(tmdb, undefined)).toEqual([
    tmdb,
    '/api/image-proxy?url=' + encodeURIComponent(tmdb),
  ]);
  expect(publicPosterCandidates('/icons/a.png', undefined)).toEqual([
    '/icons/a.png',
  ]);
  expect(publicPosterCandidates('', undefined)).toEqual([]);
});
