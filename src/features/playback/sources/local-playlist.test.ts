import { localPlaylistFromDirectory } from './local-playlist';

function fakeDirectory(files: Record<string, string>) {
  return {
    getFileHandle: async (name: string) => {
      if (!(name in files)) throw new Error(`missing ${name}`);
      return {
        getFile: async () => ({
          name,
          text: async () => files[name],
        }),
      };
    },
  } as unknown as FileSystemDirectoryHandle;
}

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

describe('localPlaylistFromDirectory', () => {
  let created: unknown[];
  let originalCreate: typeof URL.createObjectURL;
  beforeEach(() => {
    created = [];
    originalCreate = URL.createObjectURL;
    URL.createObjectURL = ((value: unknown) => {
      created.push(value);
      return `blob:${created.length}`;
    }) as typeof URL.createObjectURL;
  });
  afterEach(() => {
    URL.createObjectURL = originalCreate;
  });

  test('segments and the key become blob URLs and the playlist itself is a blob', async () => {
    const dir = fakeDirectory({
      'playlist.m3u8':
        '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.key"\n#EXTINF:4,\nseg0.ts\n#EXTINF:4,\nseg1.ts\n#EXT-X-ENDLIST',
      'key.key': 'k',
      'seg0.ts': 'a',
      'seg1.ts': 'b',
    });
    const result = await localPlaylistFromDirectory(dir);
    expect(result.blobUrls).toEqual(['blob:1', 'blob:2', 'blob:3']);
    expect(result.url).toBe('blob:4');
    const playlist = created[3] as Blob;
    expect(await readBlob(playlist)).toBe(
      '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="blob:1"\n#EXTINF:4,\nblob:2\n#EXTINF:4,\nblob:3\n#EXT-X-ENDLIST'
    );
  });

  test('a segment that cannot be read keeps its original line', async () => {
    const dir = fakeDirectory({
      'playlist.m3u8': '#EXTM3U\nseg0.ts\nmissing.ts',
      'seg0.ts': 'a',
    });
    const result = await localPlaylistFromDirectory(dir);
    expect(result.blobUrls).toEqual(['blob:1']);
    expect(await readBlob(created[1] as Blob)).toBe(
      '#EXTM3U\nblob:1\nmissing.ts'
    );
  });
});
