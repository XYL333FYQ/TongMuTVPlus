import type { D1Database } from '@/lib/d1-adapter';

/**
 * Cloudflare 部署时 wrangler 绑定的资源（见 wrangler 配置里的 d1_databases，绑定名 DB）。
 * @opennextjs/cloudflare 的 getCloudflareContext().env 是这个类型，没有绑定时是 undefined。
 */
declare global {
  interface CloudflareEnv {
    DB?: D1Database;
  }
}

export {};
