import { PROJECT_VERSION, UPSTREAM_BASE_VERSION } from './brand';
import {
  checkForUpdates,
  compareVersions,
  UpdateStatus,
} from './version_check';

describe('independent project version and upstream reference', () => {
  it('does not poll upstream or claim the project is latest when no project endpoint is configured', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    try {
      expect(await checkForUpdates()).toBe(UpdateStatus.NOT_CONFIGURED);
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('compares upstream only against an explicitly supplied upstream baseline', () => {
    expect(PROJECT_VERSION).not.toBe(UPSTREAM_BASE_VERSION);
    expect(compareVersions(UPSTREAM_BASE_VERSION, UPSTREAM_BASE_VERSION)).toBe(
      UpdateStatus.NO_UPDATE
    );
    expect(compareVersions('227.0.0', UPSTREAM_BASE_VERSION)).toBe(
      UpdateStatus.HAS_UPDATE
    );
    expect(compareVersions(PROJECT_VERSION)).toBe(UpdateStatus.NO_UPDATE);
    expect(compareVersions('not-a-version')).toBe(UpdateStatus.FETCH_FAILED);
  });
});
