import { PROJECT_VERSION } from './brand';
import {
  checkForUpdates,
  compareVersions,
  UpdateStatus,
} from './version_check';

describe('TongMuTV Plus version information', () => {
  it('does not poll or claim the project is latest when no project endpoint is configured', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    try {
      expect(await checkForUpdates()).toBe(UpdateStatus.NOT_CONFIGURED);
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('compares project releases against the current or an explicit project version', () => {
    expect(compareVersions(PROJECT_VERSION, PROJECT_VERSION)).toBe(
      UpdateStatus.NO_UPDATE
    );
    expect(compareVersions('0.2.0', '0.1.0')).toBe(UpdateStatus.HAS_UPDATE);
    expect(compareVersions(PROJECT_VERSION)).toBe(UpdateStatus.NO_UPDATE);
    expect(compareVersions('not-a-version')).toBe(UpdateStatus.FETCH_FAILED);
  });
});
