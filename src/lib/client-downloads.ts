import { PROJECT_REPOSITORY_URL } from '@/lib/brand';

// 原生客户端安装包。文件名固定，由 GitHub Actions 发布到 Releases 的 clients 版本，
// 站长也可以把同名文件放到自己的服务器，用 CLIENT_DOWNLOAD_BASE_URL 指过去
// （国内访问 GitHub 慢时有用）。

export type ClientPlatform = 'windows' | 'android' | 'tv';

export interface ClientPackage {
  platform: ClientPlatform;
  label: string;
  hint: string;
  file: string;
}

export const CLIENT_PACKAGES: ClientPackage[] = [
  {
    platform: 'windows',
    label: 'Windows 安装包（x64）',
    hint: '适合绝大多数电脑，需要 Windows 10 / 11',
    file: 'TongMuTV-Plus-Windows-x64-Setup.exe',
  },
  {
    platform: 'windows',
    label: 'Windows 便携版（x64）',
    hint: '解压即用，不写入系统',
    file: 'TongMuTV-Plus-Windows-x64-Portable.zip',
  },
  {
    platform: 'windows',
    label: 'Windows 安装包（ARM64）',
    hint: '骁龙等 ARM 架构电脑',
    file: 'TongMuTV-Plus-Windows-arm64-Setup.exe',
  },
  {
    platform: 'windows',
    label: 'Windows 便携版（ARM64）',
    hint: '解压即用，ARM 架构',
    file: 'TongMuTV-Plus-Windows-arm64-Portable.zip',
  },
  {
    platform: 'android',
    label: '安卓手机 / 平板',
    hint: '安装包 .apk，需要允许安装未知来源应用',
    file: 'TongMuTV-Plus-Android.apk',
  },
  {
    platform: 'tv',
    label: '安卓电视（Android 6 及以上）',
    hint: '用遥控器操作，首次打开填写本站地址',
    file: 'TongMuTV-Plus-TV-webview-android6plus.apk',
  },
  {
    platform: 'tv',
    label: '安卓电视（Android 5）',
    hint: '老电视或机顶盒使用',
    file: 'TongMuTV-Plus-TV-webview-android5plus.apk',
  },
];

export function clientDownloadBase(configured?: unknown): string {
  const custom = typeof configured === 'string' ? configured.trim() : '';
  const base = custom || `${PROJECT_REPOSITORY_URL}/releases/download/clients`;
  return base.replace(/\/+$/, '');
}

export function clientDownloadUrl(file: string, configured?: unknown): string {
  return `${clientDownloadBase(configured)}/${encodeURIComponent(file)}`;
}

// 按浏览器的系统猜一个推荐平台；电脑上的 macOS / Linux 没有原生包，返回 null
export function detectClientPlatform(userAgent: string): ClientPlatform | null {
  if (/Android/i.test(userAgent)) {
    return /TV|AFT|BRAVIA|SMART-TV|Tizen|Box/i.test(userAgent)
      ? 'tv'
      : 'android';
  }
  if (/Windows/i.test(userAgent)) return 'windows';
  return null;
}
