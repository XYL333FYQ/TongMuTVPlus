import { copyExternalLink, getExternalLinkModeFor } from './external-links';

afterEach(() => {
  delete window.TMShell;
  document.documentElement.removeAttribute('data-tm-platform');
});

test('native HTTP capability does not pretend custom protocols are supported', () => {
  document.documentElement.setAttribute('data-tm-platform', 'app');
  window.TMShell = { supportsExternalLinks: () => true };
  expect(getExternalLinkModeFor('/play?id=one')).toBe('external');
  expect(getExternalLinkModeFor('magnet:?xt=urn:btih:test')).toBe('copy');
  expect(getExternalLinkModeFor('vlc://https://video.test/clip')).toBe('copy');
});

test('ordinary browsers retain their existing protocol handling', () => {
  document.documentElement.setAttribute('data-tm-platform', 'web');
  expect(getExternalLinkModeFor('magnet:?xt=urn:btih:test')).toBe('tab');
});

test('capability snapshots do not repeatedly cross the native Java bridge for each card', () => {
  document.documentElement.setAttribute('data-tm-platform', 'app');
  const supports = jest.fn(() => true);
  window.TMShell = { supportsExternalLinks: supports };
  getExternalLinkModeFor('/one');
  getExternalLinkModeFor('/two');
  getExternalLinkModeFor('magnet:?xt=urn:btih:test');
  expect(supports).toHaveBeenCalledTimes(1);
  const nextHost = jest.fn(() => false);
  window.TMShell = { supportsExternalLinks: nextHost };
  expect(getExternalLinkModeFor('/one')).toBe('copy');
  expect(nextHost).toHaveBeenCalledTimes(1);
});

test('a malformed remote link can still be copied without an unhandled rejection', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  await expect(copyExternalLink('http://[')).resolves.toBe(true);
  expect(writeText).toHaveBeenCalledWith('http://[');
});
