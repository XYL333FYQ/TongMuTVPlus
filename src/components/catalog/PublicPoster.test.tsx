import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import PublicPoster from '@/components/catalog/PublicPoster';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

test('public posters ignore private proxy preferences and never fall back to a protected API', () => {
  localStorage.setItem('doubanImageProxyType', 'server');
  localStorage.setItem(
    'doubanImageProxyUrl',
    'https://private.example/credentials'
  );
  render(
    <PublicPoster
      src='https://img3.doubanio.com/view/photo/s_ratio_poster/public/p123.jpg'
      alt='影片海报'
    />
  );
  const image = screen.getByRole('img', { name: '影片海报' });
  expect(image.getAttribute('src')).toContain('https://img3.doubanio.com/');
  fireEvent.error(image);
  expect(image.getAttribute('src')).toContain(
    'https://img.doubanio.cmliussss.net/'
  );
  expect(image.getAttribute('src')).not.toContain('/api/');
  fireEvent.error(image);
  expect(screen.getByRole('img', { name: '影片海报' }).tagName).toBe('SPAN');
});
