import { timingSafeEqual } from 'crypto';

// 定时任务接口 /api/cron/<密码> 的鉴权。
// 两种调用方式：
// - 自建服务器 / 外部定时器：密码写在路径里，等于 CRON_PASSWORD。
// - Vercel Cron：vercel.json 里的路径是固定文本，放不了密钥；Vercel 按约定在请求头里带
//   Authorization: Bearer <CRON_SECRET>（CRON_SECRET 在 Vercel 项目里设置）。
// 两个都没设置时接口关闭，否则任何人都能反复触发全站维护任务。

export type CronAuth = 'ok' | 'disabled' | 'unauthorized';

function sameSecret(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkCronAuth(
  pathSecret: string,
  authorization: string | null,
  env: Record<string, string | undefined> = process.env
): CronAuth {
  const password = env.CRON_PASSWORD?.trim();
  const secret = env.CRON_SECRET?.trim();
  if (!password && !secret) return 'disabled';
  if (password && sameSecret(pathSecret || '', password)) return 'ok';
  if (secret && sameSecret(authorization || '', `Bearer ${secret}`)) {
    return 'ok';
  }
  return 'unauthorized';
}
