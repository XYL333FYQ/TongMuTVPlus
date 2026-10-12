# 游客浏览与媒体授权边界

游客可以访问首页、片库 `/douban`、搜索、关于和公开房间列表。公开房间摘要由独立房间服务提供；房间详情、队列和控制仍需登录。

影视元数据接口：

```text
GET /api/public/catalog?mode=search|browse&q=关键词&type=movie|tv|all&tag=热门&start=0&limit=20
```

返回 `{ items, start, hasMore }`。每个 `item` 仅包含 `id`、`title`、`poster`、`year`、`description`、`rate`、`mediaType` 和 `provider`。接口新建固定字段对象，不把原始采集站响应、剧集播放 URL、源 API、私人影库或服务器密钥传给游客。

搜索使用服务器配置的 TMDB；未配置 TMDB 时查询豆瓣公开建议。浏览使用豆瓣公开影片列表。两种模式都不查询站点配置的 CMS 或私人影库。上游不可用时返回 502，前端应提示暂时无法获取，不能解释为影片不存在。`limit` 为 1–40，`start` 为 0–500。

点击影片后进入 `/play`，未登录时转到登录页，站内目标同时保存在原有 `redirect` 和新增 `returnTo` 参数中。旧搜索、详情和普通代理接口仍需真实认证。游客搜索不恢复登录用户包含播放 URL 的搜索缓存，不读取或订阅私人搜索历史；游客卡片使用公开海报组件，不挂载私人收藏、AI 和自定义图片代理链。

`/api/search`、`/api/detail`、`/api/source-detail` 的成功媒体响应统一使用 `Cache-Control: private, no-store`，并设置两个 CDN `no-store` 响应头及 `Vary: Cookie, Authorization`。CMS、脚本、私人影库和网盘成功分支均使用此策略；原有 OrionTV 客户端分支仍保留 `User-Agent` 变化标记。服务器内部的采集源缓存继续使用，不能把内部复用和允许公共 CDN 保存含播放地址的响应混为一谈。

认证检查与兼容规则：

- 数据库模式校验与现有登录接口相同的 HMAC 签名、Access Token 时效和刷新期限；读取出用户名并不代表登录成功。localStorage 模式仍校验站点共享密码。
- CMS/HLS/分片代理接受真实站点会话，或已配置的外部代理 token，或启用订阅后的合法 TVBox token。TVBox 用户 token 查询 CMS 时仅能使用其有权访问的源 API；原始源 API 自带的签名参数保留。
- TVBox 订阅到 CMS、HLS 子清单、媒体分片和密钥的链接继续传递来访者持有的 `tvboxToken`。该参数不转发给第三方采集站。
- 外部 HLS 代理 token 优先读取服务器专用 `PROXY_M3U8_TOKEN`，仅在未设置时回退兼容旧 `NEXT_PUBLIC_PROXY_M3U8_TOKEN`。不得在客户端引用任一全局授权 token；迁移时更改服务器配置并更新外部客户端，不自动覆盖已有部署配置。
- 网站内 Emby 海报、播放和字幕使用已有 `proxy` 路径标记，由真实登录会话鉴权，不再向普通网站用户分发管理员或用户 TVBox 订阅 token。外部 TVBox 路由的真实 token 验证保留。
- 内部数据库键、历史缓存键、Android 桥接标识和第三方协议名称继续保留；此项认证改造不进行全局品牌替换。

行为回归使用真正的 `NextRequest` / `NextResponse` 和签名验证，仅模拟上游网络、配置与数据库返回。Jest 27 的 Node 环境没有复制新版 Node 的 Fetch API，因此这些测试使用 `src/test/node-web-environment.cjs` 补齐真实运行时对象。测试覆盖伪造会话不能获取播放或私库、真实会话正常授权、合法 TVBox 链路、关闭/封禁/无效 token、公开字段投影及服务器错误不回显密钥。它们不能证明远端来源稳定、真实影片可解码或多端同步体验；这些仍需实际服务与播放器验收。

2026-10-08 定向验证记录：

- 7 个 Jest 测试文件共 77 项通过：签名认证、媒体代理授权、公开元数据、游客搜索、CMS 地址解析、播放会话组件行为、私有媒体响应头。命令使用 `node --regexp-interpret-all node_modules/jest/bin/jest.js`、上述文件路径和 `--runInBand --silent`。
- 在 `127.0.0.1:3199` 的 WSL Node 22 测试服务、独立临时 SQLite 和临时 QA 账号下，11 类搜索、详情、私库和代理路径分别用匿名请求、仅伪造 owner 字段的 cookie 请求，22 次均返回 401。实际登录返回 200；真实签名会话访问旧搜索返回 200，缺参数的受保护播放/代理请求进入原有 400 参数检查。
- 真实 HTTP 再验旧搜索：签名会话 200，私有缓存头和 CDN 禁存头正确；匿名访问 401。公开房间摘要 200，未带播放状态、队列、消息或密码；未登录 `/play` 跳登录并保留站内 `returnTo`。
- 公开元数据非法模式真实返回 400；实际浏览查询返回不含上游信息的通用 502。同环境外网请求超时，尚未证明真实豆瓣/TMDB 数据获取成功。固定字段投影与非法上游字段剔除由网络夹具验证。
- 合法 TVBox token 的子清单/分片/密钥传播由路由回归验证，未在真实电视客户端完成整链播放。播放会话组件的 5 项测试证明导航、小窗及收起恢复保留同一个 video，明确换片重建，加入片单不抢播，个人观看/回到同步等待服务器确认；测试在 jsdom 中运行，不代表真实视频解码或多端同步验收。
- 定向 lint 没有新增错误；`detail/route.ts` 的原有 `while (true)` 仍触发 `no-constant-condition`，基线中已存在，未为本次授权边界修改循环。
