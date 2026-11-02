import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { notify } from '@/components/feedback/AppDialogs';

import BookPdfActions from './BookPdfActions';
jest.mock('@/components/feedback/AppDialogs', () => ({ notify: jest.fn() }));

afterEach(() => {
  delete document.documentElement.dataset.tmPlatform;
  delete window.__tmContentExport;
  jest.clearAllMocks();
});

it('new Android exports the original reader Blob, prevents browser fallback and keeps cancel quiet', async () => {
  document.documentElement.dataset.tmPlatform = 'app';
  const blob = new Blob(['pdf'], { type: 'application/pdf' });
  const saveBlob = jest.fn(async () => 'cancelled' as const);
  window.__tmContentExport = { version: 1, saveBlob };
  render(
    <BookPdfActions url='blob:http://localhost/pdf' title='书名' blob={blob} />
  );
  const link = screen.getByRole('link', { name: '保存后阅读' });
  const event = createEvent.click(link);
  fireEvent(link, event);
  await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, '书名.pdf'));
  expect(event.defaultPrevented).toBe(true);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(notify).not.toHaveBeenCalled();
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

it('responds when Android publishes the capability after hydration', () => {
  document.documentElement.dataset.tmPlatform = 'app';
  render(
    <BookPdfActions
      url='blob:http://localhost/pdf'
      title='书名'
      blob={new Blob(['pdf'])}
    />
  );
  expect(screen.getByRole('link', { name: '新窗口打开' })).toBeInTheDocument();
  window.__tmContentExport = { version: 1, saveBlob: async () => 'queued' };
  fireEvent(window, new Event('tm-content-export-ready'));
  expect(screen.getByRole('link', { name: '保存后阅读' })).toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(1);
});

it('reports one localized native failure without a browser fallback', async () => {
  document.documentElement.dataset.tmPlatform = 'app';
  window.__tmContentExport = {
    version: 1,
    saveBlob: async () => {
      throw new Error('host detail');
    },
  };
  render(
    <BookPdfActions
      url='blob:http://localhost/pdf'
      title='书名'
      blob={new Blob(['pdf'])}
    />
  );
  const link = screen.getByRole('link', { name: '保存后阅读' });
  const event = createEvent.click(link);
  fireEvent(link, event);
  await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  expect(notify).toHaveBeenCalledWith(
    '暂时无法保存文件，请保持此页面后重试。',
    'error'
  );
  expect(event.defaultPrevented).toBe(true);
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
