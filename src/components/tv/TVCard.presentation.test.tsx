import { fireEvent, render, screen } from '@testing-library/react';

import TVCard from './TVCard';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/utils', () => ({ processImageUrl: (url: string) => url }));

beforeEach(() => {
  push.mockClear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn((media: string) => ({
      media,
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })),
  });
});

test('the styled card preserves a supplied playback URL', () => {
  render(
    <TVCard
      item={{
        id: 'fixture',
        title: '电视影片',
        href: '/tv/play?source=fixture&id=42',
      }}
    />
  );
  fireEvent.click(screen.getByRole('button'));
  expect(push).toHaveBeenCalledWith('/tv/play?source=fixture&id=42');
});

test('missing metadata is absent and never replaced with invented recommendations', () => {
  render(<TVCard item={{ id: 'fixture', title: '只有片名' }} />);
  expect(screen.queryByText('推荐')).not.toBeInTheDocument();
  expect(screen.queryByText('即刻播放')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(push).toHaveBeenCalledWith(
    '/tv/detail?title=' + encodeURIComponent('只有片名')
  );
});

test('real metadata and default detail navigation remain intact', () => {
  render(
    <TVCard
      item={{
        id: 'fixture',
        title: '影片 & 剧集',
        year: '2026',
        type: 'tv',
        rate: '7.2',
      }}
    />
  );
  expect(screen.getByText('2026')).toBeInTheDocument();
  expect(screen.getByText('7.2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(push).toHaveBeenCalledWith(
    '/tv/detail?title=' +
      encodeURIComponent('影片 & 剧集') +
      '&year=2026&stype=tv'
  );
});

test('image arrival enables the presentation fade without changing its URL', () => {
  render(
    <TVCard
      item={{ id: 'fixture', title: '有海报', poster: '/qa-poster.svg' }}
    />
  );
  const image = screen.getByRole('img', { name: '有海报' });
  expect(image).not.toHaveAttribute('data-loaded', 'true');
  fireEvent.load(image);
  expect(image).toHaveAttribute('data-loaded', 'true');
  expect(image).toHaveAttribute('src', '/qa-poster.svg');
});
