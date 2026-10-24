'use client';

import { CURRENT_VERSION } from '@/lib/version';

export enum UpdateStatus {
  HAS_UPDATE = 'has_update',
  NO_UPDATE = 'no_update',
  FETCH_FAILED = 'fetch_failed',
  NOT_CONFIGURED = 'not_configured',
}

/** 尚未配置 TongMuTV Plus 发行地址，不请求外部项目，也不宣称当前为最新版本。 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  return UpdateStatus.NOT_CONFIGURED;
}

/** 比较本项目的语义化版本。 */
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
