import {
  nativeContentExportAvailable,
  saveNativeContent,
} from './content-export';

afterEach(() => {
  delete document.documentElement.dataset.tmPlatform;
  delete window.__tmContentExport;
});

it.each(['queued', 'cancelled'] as const)(
  'handles native %s without a second browser download',
  async (result) => {
    document.documentElement.dataset.tmPlatform = 'app';
    const blob = new Blob(['file']);
    const saveBlob = jest.fn(async () => result);
    window.__tmContentExport = { version: 1, saveBlob };
    expect(nativeContentExportAvailable()).toBe(true);
    await expect(saveNativeContent(blob, 'book.pdf')).resolves.toBe(true);
    expect(saveBlob).toHaveBeenCalledWith(blob, 'book.pdf');
  }
);

it.each(['web', 'desktop'])(
  'ignores an injected exporter on %s',
  async (platform) => {
    document.documentElement.dataset.tmPlatform = platform;
    const saveBlob = jest.fn(async () => 'queued' as const);
    window.__tmContentExport = { version: 1, saveBlob };
    await expect(
      saveNativeContent(new Blob(['file']), 'book.pdf')
    ).resolves.toBe(false);
    expect(saveBlob).not.toHaveBeenCalled();
  }
);

it('old Android without the incremental capability keeps its existing path', async () => {
  document.documentElement.dataset.tmPlatform = 'app';
  await expect(saveNativeContent(new Blob(['file']), 'book.pdf')).resolves.toBe(
    false
  );
});

it('translates a host failure once', async () => {
  document.documentElement.dataset.tmPlatform = 'app';
  window.__tmContentExport = {
    version: 1,
    saveBlob: async () => {
      throw new Error('native details');
    },
  };
  await expect(
    saveNativeContent(new Blob(['file']), 'book.pdf')
  ).rejects.toThrow('暂时无法保存文件，请保持此页面后重试。');
});
