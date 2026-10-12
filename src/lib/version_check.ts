'use client';

import { CURRENT_VERSION } from '@/lib/version';

export enum UpdateStatus {
  HAS_UPDATE = 'has_update',
  NO_UPDATE = 'no_update',
  FETCH_FAILED = 'fetch_failed',
  NOT_CONFIGURED = 'not_configured',
}

/** No project release endpoint exists yet. Never compare this fork to upstream releases. */
export async function checkForUpdates(): Promise<UpdateStatus> {
  return UpdateStatus.NOT_CONFIGURED;
}

/** The version panel passes the upstream baseline explicitly for its separate reference view. */
export function compareVersions(
  remoteVersion: string,
  currentVersion: string = CURRENT_VERSION
): UpdateStatus {
  const parse = (version: string): number[] | null => {
    if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
    return version.split('.').map(Number);
  };
  const remote = parse(remoteVersion);
  const current = parse(currentVersion);
  if (!remote || !current) return UpdateStatus.FETCH_FAILED;
  for (let i = 0; i < 3; i++) {
    if (remote[i] > current[i]) return UpdateStatus.HAS_UPDATE;
    if (remote[i] < current[i]) return UpdateStatus.NO_UPDATE;
  }
  return UpdateStatus.NO_UPDATE;
}
