import { fireEvent, render, screen } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';

import MediaCard from './MediaCard';

jest.mock('@/components/ProxyImage', () => ({
  __esModule: true,
  default: ({
    originalSrc,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { originalSrc: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={originalSrc} {...props} alt={props.alt} />
  ),
}));

beforeEach(() => {
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

test('image arrival fades the existing image without changing its address or cover aspect', () => {
  const { container } = render(
    <MediaCard item={{ key: 'book', title: '书名', image: '/qa-cover.svg' }} />
  );
  const image = screen.getByRole('img', { name: '书名' });
  expect(image).not.toHaveAttribute('data-loaded', 'true');
  fireEvent.load(image);
  expect(image).toHaveAttribute('data-loaded', 'true');
  expect(image).toHaveAttribute('src', '/qa-cover.svg');
  expect(container.querySelector('.aspect-\\[3\\/4\\]')).toBeInTheDocument();
});

test('press cards keep click, Enter and Space actions with a single keyboard target', () => {
  const onPress = jest.fn();
  const { container } = render(
    <MediaCard
      item={{ key: 'book', title: '书名' }}
      interactive='press'
      onPress={onPress}
    />
  );
  const card = screen.getByRole('button', { name: '书名' });
  fireEvent.click(card);
  fireEvent.keyDown(card, { key: 'Enter' });
  fireEvent.keyDown(card, { key: ' ' });
  fireEvent.keyDown(card, { key: 'Escape' });
  expect(onPress).toHaveBeenCalledTimes(3);
  expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
});

test('the shelf control stays outside the navigation link and does not trigger navigation', () => {
  const onNavigate = jest.fn();
  const onShelf = jest.fn();
  render(
    <MediaCard
      item={{ key: 'book', title: '书名' }}
      href='/books/detail?id=42'
      onNavigate={onNavigate}
      overlayAction={<button onClick={onShelf}>加入书架</button>}
    />
  );
  const link = screen.getByRole('link', { name: '书名' });
  expect(link).toHaveAttribute('href', '/books/detail?id=42');
  const shelf = screen.getByRole('button', { name: '加入书架' });
  expect(link).not.toContainElement(shelf);
  fireEvent.click(shelf);
  expect(onShelf).toHaveBeenCalledTimes(1);
  expect(onNavigate).not.toHaveBeenCalled();
});

test('zero progress remains visible, zero unread and absent metadata remain absent', () => {
  render(
    <MediaCard item={{ key: 'book', title: '书名', progress: 0, count: 0 }} />
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.queryByText('+0')).not.toBeInTheDocument();
  expect(screen.queryByText('推荐')).not.toBeInTheDocument();
});
