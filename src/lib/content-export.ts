import { getPlatform } from '@/lib/platform';

export interface ContentExporter {
  version: 1;
  saveBlob: (blob: Blob, name: string) => Promise<'queued' | 'cancelled'>;
}

declare global {
  interface Window {
    __tmContentExport?: ContentExporter;
  }
}

export function nativeContentExportAvailable() {
  return (
    typeof window !== 'undefined' &&
    getPlatform() === 'app' &&
    window.__tmContentExport?.version === 1 &&
    typeof window.__tmContentExport.saveBlob === 'function'
  );
}

export async function saveNativeContent(
  blob: Blob,
  name: string
): Promise<boolean> {
  if (!nativeContentExportAvailable()) return false;
  const exporter = window.__tmContentExport;
  if (!exporter) return false;
  try {
    const result = await exporter.saveBlob(blob, name);
    if (result === 'queued' || result === 'cancelled') return true;
  } catch {
    /* The page owns one localized error; user cancellation is a normal result. */
  }
  throw new Error('暂时无法保存文件，请保持此页面后重试。');
}
