# SyncTV 重构：重装系统前的未完成备份

用户于 2026-11-12 要求立即停止开发并推送 GitHub，以便格式化重装。
此提交只保存现场，不代表重构完成或可以生产切换。未合并默认分支，不部署。

## 接手位置

- 主要记录：`SYNCTV-IMPLEMENTATION-LEDGER.md`、`SYNCTV-LOCAL-SETUP.md`。
- 第一批接入基础已验证；第二批真实 MP4/HLS 网关和两个独立 Chrome 的媒体测试通过，但那是一次性媒体测试页面，不是新房间界面的同步验收。
- 第三批已写 PlaybackPort、同步适配器、时钟、重连和根层房间会话；新模式的工作区与首页摘要已接代码，尚未通过本站双浏览器同步、完整设备与深浅主题验收。
- 默认仍为 `TOGETHER_BACKEND=legacy`，旧房间和旧同步尚未退役。封面上传、完整片单/选集、密码房间、聊天及成员管理、关联活动、归档切换等仍有未完成工作。

## 停止时明确未解决的事项

- `src/features/playback/port.test.ts` 的 `slow buffered seeks and seek-to-end events keep remote attribution` 当前失败：远端 seek 标记超过三秒过期，seek 到结尾的 ended 事件也未正确归属。已写复现测试，尚未修复，用户要求停止后不继续改功能。
- `RoomPlaybackAdapter.correct()` 已避免取消尚在加载的选片，相关测试通过。
- `SyncHomeRooms` 已修正切换账号后请求失败会带出旧账号私密摘要的问题，Linux 同源测试通过。
- `SyncRoomWorkspace` 的表单 ARIA 修改已写入；最后一次测试命令被中断，其后独立运行已观察该套件通过，但仍有测试 act 警告。最终全套检查和格式检查未完成，不应把之前的通过结果当作此快照全绿。
- `playback-selection.ts` 目前只填充选定集数的网关地址，尚需补齐完整选集/上下集协作；不要当作完整连续剧体验交付。
- Windows Node/PowerShell 多次出现原生崩溃，根因未确定。此前使用相同版本 Linux Node/SWC 完成补充验证；最后一轮 Linux 全套仅 Windows SQLite 插件不兼容套件失败，该套件在 Windows 单跑通过。后续改动仍需重新验证。

## 重装后恢复

1. 检出本备份分支，使用 Node 24、pnpm，安装锁定依赖。
2. 保留默认 legacy 模式；按 `SYNCTV-LOCAL-SETUP.md` 在隔离环境初始化新的私密配置。
3. 阅读 ledger 后从上述失败测试继续，勿重新研究已核对的固定协议版本：SyncTV 1.0.14 / 客户端 1.1.32。
4. 完成计划全部验收门槛后才能切换默认入口、删除旧房间实现。

GitHub 备份包含代码、协议、许可、计划和交接记录。被忽略的 `.data/`、私密环境变量、测试账号密钥、WSL 测试实例及 `output/` 本机证据不包含在此提交中。重装后用初始化工具重建隔离测试环境，不复用旧测试账号。
