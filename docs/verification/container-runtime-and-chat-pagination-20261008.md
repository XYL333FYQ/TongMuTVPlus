# 容器运行时与聊天分页补充核验 · 2026-10-08

本记录补充 [P01–P20 审计](requirements-audit-20261008.md) 的 P11/P19。本轮没有安装运行时、启动 Docker Desktop、拉取镜像、启动容器或部署生产；没有读取或修改站点真实数据库。

## 当前容器运行条件

| 环境 | 实际检查 | 结果 |
| --- | --- | --- |
| Windows | `Get-Command docker,podman,nerdctl,containerd,ctr,rancher-desktop,colima,wsl` | 只找到系统 `wsl.exe`；当前 PATH 没有所列容器 CLI。 |
| Windows | Docker/Podman/Rancher/containerd 名称的进程与服务；常见 Program Files 安装目录 | 没有发现相关运行进程、服务或所查安装目录内容。 |
| WSL | `wsl --list --verbose` | `Ubuntu-24.04` 已经处于 **Running**，使用 WSL2；本轮只进入现有运行中的分发检查，没有安装或启动新的大型软件。 |
| WSL | `command -v` 查询 docker、podman、nerdctl、containerd、ctr、crictl | 当前 PATH 均未发现。 |
| WSL | `ps -C dockerd,containerd,podman,conmon,buildkitd -o pid,comm` | 只有表头，没有对应进程。 |
| WSL | 常用 Docker/Podman/containerd socket | `/var/run/docker.sock`、`/run/docker.sock`、`/run/podman/podman.sock`、`/run/containerd/containerd.sock` 均未发现可用 socket。 |
| WSL | dpkg 包列表及常用二进制路径 | 查询 docker.io、docker-ce、docker-ce-cli、docker-desktop、podman、containerd、containerd.io、nerdctl 没有已安装项；所查 `/usr/bin`、`/usr/local/bin` 和 Docker Desktop 的 WSL CLI 共享路径未发现可执行文件。 |

因此，**当前可访问环境没有可直接用于本地容器验收的现有 Docker/兼容运行时**。这不是“镜像构建失败”，也不是“容器健康检查失败”：这些步骤尚未获得运行条件，未执行。

仍缺 P19 的实际镜像构建、隔离数据卷启动、容器内 `/health` 与 `/health/ready`、容器停止后的数据库恢复、恢复后重启，以及 Linux 文件属主验证。现有 [在线备份/恢复测试与操作说明](../operations.md) 仍是原生 Node + 临时 SQLite 的证据，不能升级为容器通过。WSL 处于 Running 也不等于完整 Next 服务已稳定运行。

## HTTP 与 Socket 聊天分页

发现的差异：Socket `chat:history` 已向服务层传递 `beforeSeq`，但 HTTP `GET /api/rooms/:id/messages` 只传递 `afterSeq/limit`，导致 HTTP 请求旧消息时忽略 `beforeSeq`，返回的不是对应旧页。

修复仅位于 [room-transport.js](../../server/room-transport.js)：查询参数存在 `beforeSeq` 时，转为数字并作为第五个参数传给原 `service.history`；未提供时保留 `undefined`，沿用原向前补消息行为。原服务层权限、数值校验和数据库查询继续共用。

当前两种传输的契约一致：

| 请求 | 结果 |
| --- | --- |
| `afterSeq=N&limit=L` / `{afterSeq:N,limit:L}` | 返回严格大于 N 的本房间消息，从旧到新，最多 L 条；用于补齐断线缺口。 |
| `beforeSeq=N&limit=L` / `{beforeSeq:N,limit:L}` | 返回严格小于 N 的最近一页旧消息，回包仍从旧到新；用该页首条 seq 继续向前翻。 |
| 同时提供 beforeSeq 与 afterSeq | 与现有 Socket/服务层行为一致，beforeSeq 优先。 |
| 最早消息之前 | 返回空消息数组。 |
| 非数值 beforeSeq | HTTP 400 / `INVALID_INPUT`；服务层继续校验。 |
| 未登录 / 非该房持久成员 | HTTP 401 / 403；分页参数不会绕过权限。 |

成功响应仍是 `{success,messages,lastMessageSeq,unreadCount}`，读取历史不会提交已读。消息 seq 属于全表递增序号，其他房间可以造成正常空洞；游标不是“消息必须逐个整数连续”的假设。

## 直接行为验证

新增 [真实 HTTP/Socket 对照测试](../../server/room-service.test.cjs) `real HTTP and Socket chat history agree on older and newer pages without changing unread state`：

- 使用专属临时 SQLite、真实 HTTP 监听、真实 Socket.IO 连接和现有签名账号认证。
- 同房生成 145 条消息，并插入其他房间消息制造正常 seq 空洞；join 返回最近 100 条。
- 对照两种传输的多页 beforeSeq、afterSeq、同时传两种游标、最早空页；合并后 145 条无遗漏、无重复、顺序一致。
- 比较 lastMessageSeq，确认读取前后 unreadCount 均为 145；验证非法游标、未登录和非成员被拒绝。

执行：

```sh
node --test --test-timeout=30000 server/room-service.test.cjs
```

结果：**19/19 通过，exit 0**。前一份完整审计记载的 18 项后端测试是当时快照；这里新增第 19 项并补齐 HTTP 分页。测试没有运行 Next 页面、容器或真实媒体，P11 的浏览器实际可见/已读行为、P19 的容器验收仍保持未完成的原边界。
