import {
  CLIENT_PACKAGES,
  clientDownloadUrl,
  detectClientPlatform,
} from './client-downloads';

test('default links point at the clients release of this repository', () => {
  expect(clientDownloadUrl('TongMuTV-Plus-Android.apk')).toBe(
    'https://github.com/XYL333FYQ/TongMuTVPlus/releases/download/clients/TongMuTV-Plus-Android.apk'
  );
});

test('a configured mirror replaces the base and tolerates trailing slashes', () => {
  expect(
    clientDownloadUrl(
      'TongMuTV-Plus-Android.apk',
      'https://tv.example.com/dl//'
    )
  ).toBe('https://tv.example.com/dl/TongMuTV-Plus-Android.apk');
  expect(clientDownloadUrl('a.apk', '   ')).toContain('/releases/download/');
});

test('every package has a unique file name and a platform group', () => {
  const files = CLIENT_PACKAGES.map((item) => item.file);
  expect(new Set(files).size).toBe(files.length);
  expect(new Set(CLIENT_PACKAGES.map((item) => item.platform))).toEqual(
    new Set(['windows', 'android', 'tv'])
  );
});

test('detects the visitor platform from the user agent', () => {
  expect(
    detectClientPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130')
  ).toBe('windows');
  expect(
    detectClientPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130')
  ).toBe('android');
  expect(
    detectClientPlatform('Mozilla/5.0 (Linux; Android 11; BRAVIA 4K) Chrome/90')
  ).toBe('tv');
  expect(detectClientPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe(
    null
  );
});
