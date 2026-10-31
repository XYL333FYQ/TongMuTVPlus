import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import PublicPoster from '@/components/catalog/PublicPoster';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

test('public posters ignore private proxy preferences and walk mirror → guest relay → direct → placeholder', () => {
  localStorage.setItem('doubanImageProxyType', 'custom');
  localStorage.setItem(
    'doubanImageProxyUrl',
    'https://private.example/credentials'
  );
  const src =
    'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p123.jpg';
  render(<PublicPoster src={src} alt='影片海报' />);
  const image = () => screen.getByRole('img', { name: '影片海报' });
  expect(image().getAttribute('src')).toContain(
    'https://img.doubanio.cmliussss.net/'
  );
  expect(image().getAttribute('src')).not.toContain('private.example');
  fireEvent.error(image());
  // 游客可用的海报中转（中间件只放行豆瓣/TMDB/Bangumi 图床）
  expect(image().getAttribute('src')).toBe(
    '/api/image-proxy?url=' + encodeURIComponent(src)
  );
  fireEvent.error(image());
  expect(image().getAttribute('src')).toBe(src);
  fireEvent.error(image());
  expect(image().tagName).toBe('SPAN');
});

test('an image that finished before hydration is still shown (or skipped when it failed)', () => {
  const proto = HTMLImageElement.prototype;
  const complete = Object.getOwnPropertyDescriptor(proto, 'complete');
  const width = Object.getOwnPropertyDescriptor(proto, 'naturalWidth');
  let mirrorFails = false;
  Object.defineProperty(proto, 'complete', {
    configurable: true,
    get: () => true,
  });
  Object.defineProperty(proto, 'naturalWidth', {
    configurable: true,
    get(this: HTMLImageElement) {
      return mirrorFails && this.src.includes('cmliussss') ? 0 : 300;
    },
  });
  try {
    const src =
      'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p9.jpg';
    const { unmount } = render(<PublicPoster src={src} alt='海报甲' />);
    expect(
      screen.getByRole('img', { name: '海报甲' }).getAttribute('data-loaded')
    ).toBe('true');
    unmount();
    // 首选地址在接管前就失败：接管后应换到下一个地址，而不是一直空着
    mirrorFails = true;
    render(<PublicPoster src={src} alt='海报乙' />);
    expect(
      screen.getByRole('img', { name: '海报乙' }).getAttribute('src')
    ).toContain('/api/image-proxy?url=');
  } finally {
    if (complete) Object.defineProperty(proto, 'complete', complete);
    else delete (proto as unknown as Record<string, unknown>).complete;
    if (width) Object.defineProperty(proto, 'naturalWidth', width);
    else delete (proto as unknown as Record<string, unknown>).naturalWidth;
  }
});
