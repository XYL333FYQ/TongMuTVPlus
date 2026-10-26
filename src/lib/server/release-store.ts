import { createHash } from 'node:crypto';

import { db } from '@/lib/db';
import { type ReleaseInfo, resolveReleaseInfo } from '@/lib/release-info';

// 与管理配置分开保存，其他配置页面的旧副本不会覆盖发布信息。
const key = 'tongmu:release-info:v1';
let writes: Promise<unknown> = Promise.resolve();

export async function getReleaseSnapshot() {
  const raw = await db.getGlobalValue(key);
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : undefined;
  } catch {
    value = undefined;
  }
  return {
    info: resolveReleaseInfo(value),
    etag: `"${createHash('sha256')
      .update(raw ?? '<missing>')
      .digest('hex')}"`,
  };
}

export function publishRelease(info: ReleaseInfo, expected: string) {
  // 当前 Node 服务内串行处理完整的读取/比对/写入，阻止两个编辑器覆盖历史。
  const result = writes.then(async () => {
    const current = await getReleaseSnapshot();
    if (current.etag !== expected) return null;
    const raw = JSON.stringify(info);
    await db.setGlobalValue(key, raw);
    return {
      info,
      etag: `"${createHash('sha256').update(raw).digest('hex')}"`,
    };
  });
  writes = result.catch(() => undefined);
  return result;
}
