import { decodeQueryText, getSafeRedirect } from './safe-redirect';

const origin = window.location.origin;

test('same-origin paths are kept with query and hash', () => {
  expect(getSafeRedirect('/watch-room?id=1#chat')).toBe(
    `${origin}/watch-room?id=1#chat`
  );
});

test.each([
  'https://evil.example/login',
  '//evil.example/path',
  '/\\evil.example',
  'javascript:alert(1)',
])('off-site or script destination %s falls back', (value) => {
  expect(getSafeRedirect(value, '/login')).toBe('/login');
});

test('empty destinations use the fallback', () => {
  expect(getSafeRedirect(null)).toBe('/');
  expect(getSafeRedirect('', '/login')).toBe('/login');
});

test('query text decoding never throws on a bare percent sign', () => {
  expect(decodeQueryText('100%')).toBe('100%');
  expect(decodeQueryText('%E7%94%A8%E6%88%B7')).toBe('用户');
  expect(decodeQueryText('用户被封禁')).toBe('用户被封禁');
});
