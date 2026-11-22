/*
 * 自己看：这一集有没有用 File System API 下载到本机。
 */

import type { Art } from '@/features/player';

export async function checkFileSystemDownload(
  title: string,
  source?: string,
  videoId?: string,
  episodeIndex?: number
): Promise<{ hasLocal: boolean; dirHandle?: FileSystemDirectoryHandle }> {
  try {
    // 从 IndexedDB 读取目录句柄
    const dbName = 'MoonTVPlus';
    const storeName = 'dirHandles';

    return new Promise((resolve) => {
      const request = indexedDB.open(dbName, 2); // 使用版本 2

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建 dirHandles 表（如果不存在）
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }

        // 创建 activeTasks 表（如果不存在）
        if (!db.objectStoreNames.contains('activeTasks')) {
          const activeStore = db.createObjectStore('activeTasks', {
            keyPath: 'id',
          });
          activeStore.createIndex('status', 'status', { unique: false });
          activeStore.createIndex('createdAt', 'createdAt', {
            unique: false,
          });
        }

        // 创建 completedTasks 表（如果不存在）
        if (!db.objectStoreNames.contains('completedTasks')) {
          const completedStore = db.createObjectStore('completedTasks', {
            keyPath: 'id',
          });
          completedStore.createIndex('source', 'source', { unique: false });
          completedStore.createIndex('videoId', 'videoId', { unique: false });
          completedStore.createIndex('completedAt', 'completedAt', {
            unique: false,
          });
          completedStore.createIndex('sourceVideoId', ['source', 'videoId'], {
            unique: false,
          });
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 检查 object store 是否存在
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          resolve({ hasLocal: false });
          return;
        }

        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const getRequest = store.get('downloadDir');

        getRequest.onsuccess = async () => {
          const dirHandle = getRequest.result as
            | FileSystemDirectoryHandle
            | undefined;
          if (!dirHandle) {
            resolve({ hasLocal: false });
            return;
          }

          try {
            // 请求读权限
            const permission = await dirHandle.queryPermission({
              mode: 'read',
            });
            if (permission !== 'granted') {
              const requestPermission = await dirHandle.requestPermission({
                mode: 'read',
              });
              if (requestPermission !== 'granted') {
                console.warn('未获得读权限');
                resolve({ hasLocal: false });
                return;
              }
            }

            // 如果有 source、videoId 和 episodeIndex，检查子目录
            if (source && videoId && episodeIndex !== undefined) {
              const sourceDirHandle = await dirHandle.getDirectoryHandle(
                source,
                { create: false }
              );
              const videoIdDirHandle = await sourceDirHandle.getDirectoryHandle(
                videoId,
                {
                  create: false,
                }
              );
              const epDirHandle = await videoIdDirHandle.getDirectoryHandle(
                `ep${episodeIndex + 1}`,
                { create: false }
              );

              // 检查是否存在 playlist.m3u8 文件
              await epDirHandle.getFileHandle('playlist.m3u8', {
                create: false,
              });
              console.log(
                '找到本地下载文件:',
                title,
                `(${source}/${videoId}/ep${episodeIndex + 1})`
              );
              resolve({ hasLocal: true, dirHandle: epDirHandle });
            } else {
              // 缺少必要参数
              resolve({ hasLocal: false });
            }
          } catch (error) {
            // 文件不存在
            console.error('检查本地文件失败:', error);
            resolve({ hasLocal: false });
          }
        };

        getRequest.onerror = () => {
          resolve({ hasLocal: false });
        };
      };

      request.onerror = () => {
        resolve({ hasLocal: false });
      };
    });
  } catch (error) {
    console.error('检查 File System API 下载失败:', error);
    return { hasLocal: false };
  }
}
