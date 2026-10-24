# TongMuTV Plus 运行与恢复

新版长期房间使用完整 Node 服务、Socket.IO 和 SQLite。根目录 Dockerfile/compose 对应这个运行方式。静态托管、Edge/Lite、外置旧房间服务器不具备这套房间持久化能力。

## 启动

### Windows 一键本地验收

双击根目录 `启动TongMuTVPlus.cmd`。首次运行自动创建 `.env`，站长为 `admin`，初始密码为 `123456`；创建 `.data/moontv.db` 并运行现有数据库迁移，启用内部长期房间和网页服务，健康检查通过后打开浏览器。需要 Node.js 22.9 或更高版本，项目使用 Node.js 24。缺少依赖时会通过 pnpm 10.14.0 安装锁文件中的依赖，需要联网。

根目录只保留这一个双击启动入口。原 `启动TongMuTV.cmd` 只是转调它的重复入口，已移除；`scripts/start-local.cjs` 是该入口调用的内部启动实现。

脚本打开系统默认浏览器，不会自动登录或复制其他浏览器的外观设置。内置浏览器与 Edge / Chrome 的登录状态、主题偏好分别保存：未登录时显示访客首页，不显示个人观看记录和自己的房间，推荐资料也可能比登录后少。对比界面时，应使用相同账号、主题和浏览器视口；不要据此认定脚本启动了另一版服务。

这是本机开发验收模式，首次访问页面会编译，不需要 Docker 或先完成生产构建。固定只监听 `127.0.0.1`，默认端口 3000；端口被其他程序占用时从后续 9 个端口中选择，不关闭其他程序。终端会显示实际地址。保持启动窗口打开；Ctrl+C 停止。重复双击会复用已就绪服务，不重复初始化或重置账号、房间和影视源。

已有 `.env` 配置保留，只补缺失字段；空密码、其他存储/外部房间或 Edge/Lite 配置会明确报错，避免隐式迁移。已有管理员密码不自动改为 `123456`。`.env.local` 等文件按 Next 开发模式优先级读取。初始化、运行日志位于 `.data/local-start.log`；启动状态为 `.data/local-launch.json`，均不进入 Git。弱初始密码仅供本机验收，正式部署使用自己的密码和部署流程。

登录后打开 `/admin` →「视频源配置」→「添加视频源」，填写名称、唯一 Key、兼容的苹果 CMS API 地址，Detail 可留空。也可在「配置文件」粘贴含 `api_site` 的 JSON。启动器不内置真实影视来源；首页推荐海报不等于已有可播放片源。影视源有效性检测通过后仍需实际播放验证。配置订阅当前要求远端响应正文为 Base58 编码的 JSON，原始 JSON 可直接粘贴/上传。

### Docker 部署

复制 `.env.example` 为 `.env`，填写自己的 `PASSWORD`。登录签名改用独立的 `AUTH_SECRET`：不填时首次启动自动生成，保存在数据库同目录的 `auth-secret`（日志会提示一次），之后重启沿用；从旧版升级后所有人需要重新登录一次。修改站长密码不再让别人的登录失效，想强制全员下线就删掉 `auth-secret` 或换一个 `AUTH_SECRET`。定时任务由程序每小时自动执行；只有需要外部触发时才设置 `CRON_PASSWORD`，未设置时外部无法调用 `/api/cron/*`。没配 `PASSWORD` 时不会创建站长账号（以前会建一个密码为 123456789 的 admin）。`USERNAME` 为站长账号；其余成员由站内账号管理创建。不要把私密配置提交到仓库。

```sh
docker compose build tongmutvplus
docker compose up -d tongmutvplus
docker compose ps
docker compose logs --tail=100 tongmutvplus
```

默认仅监听宿主机 `127.0.0.1:3000`，由自己的 HTTPS 反向代理提供访问。局域网直接访问时，可在 `.env` 把 `BIND_ADDRESS` 设为 `0.0.0.0`。反向代理需要转发 `/socket.io/` 的 WebSocket Upgrade、原始 Host；其空闲超时应大于 60 秒。浏览器 Origin 与转发 Host 不同的情况下，将实际站点 Origin 写进 `ROOM_ALLOWED_ORIGINS`，多个以逗号分隔。

卷语义保持不变：`./.data` 挂到 `/app/.data`，数据库仍叫 `/app/.data/moontv.db`；`./data` 是原离线下载目录 `/data`；新增 `./backups` 只保存备份。品牌变化不重命名旧数据库，也不修改媒体画质、传输或许可证。不要用会删除卷的清理命令做升级。

`.env.example` 列出房间容量、重连、休眠、归档和消息保留配置。默认每人 3 房、每房最多 8 个在线连接、消息保留 30 天。Compose 固定启用内部房间与 `d1`（本机 SQLite）存储；本机直接启动时也需要相应环境变量，不能只依靠 Compose 的 `.env` 插值。

## 健康检查与版本

```sh
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/health/ready
```

`/health` 表示 HTTP 服务可以响应；`/health/ready` 还验证启用的内部房间服务与 SQLite 表可读。可用返回 200，不可用返回 503；两者支持 GET/HEAD。响应只包含服务名、版本、运行时间和部署标识，不返回账号、密码、媒体地址或数据库路径。它不代表某个外部影视源可以播放。

部署前将 `.env` 的 `APP_COMMIT_SHA` 设为本次提交 SHA 或自己固定的发布编号，然后检查 `/health` 返回的 `buildSha` 是否一致。留为 `unversioned` 不能证明部署到了哪一版。Compose 每 30 秒调用 readiness，首次给 90 秒启动时间。

## 在线备份

站点保持运行也可以备份。下面的名字每次必须不同，并且需同时保留生成的 `.manifest.json` 文件：

```sh
docker compose exec --user 0 tongmutvplus node scripts/ops/sqlite-backup.cjs --output /backups/20261008-120000.sqlite
```

脚本使用 SQLite 的在线备份接口，把已提交但仍在 WAL 日志里的数据一并保存。不要在运行期间只复制 `moontv.db`，那样可能漏掉最新写入。备份后会执行完整性检查，记录 SHA-256 与关键表行数。输出不打印数据内容；备份本身包含账号、登录令牌、私有配置和聊天，应按数据库的私密程度保存。容器内文件权限为 0600；Windows 宿主机目录还需使用自己的访问权限。

本机同样可运行：

```sh
node scripts/ops/sqlite-backup.cjs --db .data/moontv.db --output backups/20261008-120000.sqlite
```

备份数据库时把同目录的 `auth-secret` 一起保存；只恢复数据库、丢了这个文件也能用，只是所有人要重新登录。

脚本不自动删除旧备份，也不创建定时任务。保留周期与异地副本由部署者设置；只在同一磁盘留副本不覆盖磁盘损坏场景。

## 恢复

先在隔离路径验证备份，确认结果，再替换正式库：

```sh
docker compose run --rm --no-deps --user 0 --entrypoint node tongmutvplus scripts/ops/sqlite-restore.cjs --from /backups/20261008-120000.sqlite --db /backups/rehearsal.db
```

目标路径必须是新文件。检查输出的 `integrity`、SHA 与关键表行数；该命令只证明数据库恢复，实际登录、房间和播放还需在隔离实例验收。

正式替换必须停止服务：

```sh
docker compose stop tongmutvplus
docker compose run --rm --no-deps --user 0 --entrypoint node tongmutvplus scripts/ops/sqlite-restore.cjs --from /backups/20261008-120000.sqlite --db /app/.data/moontv.db --replace-existing --service-stopped
docker compose up -d tongmutvplus
```

`--service-stopped` 是操作者对停服的明确声明，不是脚本自动检测结果。目标已有数据库时，缺少任一覆盖参数都会拒绝恢复。恢复时验证备份清单，创建排他 `.restore.lock`，先检查暂存文件，再将原 db/WAL/SHM 移入旁边的 `restore-rollback-*` 目录。恢复的新库继承旧库所有者，供原应用账号继续读写。失败会尝试回退旧文件；成功也保留回退目录供人工核对。启动服务时若发现恢复锁会停止启动；异常中断留下锁时，应先检查暂存/回退文件，确认恢复已经结束后再移除锁。

服务重启会恢复房间资料、片单、聊天与已读游标，但播放先暂停、主持租约重新建立。实时屏幕共享必须由用户重新发起；备份不包含浏览器正在采集的画面。若这次升级包含以后新加的不可逆数据库迁移，不能直接假定旧程序能打开新库；应恢复对应版本的备份与镜像。

## 可复现验证

```sh
node --test --test-timeout=30000 scripts/ops/maintenance.test.cjs
node scripts/ops/room-load.cjs --connections 50 --duration-ms 30000 --output docs/verification/room-load-local.json
```

恢复测试使用专属临时库演练在线 WAL 备份、恢复到隔离目录、原数据不受影响、覆盖保护、校验清单、回退副本，并核对房主、片单、进度、聊天和已读游标。不会读取或替换当前站点 `.data`。

负载脚本新建隔离 Node 子进程与 SQLite，使用生产房间模块和真实登录签名，建立 50 条真实 Socket.IO/WebSocket 连接，分成 7 房（6×8+2），持续发送播放状态、片单、聊天和心跳，进行一次断线重连并检查跨房间信令被拒绝。生成记录包含确认延迟、快照数量、服务进程内存、CPU 和事件循环延迟。它不启动 Next 页面、不请求媒体、不产生真实音视频，也不代表长时间运行、容器或生产网络验收。

2026-10-08 本机记录见 [验证结果](verification/operations-20261008.md) 与 [50 连接原始数据](verification/room-load-50-20261008.json)。容器构建/启动、反向代理、真实视频代理吞吐和真实 WebRTC 音视频仍须在部署环境验证。
