import { fireEvent, render, screen } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';

import ContinueReadingCard from './ContinueReadingCard';

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

test('cover arrival enables the image fade without changing the image or read URL', () => {
  render(
    <ContinueReadingCard
      title='正在阅读'
      image='/qa-cover.svg'
      href='/books/read?id=42'
    />
  );
  const image = screen.getByRole('img', { name: '正在阅读' });
  fireEvent.load(image);
  expect(image).toHaveAttribute('data-loaded', 'true');
  expect(image).toHaveAttribute('src', '/qa-cover.svg');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/books/read?id=42');
});

test('progress retains zero and fractional values without inventing metadata', () => {
  const { rerender } = render(
    <ContinueReadingCard title='书名' href='/books/read?id=42' progress={0} />
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByText('0%')).toBeInTheDocument();
  rerender(
    <ContinueReadingCard
      title='书名'
      href='/books/read?id=42'
      progress={12.345}
    />
  );
  expect(screen.getByText('12.35%')).toBeInTheDocument();
  expect(screen.queryByText('推荐')).not.toBeInTheDocument();
});
