/*
 * 自己看：本机下载（File System API）的一集 → 能播的地址。
 * 读目录里的 playlist.m3u8，把每个 .ts 分片和加密密钥换成 Blob URL，再把改好的清单也做成 Blob URL。
 * 读不到的分片 / 密钥保留原行（播放时再报错），返回的 blobUrls 由调用方在换片时统一释放。
 */

import { logger } from '@/lib/logger';

export interface LocalPlaylist {
  /** 改写后的 m3u8 的 Blob URL */
  url: string;
  /** 分片、密钥、清单本身以外的 Blob URL（换片时要释放） */
  blobUrls: string[];
}

export async function localPlaylistFromDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<LocalPlaylist> {
  const fileHandle = await dirHandle.getFileHandle('playlist.m3u8', {
    create: false,
  });
  const content = await (await fileHandle.getFile()).text();

  const modifiedLines: string[] = [];
  const blobUrls: string[] = [];
  for (const line of content.split('\n')) {
    const trimmedLine = line.trim();
    if (trimmedLine.endsWith('.ts')) {
      try {
        const tsFile = await (
          await dirHandle.getFileHandle(trimmedLine, { create: false })
        ).getFile();
        const blobUrl = URL.createObjectURL(tsFile);
        blobUrls.push(blobUrl);
        modifiedLines.push(line.replace(trimmedLine, blobUrl));
      } catch (error) {
        logger.error(`读取 ts 文件失败: ${trimmedLine}`, error);
        modifiedLines.push(line);
      }
    } else if (trimmedLine.includes('key.key')) {
      try {
        const keyFile = await (
          await dirHandle.getFileHandle('key.key', { create: false })
        ).getFile();
        const keyBlobUrl = URL.createObjectURL(keyFile);
        blobUrls.push(keyBlobUrl);
        modifiedLines.push(line.replace('key.key', keyBlobUrl));
      } catch (error) {
        logger.error('读取密钥文件失败:', error);
        modifiedLines.push(line);
      }
    } else {
      modifiedLines.push(line);
    }
  }

  const m3u8Blob = new Blob([modifiedLines.join('\n')], {
    type: 'application/vnd.apple.mpegurl',
  });
  return { url: URL.createObjectURL(m3u8Blob), blobUrls };
}
