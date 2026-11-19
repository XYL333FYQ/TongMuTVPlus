# 部署

推荐用 **Docker** 部署到自己的 VPS（步骤见根目录 README）。这是唯一完整支持一起看的方式：房间依赖一直在线的 Socket.IO 服务和本地 SQLite，Docker 镜像里的 `server.js` 同时提供网页和房间服务。

仓库里还保留了下面几个平台的部署配置。它们平时不用，但随时能用。

## 各平台一览

| 平台                 | 用到的文件                                                                                                  | 数据库                                               | 一起看           |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------- |
| Docker（推荐）       | `Dockerfile`、`docker-compose.yml`、`docker-entrypoint.sh`、`deploy/`                                       | SQLite（`.data/moontv.db`）                          | 完整支持         |
| Docker 精简镜像      | `Dockerfile.lite`、`.github/workflows/docker-image-lite.yml`                                                | 同上                                                 | 完整支持         |
| Render               | `render.yaml`                                                                                               | 同上（需要持久磁盘）                                 | 完整支持         |
| Vercel               | `vercel.json`                                                                                               | Vercel Postgres（`postgres`）或 Upstash（`upstash`） | 需要外部房间服务 |
| Cloudflare Workers   | `wrangler.toml`、`open-next.config.ts`、`.github/workflows/cloudflare-deploy.yml`                           | Cloudflare D1（`d1`）或 Upstash                      | 需要外部房间服务 |
| 腾讯云 EdgeOne Pages | `edgeone.json`、`.env.edgeone.example`、`scripts/edgeone-build.mjs`、`.github/workflows/edgeone-deploy.yml` | Turso（`turso`）或 Upstash                           | 需要外部房间服务 |

`vercel.json`、`wrangler.toml`、`edgeone.json`、`render.yaml` 必须放在仓库根目录，这是各平台的规定，所以没有挪进 `docs/` 或 `deploy/`。

`start.js`、`server.js`、`start.sh`、`docker-entrypoint.sh`、`启动TongMuTVPlus.cmd`、`proxy.worker.js` 是各平台和本机的启动入口，不要改名。

## 无服务器平台上的一起看

Vercel、Cloudflare、EdgeOne 不能常驻 WebSocket 服务，也没有本地磁盘。在这些平台上：

- 自己看、片库、搜索、账号、管理面板等功能正常。
- 一起看需要另外连一个外部房间服务：

  ```
  WATCH_ROOM_SERVER_TYPE=external
  WATCH_ROOM_EXTERNAL_SERVER_URL=wss://你的房间服务地址
  WATCH_ROOM_EXTERNAL_SERVER_AUTH=（房间服务要求的令牌）
  ```

  这时房间目录和长期房间恢复不可用（只有内置房间服务有），页面会明确提示。外部服务必须兼容本站的房间协议，本项目**没有验证过任何外部服务**。要完整的一起看，请用 Docker 或 Render。

## Render

`render.yaml` 用 GitHub 自动构建的镜像 `ghcr.io/xyl333fyq/tongmutvplus:latest`（推送到 main 并通过检查后由 `docker-image.yml` 发布）。

- 在 Render 新建 Blueprint，选这个仓库，填 `USERNAME`、`PASSWORD`。`AUTH_SECRET`、`CRON_PASSWORD` 由 Render 自动生成。
- 配置里挂了一块 1 GB 持久磁盘到 `/app/.data`（数据库和登录密钥都在这里）。持久磁盘需要付费方案（配置里写的是 `starter`）；用免费方案就要去掉 `disk` 和 `plan`，代价是每次重启数据全部丢失，只适合试用。
- 健康检查走 `/health/ready`。

## Vercel

1. 在 Vercel 导入仓库。
2. 建数据库：Vercel Postgres（`vercel postgres create`、`vercel postgres connect`），然后 `pnpm init:postgres` 建表。也可以用 Upstash Redis。
3. 环境变量：

   | 变量                       | 说明                                                                                                                                     |
   | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_STORAGE_TYPE` | `postgres` 或 `upstash`                                                                                                                  |
   | `POSTGRES_URL`             | Vercel Postgres 自动提供；用 Upstash 时改填 `UPSTASH_URL`、`UPSTASH_TOKEN`                                                               |
   | `USERNAME` / `PASSWORD`    | 站长账号                                                                                                                                 |
   | `AUTH_SECRET`              | 登录签名密钥，填一串足够长的随机字符。平台没有磁盘，不能像 Docker 那样自动生成保存；不填会退回用站长密码签名，成员有可能离线猜出站长密码 |
   | `CRON_SECRET`              | 定时任务密钥，见下                                                                                                                       |

4. `vercel --prod` 部署。

**定时任务**：`vercel.json` 每天 1 点调用 `/api/cron/vercel`。Vercel 会在请求头里带 `Authorization: Bearer <CRON_SECRET>`，接口据此放行，所以只要在项目里设置 `CRON_SECRET`。（自建服务器上则用 `/api/cron/<CRON_PASSWORD>`。两个都没设置时接口关闭。）

Vercel Postgres 免费版有 256 MB 存储上限；首次请求有几秒冷启动。

## Cloudflare Workers

通过 OpenNext 构建（`pnpm build:cloudflare`），用 D1 或 Upstash 做数据库。

- 推荐用 GitHub Actions 手动触发 `Deploy to Cloudflare`（`cloudflare-deploy.yml`）。需要的仓库 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`NEXT_PUBLIC_STORAGE_TYPE`、`USERNAME`、`PASSWORD`；用 D1 时再加 `D1_DATABASE_ID`。工作流会把 D1 编号和其他环境变量写进 `wrangler.toml`，并对 D1 执行 `migrations/` 里的迁移。
- D1 数据库名是 `tongmutvplus`（`wrangler.toml` 的 `database_name`），先在 Cloudflare 建一个同名数据库：`wrangler d1 create tongmutvplus`。
- 本机预览：`pnpm build:cloudflare && pnpm preview:cloudflare`。

## 腾讯云 EdgeOne Pages

- 本机：`pnpm build:edgeone` 构建到 `.edgeone/`，`pnpm deploy:edgeone` 发布（先 `pnpm edgeone:login`、`pnpm edgeone:link`）。本机调试用 `.env.edgeone.example`。
- GitHub Actions：手动触发 `Deploy to EdgeOne`（`edgeone-deploy.yml`），项目名默认 `tongmutvplus`。
- 数据库推荐 Turso：设置 `NEXT_PUBLIC_STORAGE_TYPE=turso`、`TURSO_URL`、`TURSO_TOKEN`，`pnpm init:turso` 建表；以后有新迁移时手动触发 `Turso Database Migration`（`turso-migrate.yml`）。

## 验证情况

每次改动部署配置都要写清楚哪些真的跑过：

| 平台       | 怎么验证                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------- |
| Docker     | 每次推送 main，GitHub Actions 先跑全部检查和 `next build`，再构建并发布镜像；服务器上实际在用 |
| Render     | 用的就是上面的镜像；Blueprint 本身没有实际部署过                                              |
| Vercel     | 没有实际部署过；`next build` 在 CI 里每次都跑                                                 |
| Cloudflare | 手动触发 `Deploy targets build`（`deploy-targets.yml`），只构建不部署                         |
| EdgeOne    | 同上                                                                                          |

最近一次结果记在 `docs/design/PROGRESS.md`。本机 Windows 上构建不可靠（Node 会随机原生崩溃，OpenNext 也不完全支持 Windows），以 GitHub Actions 的结果为准。
