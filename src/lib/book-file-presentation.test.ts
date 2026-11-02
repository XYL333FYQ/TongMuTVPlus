import { presentBookFile } from './book-file-presentation';

let clicked: Array<{ href: string; download: string; connected: boolean }>;

beforeEach(() => {
  jest.useFakeTimers();
  clicked = [];
  URL.createObjectURL = jest.fn(() => 'blob:http://localhost/book-file');
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(window, 'open').mockImplementation(() => null);
  jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({
        href: this.href,
        download: this.download,
        connected: this.isConnected,
      });
    });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete document.documentElement.dataset.tmPlatform;
  delete window.__tmContentExport;
});

it('new Android hands the actual response Blob to native and keeps cancellation quiet', async () => {
  document.documentElement.dataset.tmPlatform = 'app';
  const blob = new Blob(['private'], { type: 'application/pdf' });
  const saveBlob = jest.fn(async () => 'cancelled' as const);
  window.__tmContentExport = { version: 1, saveBlob };
  await presentBookFile(blob, '书名.pdf', true);
  expect(saveBlob).toHaveBeenCalledWith(blob, '书名.pdf');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(window.open).not.toHaveBeenCalled();
  expect(clicked).toEqual([]);
});

it('hands desktop reading to the engine download path with the actual Blob and filename', async () => {
  document.documentElement.dataset.tmPlatform = 'desktop';
  const blob = new Blob(['%PDF-1.7\nbook'], { type: 'application/pdf' });
  await presentBookFile(blob, '书名.pdf', false);
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(clicked).toEqual([
    {
      href: 'blob:http://localhost/book-file',
      download: '书名.pdf',
      connected: true,
    },
  ]);
  expect(window.open).not.toHaveBeenCalled();
  expect(document.querySelector('a[download]')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  jest.advanceTimersByTime(60_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(
    'blob:http://localhost/book-file'
  );
});

it.each(['web', 'app'])(
  'preserves existing %s reading behavior',
  async (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    await presentBookFile(new Blob(['book']), 'book.pdf', false);
    expect(window.open).toHaveBeenCalledWith(
      'blob:http://localhost/book-file',
      '_blank',
      'noopener,noreferrer'
    );
    expect(clicked).toEqual([]);
  }
);

it.each(['web', 'app', 'desktop'])(
  'preserves explicit download on %s',
  async (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    await presentBookFile(new Blob(['book']), 'book.epub', true);
    expect(clicked).toEqual([
      {
        href: 'blob:http://localhost/book-file',
        download: 'book.epub',
        connected: true,
      },
    ]);
    expect(window.open).not.toHaveBeenCalled();
  }
);
