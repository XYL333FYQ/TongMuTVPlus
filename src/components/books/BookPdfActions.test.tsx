import { render, screen } from '@testing-library/react';

import BookPdfActions from './BookPdfActions';

afterEach(() => {
  delete document.documentElement.dataset.tmPlatform;
});

it('desktop offers a native save/reader action without a blocked new window or duplicate download', () => {
  document.documentElement.dataset.tmPlatform = 'desktop';
  render(<BookPdfActions url='blob:http://localhost/pdf' title='书名' />);
  const action = screen.getByRole('link', { name: '保存后阅读' });
  expect(action).toHaveAttribute('href', 'blob:http://localhost/pdf');
  expect(action).toHaveAttribute('download', '书名.pdf');
  expect(action).not.toHaveAttribute('target');
  expect(screen.getAllByRole('link')).toHaveLength(1);
});

it.each(['web', 'app'])('keeps both existing %s PDF actions', (platform) => {
  document.documentElement.dataset.tmPlatform = platform;
  render(<BookPdfActions url='blob:http://localhost/pdf' title='书名' />);
  expect(screen.getByRole('link', { name: '新窗口打开' })).toHaveAttribute(
    'target',
    '_blank'
  );
  expect(screen.getByRole('link', { name: '下载 PDF' })).toHaveAttribute(
    'download',
    '书名.pdf'
  );
  expect(screen.getAllByRole('link')).toHaveLength(2);
});
