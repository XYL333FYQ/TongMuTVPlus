import { getPlatform } from '@/lib/platform';

export type ExternalLinkMode = 'tab' | 'external' | 'copy';
// Host capabilities are immutable for a document. Do not make synchronous Java
// bridge calls for every card/useSyncExternalStore snapshot on every render.
const shellModes = new WeakMap<object, ExternalLinkMode>();

declare global {
  interface Window {
    TMDesktop?: { build?: string; externalLinks?: boolean };
  }
}

/** A platform label alone does not prove its installed host can open windows. */
export function getExternalLinkMode(): ExternalLinkMode {
  if (typeof window === 'undefined') return 'tab';
  const platform = getPlatform();
  const shell = window.TMShell;
  if (platform === 'desktop')
    return window.TMDesktop?.externalLinks === true ? 'external' : 'copy';
  if (
    platform === 'app' &&
    (shell || /TongMuTVPlusAndroid/.test(navigator.userAgent))
  ) {
    try {
      if (!shell) return 'copy';
      const cached = shellModes.get(shell);
      if (cached) return cached;
      const mode =
        shell.supportsExternalLinks?.() === true ? 'external' : 'copy';
      shellModes.set(shell, mode);
      return mode;
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

export function getExternalLinkModeFor(
  href: string,
  mode = getExternalLinkMode()
): ExternalLinkMode {
  if (mode !== 'external') return mode;
  try {
    const protocol = new URL(href, window.location.href).protocol;
    return protocol === 'http:' || protocol === 'https:' ? 'external' : 'copy';
  } catch {
    return 'copy';
  }
}

/** Preserve malformed source text so manual/clipboard fallback itself cannot fail. */
export function externalLinkText(href: string): string {
  try {
    return new URL(href, window.location.href).href;
  } catch {
    return href;
  }
}

export async function copyExternalLink(href: string): Promise<boolean> {
  const value = externalLinkText(href);
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
