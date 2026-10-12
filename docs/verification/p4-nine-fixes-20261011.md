# P4 九项修订验收 — 2026-10-11

九项修订已实现。API、服务端、同步 Hook、session.ts、PlaybackSessionProvider 会话逻辑、LegacyPlaybackSurface 均未修改；无新增依赖、提交或部署。

## 修改文件与规范对应

| 文件                                                                                        | 修改                                                                                    | 对应规范/请求                                      |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| src/features/rooms/RoomWorkspace.tsx                                                        | 片单 ▶ + ⋯；窄屏聊天跳转；手机操作菜单；介绍占位文案；稳定的播放定位锚点；消费邀请参数  | DESIGN §5.1、§5.2、§3.3 第 13 条；本次 1/2/4/6/7/8 |
| src/features/rooms/RoomActionMenu.tsx                                                       | 新增展示菜单，沿用调用者的权限和动作；Portal 避免被播放器和滚动容器遮住                 | DESIGN §2/§7；本次 1/7                             |
| src/features/rooms/rooms.css                                                                | 单行片单操作、44px 目标、菜单、token 聚焦环、28px 两行手机房间名、个人观看锚点          | DESIGN §5/§7；本次 1/2/4/6/7                       |
| src/features/playback/playback.css                                                          | 房间小窗左侧定位；小窗隐藏原控制栏，悬停显示播放/进度；历史提示实色 token；复制按钮文字 | DESIGN §4/§3.3 第 13 条；本次 2/3/5/9              |
| src/components/PageLayout.tsx、MobileHeader.tsx                                             | 可选手机右上角操作插槽；其他页面不提供该插槽                                            | DESIGN §5；本次 7                                  |
| src/components/watch-room/ChatFloatingWindow.tsx                                            | 复制图标补「复制邀请」文字、title、aria-label                                           | DESIGN §6/§7；本次 5                               |
| RoomActionMenu.test.tsx、RoomWorkspace.invite.test.tsx、RoomWorkspace.presentation.test.tsx | 菜单键盘/动作；邀请消费/失败保留/退出防重入；个人观看往返定位锚点不重建                 | 本次 1/2/8                                         |
| docs/design/PROGRESS.md、本报告                                                             | 简短交接与验收证据                                                                      | AGENTS 验证/进度要求                               |

聊天标题旁原圆形图标是**复制房间邀请链接**，原动作保留，现显示「复制邀请」，复制后显示「已复制」。手机邀请、设置（仅房主）、退出移入右上角 ⋯，入口没有删除。

## 邀请修复的逻辑范围

只改 RoomWorkspace 内处理邀请地址的一小段：

- **233–235 行**：加入成功时，如果地址本来就是该房间的邀请，跳过原本覆盖整个查询串的 replace，保留其他参数。
- **247–260 行**：收到已加入该房间的快照后，删除 `room` 参数，用 `router.replace(..., { scroll: false })` 更新地址；保留其他查询参数和 hash，并记录已尝试的邀请。
- **270 行的 effect 依赖**增加 params/router。原加入、退出、房间命令与 Socket 动作不改。

新增三个邀请测试：已在房间时消费参数；成功加入后等待快照消费且清理尚未完成时退出不会重复加入；密码失败保留参数供重试。

真实浏览器操作记录（不是模拟接口）：

1. 访问 `/watch-room?room=F0849E5B8A42&keep=ok`。
2. 加入成功，地址变为 `/watch-room?keep=ok`，房间仍显示。
3. 点「退出房间」，等待 2.5 秒；地址为 `/watch-room`，工作区已消失，我的房间中人数为 0，没有自动重入。

证据：`invite-checkbox-final.log`、`invite-entered.png`、`invite-exited.png`。

## 浏览器验收

使用真实 Chromium、隔离的临时 SQLite 和验收账号，播放本地 120 秒 MP4。未写入原项目数据库。视频画面中的彩色测试条来自影片，不是界面颜色。

- 390 / 820 / 1280 深浅主题六张截图完成；各宽度 scrollWidth 与视口相同，无横向溢出；播放器与定位槽矩形对齐；可见按钮目标达到 44px。
- 约 385px 片单面板：每行播放/菜单均 44×44 且同一纵坐标，最终截图等待换位动效完成后拍摄。
- 菜单：ArrowDown 跳过禁用「上移」并聚焦「下移」，End 聚焦「移除」，Escape 恢复触发器焦点；真实点下移、上移恢复片单顺序。移除动作由组件测试确认调用一次，未在浏览器删除验收影片。
- ≥1200 标题下聊天按钮隐藏；390 点击聊天按钮后，聊天标签激活并滚到聊天。主标题 28px、最多两行省略；保留既有滚动收缩，收缩后 17px 单行。长标题截图见 `mobile-long-title.png`。
- 创建弹窗：键盘聚焦自绘复选框，实际 outline 为 `rgb(250,250,250) solid 2px`，与深色 --tm-text 一致，无蓝色 shadow；占位文案正确。
- 历史提示实色背景使用 --tm-glass-solid，文字/按钮/边框为 token，取消该提示自己的 blur。原绿色观感来自半透明模糊层采样彩色影片。最终深色 390/1280 截图中实际「上次播放到 1:14」提示为黑白；没有改 Legacy 的内联逻辑。此次未保留单独提示的计算样式采样，补拍时提示已消失。

### 同一视频与小窗

最终个人观看复验：桌面视频 x=48，聊天 x≈846.66，无重叠；390 滚动到聊天时，视频随主区锚点滚出视野，聊天及输入框保持可见，无重叠。桌面 21.838056 秒 → 手机 22.641738 秒，`video`引用相同，paused=false，pause/emptied/abort 事件数组为空。

另外，房间主区已有「回到一起看」，仅在房间页隐藏全局浮动的重复按钮，避免遮住聊天输入框；其他页入口保留。最终采样 floatingReturn=none，输入框 44px 且可见。

窄屏需要为小窗预留主区空间，因此复用一个稳定的 PlaybackSlot，只切换包裹层 class；不增设第二个 Slot，避免旧 Slot 卸载时清掉新锚点。全局 video 宿主保持原样。窄屏滚动不对定位坐标做延迟过渡，避免小窗追赶滚动时经过聊天。

桌面换页复验（早于最终窄屏锚点修订，桌面小窗定位/控制规则不变，重复浮动返回按钮此后在房间内隐藏）：房间小窗 left48→ 搜索页 left896→ 返回 left48，同一 video 引用，0.681→3.519→4.497 秒持续播放，无 pause/emptied/abort。鼠标未悬停时进度/中央播放 opacity0，悬停时 1，原完整控制栏 display:none。相关样本单独提取为 `mini-navigation.json`，不把旧窄屏样本作为最终证据。

截图：`personal-viewing.png`、`personal-mobile-chat.png`、`mini-hover.png`、`search-mini-right.png`。最终定位记录 `personal-final.log`；菜单及目标记录 `layout-menu-final.log`、`rows-title-final.log`；六组记录 `viewports.log`。

## 命令结果

| 命令                                | 结果                                                                 |
| ----------------------------------- | -------------------------------------------------------------------- |
| pnpm typecheck                      | 通过，exit0                                                          |
| pnpm test --runInBand               | exit1；32 套件、215 项测试通过；1 个旧迁移套件无法运行               |
| pnpm test:rooms                     | 19/19 通过，exit0                                                    |
| pnpm lint                           | exit1；81 个已有错误，本轮没有扩大修复                               |
| pnpm format:check                   | exit1；报告 596 个文件格式问题，包含已有文件与验收输出；未全局格式化 |
| 本轮 8 个 TS/TSX 文件 eslint        | exit0，0 错误/0 警告                                                 |
| 本轮 10 个代码文件 prettier --check | exit0                                                                |

旧失败是 `scripts/migrate-branding.test.js` 使用 node:test，与 Jest27 运行器冲突，报 Cannot find module 'test'。本次新增测试及稳定定位槽回归测试均在最终全量运行通过。

早期 typecheck/Jest 及浏览器曾异常退出（Node24 原生异常、Chrome 页面崩溃），保留对应运行器错误日志；最终 typecheck 和全量 Jest 均已完成输出。开发缓存也出现损坏警告。失效/空采样和旧手机位置不作为验收证据。

## 未验证与保守处理

- 未验证 Safari / Firefox、真机软键盘、真实上游/HLS、长时播放和全部权限组合。本轮真实浏览器只有一个账号，未重复上一轮双客户端同步验收。
- 本轮没有重复完整的减少动态/无模糊偏好矩阵；新增菜单无动画/blur，聊天滚动继续读取现有减少动态设置，原播放过渡偏好覆盖保留。触摸设备没有 hover 时保持播放/进度可用，避免无法操作。
- 桌面个人小窗固定在主区左下角；窄屏置于主区下方预留空间，滚动时跟随该空间，保守保证不覆盖聊天。其他页面保持右下角。
- 28px 房间名仅改变展开手机标题，保留外壳原滚动收缩行为。未调整布局以外的播放器、同步、声音归属或会话处理。
- 验收包只含本报告、截图、结果日志和测量数据，不含源代码、数据库、凭据、开发服务日志。
