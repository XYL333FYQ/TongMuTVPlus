# 放映室体验与缺陷审查

> 状态：进行中。日期：2026-10-21。分支：`audit/room-page-polish`。
> 问题总数、修复数量、剩余原因和人工确认事项在最终验收后填写；本文件不将历史通过记录视为本轮结果。

## 范围、假设与执行计划

- 启动方式：`pnpm dev`（生成 manifest 后启动 Next.js 自定义服务器和 Socket.IO）。已实际用 Playwright 打开 `/watch-room`，初始视口明确设置为 1440 × 900。
- 当前工作区已有大量未提交修改，包含房间组件、样式及展示组件。本轮保存基线，只提交本轮差异，不包含已有工作、不推送、不改远程。
- 测试使用现有 SQLite 的在线备份和新测试账号/房间，运行时指定临时测试库；不修改持久配置或原数据库。测试后通过正常操作删除自己创建的房间和账号，移除临时库。
- 先完成未修复状态的交互、多人、网络及响应式检查；再按 P0 → P3 逐条修复。预计最小修改位置为 `src/features/rooms/RoomWorkspace.tsx`、`RoomActionMenu.tsx`、`rooms.css`、`src/components/watch-room/ChatFloatingWindow.tsx` 及必要回归测试。实际文件以各问题记录为准。
- 每项修复先保存可复现证据，再修改、运行项目检查、重启预览，用 Playwright 重走原步骤并检查回归，最后单独提交。源码检查期间关闭预览，防止 `.next/types` 生成竞争。
- 保持当前黑白灰设计、现有播放器单例、协议、接口和存储键；不做无关重构、依赖升级或全库格式化。项目禁区只读；落在禁区且没有安全局部解法的问题记录原因。
- 对有歧义的设计采用现有行为；涉及改变产品决策的项目记入待确认。用户已明确授权自主执行，本轮无需等待计划确认。

## 验收矩阵

| 维度         | 检查内容                                                               | 本轮结果与证据 |
| ------------ | ---------------------------------------------------------------------- | -------------- |
| 每个交互     | 导航、搜索、主题、头像、房号、成员、邀请、菜单、选片、三标签、快速开始 | 待检查         |
| 聊天         | 发送、空白、超长、表情、键盘、历史、未读                               | 待检查         |
| 多人         | 两个独立浏览器上下文、主持/普通成员、片单到播放、授权                  | 待检查         |
| 恢复         | 短断线重连、离线消息、刷新、离页留房、播放连续性                       | 待检查         |
| 网络与控制台 | error/warning、失败/重复请求、WebSocket                                | 待检查         |
| UI           | 对齐、层级、对比度、文案、图标、占位、骨架/加载态                      | 待检查         |
| 交互与无障碍 | hover/focus/active/disabled、Tab/Enter/Esc、热区、反馈、确认、语义     | 待检查         |
| 响应式与主题 | 1920/1440/1280/1024/820/768/390，各深浅一次                            | 待检查         |
| 性能与偏好   | 首屏、图片懒加载、请求/渲染、减少动态、无模糊                          | 待检查         |
| 工程检查     | build、typecheck、lint、test、format:check、test:rooms                 | 待运行         |

## 问题

### ROOM-01 · P2 · MP4 可播放，但影片信息读取误用 HLS

- 复现：选择影片 → 视频直链 → 输入 `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4` → 加入片单 → 主持开始播放。
- 预期：原生 MP4 解码并正常读取资料，不交给 HLS 清单解析器。
- 实际：两端 `readyState=4`、时间递增，同时控制台出现 `manifestParsingError / no EXTM3U delimiter / 获取视频信息失败`。根因是 `getVideoResolutionFromM3u8` 无条件建立 Hls 实例；旧播放界面也用它读取 MP4 信息。
- 修复：只在原工具函数增加 MP4 原生元数据分支，保留原 HLS 路径；读取失败/超时仍返回真实错误，完成后释放探测媒体请求，不虚构码率或速度。
- 证据：`screenshots/07-playback-before.png`、`screenshots/room-01-mp4-after.png`。状态：已修复，Playwright 重走实际 MP4 播放，`readyState=4`，本段控制台 error 为 0（另有浏览器 Wake Lock 权限 warning）。新回归测试 3 项先红后绿；typecheck 0，全量 64 套/375 项通过，房间 19/19；全库 lint/format 仍为历史失败，修改文件 lint/格式通过。

### ROOM-02 · P2 · 房间弹窗没有键盘焦点管理

- 复现：点击创建房间、选择影片或房间设置；按 Tab、Shift+Tab、Esc。
- 预期：焦点进入弹窗并在其中循环，Esc 关闭，关闭后回到入口。
- 实际：初始焦点仍在背景创建按钮，Tab 可进入背景导航，Esc 不关闭；有 `aria-modal` 却没有对应模态行为。
- 证据：`screenshots/01-dialog-escape-before.png`。状态：待修复。

### ROOM-03 · P2 · 手机聊天控件点击区域不足

- 复现：390×844、`isMobile=true / hasTouch=true / pointer:coarse`，打开聊天。
- 预期：点按区域至少 44×44。
- 实际：选择表情、发送均 30×30；加载历史按钮高度 30。细指针桌面与平板也为 30px。
- 证据：`screenshots/09-mobile-chat-touch-before.png`；七宽度双主题几何采样。状态：待修复。

### ROOM-04 · P2 · 三标签缺少方向键切换及面板语义

- 复现：聚焦片单标签，按右方向键、Home/End。
- 预期：焦点与选中标签同步移动；选中标签关联可识别的 tabpanel。
- 实际：焦点和选中标签都不动，三个标签全进入 Tab 顺序，目标面板没有 tabpanel 语义。
- 证据：`screenshots/04-queue-unread-before.png`，Playwright 实际键盘操作。状态：待修复。

### ROOM-05 · P2 · 头像菜单 Esc 无效

- 复现：点击顶栏账号头像，按 Esc，继续尝试点击房间标签。
- 预期：菜单关闭并把焦点交还头像。
- 实际：透明遮罩仍拦截点击；头像也没有展开状态和关联面板信息。
- 证据：`screenshots/11-account-escape-before.png`；Playwright 点击被遮罩拦截。状态：待修复。

### ROOM-06 · P2 · 表情选择器无法 Esc 关闭，断线时仍允许发送

- 复现：打开表情选择器后按 Esc；真实停止测试服务后再次打开。
- 预期：Esc 关闭并回到表情按钮；断线时发送入口禁用，草稿保留。
- 实际：Esc 后仍打开；发送文字已禁用，表情按钮仍可点击并触发无效命令。
- 证据：`screenshots/05-chat-emoji-before.png`、`screenshots/12-real-disconnected-before.png`。状态：待修复。

## 待确认

- 推荐海报最初向豆瓣图片域发请求收到 HTTP 418，再使用现有公开备用域成功显示；这属于当前外部来源策略和可达性，不能靠吞控制台错误伪装通过。后续核查是否有房间局部安全修复。
- Google 示例长片返回 HTTP 403，已改用实测返回 206 的 W3C 测试 MP4。诱发的失败与重试单独记录，不计为普通主流程通过；项目自己的错误提示确实出现。

## 命令输出与边界

最终填入本轮命令、退出码、输出摘要及未通过原因。

实现参考：[原生媒体元数据事件](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event)、[WAI 模态弹窗键盘规范](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)、[WAI 标签页键盘规范](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)。
