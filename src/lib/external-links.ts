import { getPlatform } from '@/lib/platform';

export type ExternalLinkMode = 'tab' | 'external' | 'copy';

declare global {
  interface Window {
    TMDesktop?: { build?: string; externalLinks?: boolean };
  }
}

/** A platform label alone does not prove its installed host can open windows. */
export function getExternalLinkMode(): ExternalLinkMode {
  if (typeof window === 'undefined') return 'tab';
  const platform = getPlatform();
  if (platform === 'desktop')
    return window.TMDesktop?.externalLinks === true ? 'external' : 'copy';
  if (
    platform === 'app' &&
    (window.TMShell || /TongMuTVPlusAndroid/.test(navigator.userAgent))
  ) {
    try {
      return window.TMShell?.supportsExternalLinks?.() === true
        ? 'external'
        : 'copy';
    } catch {
      return 'copy';
    }
  }
  return 'tab';
}

export const externalLinkDescription = (mode: ExternalLinkMode) =>
  mode === 'copy'
    ? '复制链接'
    : mode === 'external'
    ? '在外部打开'
    : '在新标签页打开';

export async function copyExternalLink(href: string): Promise<boolean> {
  const value = new URL(href, window.location.href).href;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Old WebViews and HTTP self-hosted servers may lack async clipboard access.
    const previous = document.activeElement;
    const field = document.createElement('textarea');
    field.value = value;
    field.readOnly = true;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    const host =
      document.activeElement?.closest('dialog[open]') || document.body;
    host.appendChild(field);
    try {
      field.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    }
  }
}
