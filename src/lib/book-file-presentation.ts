import { getPlatform } from '@/lib/platform';

/** Present an authenticated response without another request or credential handoff. */
export function presentBookFile(
  blob: Blob,
  filename: string,
  download: boolean
) {
  const url = URL.createObjectURL(blob);
  try {
    // Desktop blocks Blob new windows. Its engine download path already owns
    // native Save As, progress, cancellation and explicit reader actions.
    if (download || getPlatform() === 'desktop') {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
