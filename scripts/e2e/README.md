# 端到端测试脚本

在本机起一个独立的测试站（端口 3100、单独的数据库），用无头 Chrome 实际操作页面。不加依赖：Chrome DevTools 协议走 Node 自带的 WebSocket。

## 准备

1. 用 Node 24（见 `AGENTS.md`）。
2. 照 `test.env.example` 建 `.claude/test.env`，填测试站专用的账号、密钥和数据库路径。这个文件被 git 忽略，**账号密码绝不进仓库**。放在别处时用环境变量 `TM_TEST_ENV` 指过去。
3. Chrome 不在默认位置（`C:/Program Files/Google/Chrome/Application/chrome.exe`）时，用 `CHROME_PATH` 指过去。

## 启动测试站

- Claude 桌面版：预览工具启动 `tongmu-test`（`.claude/launch.json`，被 git 忽略）。
- 自己的终端：`node scripts/e2e/test-supervisor.cjs`。看门狗：Windows 上 Node 会随机原生崩溃，崩了自动重启 `test-server.cjs`。
- 第一次用、或数据库清空后：`node scripts/e2e/seed-test.mjs` 建第二个测试账号和一个测试房间，房间号写进 `.claude/test-room.txt`。

测试站地址默认 `http://localhost:3100`，可用 `SNAP_BASE` 换。跑完关掉测试站。

## 脚本

| 脚本                                                            | 做什么                                                                                                    | 结果                                                         |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `node scripts/e2e/solo-test.mjs`                                | 自己看：播放页建播放器、播放、离开页面转小窗（同一个视频元素接着播）、回到播放页                          | 逐项 PASS / FAIL，全过退出码 0                               |
| `node scripts/e2e/sync-test.mjs`                                | 一起看：房主和第二个账号进同一房间，房主播放 / 暂停 / 拖进度 / 快速暂停，成员要跟上；成员发聊天房主要收到 | 逐项 PASS / FAIL / NET（测试片加载慢无法判断），全过退出码 0 |
| `node scripts/e2e/playback-check.mjs <输出.json>`               | 自己看播放器的设置菜单、控制条、快捷键、小窗来回、倍速记忆                                                | 只记录不判断：改前改后各跑一次，对比两份 JSON                |
| `node scripts/e2e/style-snapshot.mjs snap <目录> [页面...]`     | 6 种窗口 × 深浅两种主题打开各页面，记录每个元素的位置和主要计算样式                                       | 快照目录                                                     |
| `node scripts/e2e/style-snapshot.mjs diff <改前> <改后> [噪声]` | 对比两次快照                                                                                              | 只报差异，没有差异退出码 0                                   |
| `scripts/e2e/snap-all.sh <目录> [页面...]`                      | 拍一整套快照（主账号 + 成员账号），测试站崩了等它重启再续拍                                               | 快照目录                                                     |

测试片默认是本机现做的 200 秒 WAV（放在 `.claude/test-media/`，任何位置都能精确跳转）；`SYNC_TEST_MEDIA=remote` 改用外网视频。`sync-test.mjs` 的 `SYNC_TEST_SLOW=1` 把成员网速压到很慢，用来看房主的操作会不会被误当成回声。快照的页面清单在 `snapshot-pages.json`（成员账号用 `snapshot-pages-member.json`）。

快照目录、日志、截图都不进 git。
