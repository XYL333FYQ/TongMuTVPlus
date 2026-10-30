// 客户端（安卓手机壳、Windows 壳）的更新判断。纯函数，方便测试。
// 客户端用「构建时间」判断新旧：流水线出包时盖一个 yyyyMMddHHmm（UTC），
// 写进安装包，也写进发布页的版本清单。清单里的构建时间比自己新，就提示更新。
// 你在后台写的版本号和更新内容只用来显示，不参与判断。

export type UpdatePlatform = 'android' | 'windows';

export interface ClientInfo {
  platform: UpdatePlatform;
  /** 本机构建时间；旧版客户端没有这个信息，为 null，按"落后"处理 */
  build: string | null;
}

const BUILD = /^\d{12}$/;
export const SNOOZE_KEY = 'tongmu:client-update-snooze';
// 点"稍后"后，同一个新版本 3 天内不再弹
export const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

interface DesktopWindow {
  __tmDesktopInit?: boolean;
  TMDesktop?: { build?: string };
}

/** 不在客户端壳里（普通浏览器、电视壳）返回 null，什么都不提示。 */
export function detectClient(
  userAgent: string,
  win: DesktopWindow
): ClientInfo | null {
  if (userAgent.includes('TongMuTVPlusAndroid')) {
    const match = /TMBuild\/(\d{12})/.exec(userAgent);
    return { platform: 'android', build: match ? match[1] : null };
  }
  if (win.__tmDesktopInit) {
    const build = win.TMDesktop?.build;
    return {
      platform: 'windows',
      build: build && BUILD.test(build) ? build : null,
    };
  }
  return null;
}

export function isValidBuild(value: unknown): value is string {
  return typeof value === 'string' && BUILD.test(value);
}

/** 本机比最新的旧吗？本机时间未知（旧版客户端）一律算旧。 */
export function isOutdated(client: string | null, latest: string): boolean {
  if (!isValidBuild(latest)) return false;
  if (!client) return true;
  return latest > client;
}

interface Snooze {
  build: string;
  until: number;
}

export function readSnooze(storage: Pick<Storage, 'getItem'>): Snooze | null {
  try {
    const parsed = JSON.parse(storage.getItem(SNOOZE_KEY) || 'null');
    if (isValidBuild(parsed?.build) && Number.isFinite(parsed?.until))
      return parsed;
  } catch {
    // 存储不可用或内容损坏：当作没有稍后记录
  }
  return null;
}

export function isSnoozed(
  storage: Pick<Storage, 'getItem'>,
  latest: string,
  now: number
): boolean {
  const snooze = readSnooze(storage);
  return !!snooze && snooze.build === latest && snooze.until > now;
}

export function snooze(
  storage: Pick<Storage, 'setItem'>,
  latest: string,
  now: number
) {
  try {
    storage.setItem(
      SNOOZE_KEY,
      JSON.stringify({ build: latest, until: now + SNOOZE_MS })
    );
  } catch {
    // 存不了就只在本次打开期间不再弹
  }
}

/** 202610301530 -> 2026-10-30 15:30（UTC 时间转成本地时区显示） */
export function formatBuild(build: string): string {
  const date = new Date(
    Date.UTC(
      +build.slice(0, 4),
      +build.slice(4, 6) - 1,
      +build.slice(6, 8),
      +build.slice(8, 10),
      +build.slice(10, 12)
    )
  );
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
