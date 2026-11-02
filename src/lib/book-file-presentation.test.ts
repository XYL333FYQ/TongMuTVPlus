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
});

it('hands desktop reading to the engine download path with the actual Blob and filename', () => {
  document.documentElement.dataset.tmPlatform = 'desktop';
  const blob = new Blob(['%PDF-1.7\nbook'], { type: 'application/pdf' });
  presentBookFile(blob, '书名.pdf', false);
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
  (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    presentBookFile(new Blob(['book']), 'book.pdf', false);
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
  (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    presentBookFile(new Blob(['book']), 'book.epub', true);
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
