import {
  defaultReleaseInfo,
  parseReleaseInfo,
  resolveReleaseInfo,
} from './release-info';

const release = {
  version: '0.2.0',
  entries: [
    {
      version: '0.2.0',
      date: '2026-10-25',
      added: [' 新功能 '],
      changed: [],
      fixed: [],
    },
  ],
};

test('public release projection trims text and drops private fields', () => {
  expect(parseReleaseInfo({ ...release, secret: 'private' })).toEqual({
    ...release,
    entries: [{ ...release.entries[0], added: ['新功能'] }],
  });
});

test.each([
  { ...release, version: 'not-a-version' },
  { ...release, version: '0.3.0' },
  { ...release, entries: [...release.entries, ...release.entries] },
  { ...release, entries: [{ ...release.entries[0], date: '2026-02-30' }] },
  { ...release, entries: [{ ...release.entries[0], added: ['  '] }] },
  {
    ...release,
    entries: [{ ...release.entries[0], added: ['x'.repeat(501)] }],
  },
  { ...release, entries: [] },
  null,
])('rejects malformed release data without changing defaults: %p', (value) => {
  expect(() => parseReleaseInfo(value)).toThrow();
  expect(resolveReleaseInfo(value)).toBe(defaultReleaseInfo);
});

test('legacy installs use bundled release data and valid overrides survive updates', () => {
  expect(resolveReleaseInfo(undefined).version).toBe('0.1.1');
  expect(resolveReleaseInfo(release).version).toBe('0.2.0');
});
