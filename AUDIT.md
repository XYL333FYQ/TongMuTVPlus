# 放映室体验与缺陷审查

> **本轮结果：确认 19 项问题，修复 14 项；未修 5 项（2 项 P2、3 项 P3）。未发现 P0/P1。** 其中 ROOM-08 是本轮修复引入、随后修正的回归，也计入数量。日期：2026-10-21；分支：`audit/room-page-polish`；14 项修复分别提交，未推送。
>
> **整体验收未全部满足。** 最终源码 typecheck、67 套/388 项测试、房间 19 项、运维 4 项通过；build 未通过，全库 lint/format 有既有失败。剩余三项 P3 为海报首选源 HTTP 418、HLS 恢复性缓冲 error 日志及播放器高级设置残留彩色控件；补测确认两项 P2 为播放器工具栏键盘不可达、跨域影片截图失败，均涉及播放器内部逻辑禁区，详见 ROOM-15–19。完整主流程控制台零 error 未满足。
>
> **早上需人工确认：** 是否另行允许修复 AGENTS.md 禁止改动的播放器内部渲染/截图逻辑；构建环境的原生崩溃及 Windows symlink 权限；是否另行处理全库旧检查债务；同步房间“屏幕共享”入口的产品预期；约 1.5 秒同步容忍与海报首选来源策略。文件删除被自动审批三次拒绝，四个生成物及外部临时目录仍待清理，准确路径见文末。测试房间和账号已通过正常接口删除，原本地服务已恢复。

## 范围、假设与执行计划

- 启动方式：`pnpm dev`（生成 manifest 后启动 Next.js 自定义服务器和 Socket.IO）。已实际用 Playwright 打开 `/watch-room`，初始视口明确设置为 1440 × 900。
- 当前工作区已有大量未提交修改，包含房间组件、样式及展示组件。本轮保存基线，只提交本轮差异，不包含已有工作、不推送、不改远程。
- 测试使用现有 SQLite 的在线备份和新测试账号/房间，运行时指定临时测试库；不修改持久配置或原数据库。测试后通过正常操作删除自己创建的房间和账号，移除临时库。
- 先完成未修复状态的交互、多人、网络及响应式检查；再按 P0 → P3 逐条修复。预计最小修改位置为 `src/features/rooms/RoomWorkspace.tsx`、`RoomActionMenu.tsx`、`rooms.css`、`src/components/watch-room/ChatFloatingWindow.tsx` 及必要回归测试。实际文件以各问题记录为准。
- 每项修复先保存可复现证据，再修改、运行项目检查、重启预览，用 Playwright 重走原步骤并检查回归，最后单独提交。源码检查期间关闭预览，防止 `.next/types` 生成竞争。
- 保持当前黑白灰设计、现有播放器单例、协议、接口和存储键；不做无关重构、依赖升级或全库格式化。项目禁区只读；落在禁区且没有安全局部解法的问题记录原因。
- 对有歧义的设计采用现有行为；涉及改变产品决策的项目记入待确认。用户已明确授权自主执行，本轮无需等待计划确认。

## 验收矩阵

| 维度         | 实际检查与结果                                                                                                                                                                                                 | 主要证据                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 每个房间交互 | 导航/搜索、深浅主题、头像及更多、房号/邀请实际剪贴板、成员入口、设置/退出、空态两个选片入口、三标签和四张快速开始均实际操作                                                                                    | [最终桌面](screenshots/final-1440-light.png)、[快速开始](screenshots/final-quick-start-1.png)；各修复条目                                           |
| 聊天         | 双端按钮/Enter、空白禁用、2200 字输入被限制到 2000、单次表情、草稿保留、历史、未读；断线禁用、短视窗键盘焦点                                                                                                   | [表情](screenshots/room-06-emoji-390-light-after.png)、[短视窗](screenshots/room-14-focus-390x520-light-after.png)                                  |
| 多人/权限    | 两个独立登录上下文；房主授权/撤销、成员自己的片单增删、他人项不可改；服务端拒绝设置/暂停/他人删除；MP4/HLS 双端实播、暂停、拖动、交接                                                                          | [成员权限](screenshots/final-member-queue-permissions.png)、[HLS](screenshots/final-hls-member.png)、[MP4 交接](screenshots/final-mp4-handover.png) |
| 恢复/连续性  | 真正停服并重启，非仅设置浏览器 offline；草稿/重连、刷新后房间/片单/聊天；跨页同一 video、小窗/折叠/恢复、个人观看                                                                                              | [真实断线](screenshots/room-06-disconnected-after.png)、[刷新聊天](screenshots/final-refresh-chat.png)、ROOM-11                                     |
| 网络/控制台  | 连续监听 console/pageerror/request/response/requestfailed/WebSocket；已修 MP4 误解析、隐藏轮询；初轮无 pageerror/WS socketerror，补测截图有两次 pageerror；负面断网有连接拒绝，正常外源有 418/HLS 非致命 error | ROOM-01/13/15/16；下方日志分类。**整体零 error 未满足**                                                                                             |
| UI           | 七宽深浅的对齐、间距、标题/时间字号、文案、图标、海报成功/失败占位、空态及忙碌；修复时间对比度和手机标题重叠                                                                                                   | [最终手机](screenshots/final-390-light.png)、[失败占位](screenshots/final-posters-forced-failure.png)、ROOM-07/12                                   |
| 交互/无障碍  | Tab/Shift+Tab、方向键/Home/End、Enter/Esc、模态隔离/回焦、2px focus-visible、真实粗指针 44px、hover/按下/禁用样式、复制反馈、删除精确名称确认                                                                  | [空名校验](screenshots/final-empty-name-validation.png)、[危险确认](screenshots/final-delete-correct-name.png)、ROOM-02–08/14                       |
| 响应式/主题  | 1920/1440/1280/1024/820/768/390 深浅各一次，无横溢出；手机滚动状态和 390×520 另测                                                                                                                              | 下方 14 张最终主截图及 8 张窄宽面板截图                                                                                                             |
| 性能/偏好    | 开发环境单次首屏测量；图片 lazy/async 和失败回退；消除隐藏轮询；站内减少动态/无模糊、系统 reduce 均实际切换并恢复                                                                                              | [偏好](screenshots/final-visual-preferences.png)、[图片加载](screenshots/final-quick-posters-loaded.png)、ROOM-13                                   |
| 工程/保全    | 最终 typecheck/388 tests/19 rooms/4 ops 通过；目标 lint/格式/设计通过；全库 lint/format 与 build 未过；1027 个原文件核对无越界修改/删除                                                                        | 下方命令输出、文件范围、清理状态                                                                                                                    |

## 用户指定内置浏览器后的补测

- 后续检查已改用 Codex 内置浏览器，通过其 Playwright API 实际操作；没有再启动外部浏览器。最终保留 `/watch-room`，明确为 1440 × 900、浅色、片单标签，未使用默认面板比例。本次新增 20 张 JPEG，连同此前 174 张 PNG 共 194 张。
- 本次使用用户原有空房间，只操作展示、草稿、复制及菜单，没有发送消息、添加影片、改房间设置或删除原房间。先前临时库中的双登录上下文、媒体实播和权限测试仍是此前浏览器的证据，**不能写成已经在内置浏览器重新完成多人及实播验收**。
- 刷新前先见到旧客户端；实际刷新后房间路由和静态资源出现 404。核对路由源码仍在，只停止已确认的本项目旧服务 34528 及启动器 41888，沿用 `scripts/start-local.cjs --no-browser` 重启后页面恢复，最新三标签语义与主持状态均可见。现在启动器为 37596、服务为 54656，仅 3000 监听；没有改源码修复这次预览环境异常。此前不同端口的 Next 服务共用 `.next` 是可能变量，根因没有证实。
- 实操通过：片单 → 聊天 → 成员的 ArrowRight、Home 返回；账号菜单初始焦点、Esc 关闭回焦；选片弹窗反向 Tab 循环、Esc 回焦；空白消息禁用；表情 Esc 关闭回焦；房间操作菜单；深浅主题；刷新后主持状态恢复。草稿已清空，未点击发送。
- 复制校验：内置工具的 clipboard.readText 最初返回空字符串；从同一页面标准 Clipboard API 只读复核，房号为 12 字且与遮罩首尾相符，邀请为 50 字且包含本房间的 `/watch-room` 链接。没有仅凭“已复制”文案判断成功，也没有把工具读数差异当成功能缺陷。
- 输入校验：工具 fill/paste 可将 DOM 值写到 2200，不能用它验证浏览器原生长度限制；改为 1995 字草稿再实际键入 20 字，最终为 2000。整段逐字输入曾在工具期限内只完成 77 字后超时，已清空；没有发送这两类样本。
- 390 × 520 的浅/深色真实 Tab 均聚焦输入框；稳定状态输入框顶 194.125、底 238.125、中心命中 input，焦点环可见，没有被底栏遮挡：[浅色焦点](screenshots/iab-focus-390x520-light.jpg)、[深色焦点](screenshots/iab-focus-390x520-dark.jpg)。主题过渡中的瞬时命中不用于稳定布局结论。
- 内置截图在连续调整尺寸后出现缓存帧、黑边或上一尺寸画面的工具现象；已逐宽分开调整和观察，重拍并逐张看过实际画面。一次只读调试表达式语法错误、一次等待动画的命令超时均属于审查工具，不记为应用错误，没有注入 DOM 修复或屏蔽异常。
- 当前空房间交互和最后刷新期间，捕获的新增 console error/warning 为 0。刷新网络记录有 29 个匹配事件，6 个海报原域 HTTP 418；没有匹配的 loadingFailed 或 WebSocket frame error，记录未截断。海报仍转备用来源，属于 ROOM-15；这不是全站网络无错或完整媒体主流程零 error 的证明。启动恢复之前的资源 404 和 TokenRefresh 旧日志保留为环境事件，不混入恢复后的计数。
- 辅助证据：[聊天键盘](screenshots/iab-chat-keyboard.jpg)、[选片弹窗](screenshots/iab-film-dialog.jpg)、[表情](screenshots/iab-emoji-keyboard.jpg)、[刷新前旧客户端](screenshots/iab-stale-1440-light-before.jpg)。本次仅补充报告与截图，源码未变，不重复之前已经通过的源码检查。

| 视口        | 浅色                                   | 深色                                  | 横向溢出 |
| ----------- | -------------------------------------- | ------------------------------------- | -------- |
| 1920 × 1080 | [截图](screenshots/iab-1920-light.jpg) | [截图](screenshots/iab-1920-dark.jpg) | 无       |
| 1440 × 900  | [截图](screenshots/iab-1440-light.jpg) | [截图](screenshots/iab-1440-dark.jpg) | 无       |
| 1280 × 900  | [截图](screenshots/iab-1280-light.jpg) | [截图](screenshots/iab-1280-dark.jpg) | 无       |
| 1024 × 768  | [截图](screenshots/iab-1024-light.jpg) | [截图](screenshots/iab-1024-dark.jpg) | 无       |
| 820 × 1180  | [截图](screenshots/iab-820-light.jpg)  | [截图](screenshots/iab-820-dark.jpg)  | 无       |
| 768 × 1024  | [截图](screenshots/iab-768-light.jpg)  | [截图](screenshots/iab-768-dark.jpg)  | 无       |
| 390 × 844   | [截图](screenshots/iab-390-light.jpg)  | [截图](screenshots/iab-390-dark.jpg)  | 无       |

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
- 修复：复用项目详情层的原生 `dialog` 模态方式，加首尾 Tab 循环、Esc 取消及关闭回焦；保留现有遮罩、样式、保存及删除规则。第一次原生方案的 Shift+Tab 可进入浏览器工具栏，实测后补齐首尾循环，未改测试来放过问题。
- 证据：`screenshots/01-dialog-escape-before.png`、`screenshots/room-02-dialog-{390,820,1280}-{dark,light}-after.png`。状态：已修复；真实 Esc、正反向 Tab 和回焦均通过。两项新回归通过；最终普通 typecheck 0，65 套/377 项、房间 19/19，目标 lint/格式/设计扫描通过。过程中无诊断原生崩溃与重试保留日志，根因未确定。

### ROOM-03 · P2 · 手机聊天控件点击区域不足

- 复现：390×844、`isMobile=true / hasTouch=true / pointer:coarse`，打开聊天。
- 预期：点按区域至少 44×44。
- 实际：选择表情、发送均 30×30；加载历史按钮高度 30。细指针桌面与平板也为 30px。
- 修复：仅在房间作用域扩大真实命中区，图标尺寸不变，沿用已有宽屏比例。
- 证据：`screenshots/09-mobile-chat-touch-before.png`、`screenshots/room-03-touch-390-after.png`、`screenshots/room-03-chat-{390,820,1280}-{dark,light}-after.png`。状态：已修复；真实触屏表情/发送 44×44、历史按钮高度 44，六种布局无横溢出。typecheck 0、65 套/377 项及房间 19/19；修改样式格式和设计扫描通过，无新增测试（纯命中区样式，以真实浏览器几何和操作验证）。

### ROOM-04 · P2 · 三标签缺少方向键切换及面板语义

- 复现：聚焦片单标签，按右方向键、Home/End。
- 预期：焦点与选中标签同步移动；选中标签关联可识别的 tabpanel。
- 实际：焦点和选中标签都不动，三个标签全进入 Tab 顺序，目标面板没有 tabpanel 语义。
- 修复：左右方向键循环、Home/End、仅当前标签进入 Tab 顺序，并关联可聚焦的 tabpanel。非聊天标签保留原共享输入框，语义为发送消息区域，不把仍可用的输入框对读屏器隐藏。
- 证据：`screenshots/04-queue-unread-before.png`、`screenshots/room-04-tabs-{390,820,1280}-{dark,light}-after.png`。状态：已修复；真实键盘依次到聊天、成员、片单，Tab 进入对应面板，聚焦环 2px。新回归先红后绿，普通 typecheck 0；完整 Jest 初跑原生退出后，用同一套配置与全部用例重跑 65 套/378 项通过，房间 19/19；全库 lint 仍 69 旧错误。没有修改检查配置、过滤用例或压掉异常。

### ROOM-05 · P2 · 头像菜单 Esc 无效

- 复现：点击顶栏账号头像，按 Esc，继续尝试点击房间标签。
- 预期：菜单关闭并把焦点交还头像。
- 实际：透明遮罩仍拦截点击；头像也没有展开状态和关联面板信息。
- 修复：只补展开/关联信息、打开后聚焦第一项、Esc 关闭并回焦，保留既有菜单分组、路由与主题设置。
- 证据：`screenshots/11-account-escape-before.png`、`screenshots/room-05-account-{390,820,1280}-{dark,light}-after.png`。状态：已修复；真实展开 `true`、关闭 `false`，遮罩数量从 1 到 0、焦点回头像，关闭后可操作片单。真实组件回归先红后绿；typecheck 0，66 套/379 项、房间 19/19；本项完整测试重试使用本机已有 Node 24.19.0，未升级依赖。目标 lint 0 error / 5 条既有 warning，格式和设计扫描通过。

### ROOM-06 · P2 · 表情选择器无法 Esc 关闭，断线时仍允许发送

- 复现：打开表情选择器后按 Esc；真实停止测试服务后再次打开。
- 预期：Esc 关闭并回到表情按钮；断线时发送入口禁用，草稿保留。
- 实际：Esc 后仍打开；发送文字已禁用，表情按钮仍可点击并触发无效命令。
- 修复：补 Esc/外点/移焦关闭、展开信息、换房清理；断线禁用选择项和发送守卫。实测断线会让已禁用按钮失焦，补连接变化时回焦入口，保留草稿。未吞发送错误。
- 证据：`screenshots/05-chat-emoji-before.png`、`screenshots/12-real-disconnected-before.png`、`screenshots/room-06-disconnected-after.png`、六张 `room-06-emoji-{390,820,1280}-{dark,light}-after.png`。状态：已修复。真实在线发送到另一成员一次、文本草稿保留；真实停服后十项均禁用、焦点在入口、Esc 关闭、草稿保留。三项新增回归先红后绿，最终 typecheck 0，66 套/382 项及房间 19/19；目标 lint/格式/设计通过。完整测试此前数次原生崩溃后，同配置全部重跑通过；全库 format 本次仍原生退出，最终重查。

### ROOM-07 · P2 · 聊天时间文字对比度不达标

- 复现：打开聊天，深浅各一次，读取时间文字实际样式并与面板背景合成。
- 预期：DESIGN.md §2.1 规定文字对比度至少 4.5:1。
- 实际：时间文字使用 `opacity:0.45`；深色约 4.16:1、浅色约 3.07:1，浅色尤其难读。其他正文与字号不需要调整。
- 修复：房间作用域内时间改用现有 `--tm-muted`，不再叠加透明度，其他正文和布局不变。
- 证据：`screenshots/room-03-chat-1280-{dark,light}-after.png`（修前）、六张 `room-07-contrast-{390,820,1280}-{dark,light}-after.png`。状态：已修复；真实 RGB/背景合成计算深色 7.28:1、浅色 6.25:1，均超过 4.5:1。typecheck 0，完整 Jest 重跑 66 套/382 项通过，房间 19/19；样式格式和设计扫描通过。首次检查过程中 PowerShell 原生访问冲突，改用简单命令执行相同测试完成重试；全库格式仍原生退出，根因未知。

### ROOM-08 · P2 · 头像嵌套弹窗的 Esc 误关外层

- 复现：头像 → 更多功能 → Esc。
- 预期：只关最上层“更多”，回到“更多功能”；第二次 Esc 才关账号菜单。
- 实际：ROOM-05 新增的 document 按键监听先阻止原生 cancel，把整个账号菜单连同子弹窗卸载。独立只读审查提出后已真实复现，本轮修复引入的问题也计入审查数量。
- 修复：外层识别来自已打开原生 dialog 的按键，交还其原生取消；保留其他 Esc 和主题设置。
- 证据：`screenshots/room-08-nested-before.png`、六张 `room-08-nested-{390,820,1280}-{dark,light}-after.png`。状态：已修复；六种布局逐层关闭和两级回焦均通过。新回归先红后绿，账号 2/2，typecheck 0、房间 19/19、目标格式/设计通过；目标 lint 无新 warning（原组件 5 条保留）。本批完整 Jest 原生退出，没有失败断言，最终全量待重查。

### ROOM-09 · P2 · 选片切换模式保留旧搜索状态

- 复现：影视库搜索 `ROOM_AUDIT_SLOW_20261021`，结束前立即切视频直链，填写有效 MP4 地址。
- 预期：直链可独立加入片单；旧影视库结果不污染直链模式。
- 实际：按钮仍显示“正在搜索…”并禁用；旧请求结束后，直链页出现影视库的无结果提示。无网络拦截的真实操作同样复现。
- 修复：切模式清除旧结果/空态/忙碌；取消旧请求并用序号保护成功、错误与 finally，关闭弹窗也取消。保留现有搜索接口与真实错误提示。
- 证据：`screenshots/room-09-search-race-before.png`、六张 `room-09-picker-{390,820,1280}-{dark,light}-after.png`。状态：已修复；六次真实搜索中切直链均立即解锁，无旧空结果，Esc 正常。新增两项回归（迟到成功/失败）先红后绿，5 项组件测试通过。初次新增测试使用旧测试库不支持的 `exact` 类型选项，按批次恢复后重做，去掉无效选项、保留断言；第二实现 typecheck 0，最终 66 套/385 项、房间 19/19、运维 4/4。目标 lint/格式/设计通过；独立只读复核无新增 P0/P1/P2。

### ROOM-10 · P2 · 同步房间访问共享页误开首页并增加连接

- 复现：同步房间主持点击“屏幕共享”；页面回跳，却自动开了一个首页标签。该标签恢复房间连接，成员列表出现同账号另一连接；原标签退出后另一连接仍占主持。
- 预期：不符合共享房间类型的访问只返回，不启动共享专用副作用。
- 实际：共享页的独立首页/禁止连接标记副作用只检查房主，没有检查 `roomType`。浏览器实际记录房主上下文从 1 页变为房间和首页 2 页。
- 修复：仅给该副作用增加现有 `screen` 类型判断及依赖，不改存储键、事件或播放会话。同步房间真正如何切换共享仍属下面的待确认项。
- 证据：`screenshots/final-authorized-member.png`（修前同账号多连接）、六张 `room-10-screen-guard-{390,820,1280}-{dark,light}-after.png`。状态：已修复误开页/标记副作用；六次操作页数始终 1、禁止连接标记始终为空。新回归先红后绿，类型检查 0、67 套/387 项和房间 19/19；目标格式/设计通过，目标 lint 仅 4 条原有 warning。HLS 主持交接复验时成员浏览器渲染进程崩溃，根因未知，未将交接判为通过；后续另复查。

### ROOM-11 · P2 · 退出房间后小窗画面错位并遮挡目录

- 复现：房间播放影片 → 退出房间但停留房间目录 → 点击“公开房间”。
- 预期：视频与小窗播放条一起位于右下角，目录标签可点，保留原视频实例。
- 实际：画面在左上 `(48,96)`，播放条在右下；Playwright 的真实点击被 video 拦截。房间页面标记仍在，但播放槽位变量已经为空，房间专用 mini CSS 回退到 48/96 并覆盖通用规则。
- 修复：只给该样式规则增加已有槽位变量的存在条件；无槽位时使用原通用小窗定位。不改 Provider、会话、视频或控制事件。
- 证据：`screenshots/final-mini-overlap-before.png`、`screenshots/final-directory-{public,archived,mine}.png`、六张 `room-11-mini-{390,820,1280}-{dark,light}-after.png`。状态：已修复；1440 画面 `(1056,609.5,360,202.5)` 与播放条 `(1056,812,360,64)` 衔接，退出前后同一 video；六种布局对齐且不越界，三个目录标签均实际点通。typecheck 0、67 套/387 项、房间 19/19、目标格式/设计通过。后段使用独立软件渲染 Chrome，普通模式曾有渲染进程崩溃，根因未知。

### ROOM-12 · P2 · 手机滚动标题与主题、头像重叠

- 复现：390 宽，滚动至右侧面板，顶栏进入紧凑状态。
- 预期：“房间”小标题居中，与右侧主题/头像分开。
- 实际：标题占横向 319–353px，主题按钮为 290–334px、头像为 338–382px，互相遮挡。房间顶栏只有两列，通用紧凑标题和账号却都使用第二列。
- 修复：只在房间页面、窄屏、没有专用房间操作的紧凑顶栏中，让短标题跨列居中；不改通用顶栏、字号、动效或布局结构。
- 证据：`screenshots/room-12-mobile-title-before.png`、六张 `room-12-title-{390,820,1280}-{dark,light}-after.png`。状态：已修复；390 深浅均为 182–216px，与 290px 起的账号区分离，平板/桌面布局保留。typecheck 0、67 套/387 项、房间 19/19，目标格式/设计通过；全库格式本次原生退出待最终重查。

### ROOM-13 · P3 · 入房后仍轮询不可见目录

- 复现：两个独立用户进入房间后静置 16 秒，检查网络；各仍请求一次 `/api/rooms?mode=mine`，此时目录不可见。
- 预期：入房期间只维持房间连接；返回目录立即刷新并恢复原 15 秒轮询，手动刷新仍有效。
- 实际：目录 effect 没有房间状态条件，每次响应还会更新隐藏目录状态。
- 修复：按稳定的 room.id 停止/恢复 effect，沿用请求序号防迟到结果；去除创建、退出和删除的冗余刷新，保留恢复房间与手动刷新。
- 证据：`screenshots/room-13-idle-after.png`、`screenshots/room-13-directory-refresh-after.png`。状态：已修复；双人静置 16 秒目录请求 0、WebSocket error 0；真实退出立即 1 次请求，手动刷新再 1 次。新增测试先红后绿，typecheck 0，67 套/388 项与房间 19/19；目标 lint/格式、设计扫描通过。独立只读复核未发现新增 P0/P1/P2，未宣称用 React Profiler 量化重渲染。

### ROOM-14 · P2 · 手机键盘移焦时聊天输入框被底栏遮挡

- 复现：390×520，打开聊天，从选中标签连续按 Tab 到表情和消息输入框；390×844 同样核对。
- 预期：键盘焦点进入输入框时，输入和发送区域可见、可点击。
- 实际：输入框位于 y=475.85–519.85，中心命中固定底栏“房间”链接；获得焦点并不代表可见。真实 Tab 与程序滚动均复现。
- 修复：仅手机房间内聊天控件设置 scroll-margin-bottom，复用既有底栏高度、安全区加 24px；不隐藏底栏、不改定位、发送或会话逻辑。
- 证据：`screenshots/room-14-short-tab-before.png`、`screenshots/room-14-focus-390x520-light-after.png`，另有 390×844/820×1180/1280×800 深浅共八张修后截图。状态：已修复；短视窗输入框移至 y=387.85–431.85，中心命中 input 且仍有焦点；八次均可用，Enter 发送后另一成员真实收到。typecheck 0、67 套/388 项、房间 19/19、运维 4/4、样式格式/设计扫描通过。纯滚动样式以真实键盘和命中测试验证，未写镜像 CSS 的单元测试。

### ROOM-15 · P3 · 海报首选来源返回 HTTP 418（可恢复）

- 复现：冷加载空房间的四张快速开始海报，观察网络与控制台。
- 预期：可用海报正常显示；请求失败有明确回退，记录外部来源的不稳定性。
- 实际：豆瓣原图请求返回 418，浏览器产生 resource error；现有公开备用域随后成功，四张图片 naturalWidth 都为 270，最终未显示破图。强制全部 image 请求失败时，四张均有现有缺失占位。
- 证据：[海报成功](screenshots/final-quick-posters-loaded.png)、[强制失败占位](screenshots/final-posters-forced-failure.png)。
- 状态：**未修，P3 外部依赖观察项**。现有 PublicPoster 及测试明确采用原域优先和公开备用策略；反转来源属于全站策略变化，无法据一次可达性检查判定为正确修复。本轮保留真实错误，不改全局源策略、不伪造海报或吞日志。需人工确认首选来源策略。

### ROOM-16 · P3 · HLS 非致命缓冲事件仍以 error 输出

- 复现：双端播放 Mux 720p HLS，暂停后拖动到约 189.77 秒再继续；另一次重新加载后观察缓冲。
- 预期：恢复性媒体事件有准确可判别的记录，不影响实际同步；控制台零 error 需确实成立。
- 实际：两端曾出现 fatal:false 的 bufferStalledError，另有 bufferSeekOverHole；播放器随后恢复。已有 LegacyPlaybackSurface 对 HLS ERROR 事件统一 console.error，不能据此声称发生未恢复的致命播放故障，也不能声明零 error。
- 证据：[双端 HLS](screenshots/final-hls-host.png)、[拖动后](screenshots/final-hls-seek.png)。主样本日志见下方。
- 状态：**未修，P3**。底层缓冲原因可能包含外部流和网络，尚未定位；调整日志事件分级涉及项目明确禁止修改的 LegacyPlaybackSurface 内部逻辑。未直接屏蔽日志，未修改播放同步阈值或后端。MP4 普通播放的已复验片段无 error，但不能替代本项验收。

### ROOM-17 · P2 · 播放器工具栏无法用 Tab 到达

- 复现：播放普通房间直链 MP4，从“仅自己看”按钮开始连续按 Tab，检查设置、截图、画中画及全屏入口。
- 预期：可见操作入口有可识别的按钮语义，键盘可以到达并操作，焦点可见。
- 实际：可点工具栏是 div/i，role 为空、tabIndex=-1；当时唯一 input 是不可见的 apd-input，可见可聚焦控件为 0。16 次真实 Tab 完全跳过工具栏。现有全局快捷键可控制播放/音量/快进/全屏，但没有设置、截图和画中画操作，不能替代完整键盘可达性。
- 证据：[工具栏](screenshots/toolbar-baseline.png)、[Tab 路径](screenshots/toolbar-keyboard-skipped.png)、[设置](screenshots/toolbar-settings-open.png)。
- 状态：**已确认，因禁区未修复**。生成/控制这些控件的是 LegacyPlaybackSurface 中的 ArtPlayer，控制器接口没有暴露上述所有操作。修复需要控件焦点、角色与键盘事件，超出 [AGENTS.md](AGENTS.md) 的“只允许改 className、样式、文案，逐处说明；不碰内部逻辑”。不从房间外部注入 DOM 属性或代点事件绕过禁区。独立只读复核同意证据足够，未发现约束内完整稳妥的局部修法。

### ROOM-18 · P2 · 普通跨域直链播放正常，截图抛出异常

- 复现：房间选择 MDN flower.mp4，readyState=4 后暂停，点击播放器“截图”。
- 预期：生成可下载图像，或者在读帧不可用时给出准确的能力提示，不抛未处理异常。
- 实际：两次点击均触发 pageerror：Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported；播放器 notice 也是该英文异常，7 秒内没有 download 事件。视频正常解码，当前 crossOrigin=null。HEAD 请求返回 200/ACAO=\*，但这并不证明实际 GET/206 和重定向链支持 CORS。
- 证据：[异常提示](screenshots/toolbar-screenshot-tainted.png)、[点击后页面](screenshots/toolbar-screenshot-dialog.png)。没有生成 toolbar-captured-frame.png，不把 Playwright 截页面当作播放器截图功能成功。
- 状态：**已确认，因禁区未修复**。现有内部实现只对指定私人源启用跨域读帧，普通源会移除 crossOrigin，以保留不支持 CORS 的 CDN 播放兼容性；不能直接对全站加 anonymous。调整初始化/能力判断与降级涉及 LegacyPlaybackSurface 内部逻辑，项目禁止；外部修改属性并重载还会干扰既有播放。没有隐藏截图入口或吞异常来声明已修。独立只读复核确认。
- 机制依据：[媒体 crossOrigin 模式](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/crossOrigin)、[toDataURL 的安全限制](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL)。这些说明支持读帧限制，不能据此推断所有媒体源都应该强制 CORS。

### ROOM-19 · P3 · 播放器高级设置仍有彩色控件

- 复现：房间实际播放 → 显示设置，查看“弹幕热力”开关及底部弹幕图标。
- 预期：沿用 DESIGN.md 的黑白 token，报错红以外不引入彩色强调。
- 实际：截图中高级设置启用开关为蓝色、部分弹幕状态图标为青色；房间本身的导航、聊天和主按钮保持现有黑白风格。未据此推断某一特定源码色值或已定位上游/浏览器原生来源。
- 证据：[高级设置](screenshots/toolbar-settings-open.png)、[播放器底栏](screenshots/toolbar-web-fullscreen.png)。
- 状态：**未修，P3 外观项**。按用户允许保留 P3 的完成条件列入报告；本轮没有遍历高级设置的全部开关状态，没有用一次广泛颜色覆盖代替状态可辨性回归，未重绘播放器菜单。后续可在既有 token 下单独核对局部样式。

## 工具栏补测

在独立 3001 端口复用已清理的测试库，原 3000 服务保持运行；浏览器 1440×900，独立软件渲染 Chrome。只创建补测房间，没有在原库写入测试数据。

| 实际操作               | 结果                                                                     | 证据                                                                        |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 设置 → 倍速 → 恢复正常 | 视频 playbackRate 从 1 到 1.25，再回 1；菜单显示 1.3，显示精度作为待确认 | [设置](screenshots/toolbar-settings-open.png)                               |
| 音量图标静音/恢复      | video.muted=true / false                                                 | 实际状态记录                                                                |
| 画中画开/关            | document.pictureInPictureElement 非空后恢复空                            | [状态](screenshots/toolbar-pip-state.png)，页面截图不捕获系统独立画中画窗口 |
| 网页全屏开/关          | 播放区 (0,0,1440,900)，退出恢复                                          | [网页全屏](screenshots/toolbar-web-fullscreen.png)                          |
| 原生全屏开/关          | document.fullscreenElement 非空后恢复空                                  | [原生全屏](screenshots/toolbar-native-fullscreen.png)                       |
| 水平翻转/正常          | 真实 transform 为 matrix(-1,0,0,1,0,0)，通过正确翻转子菜单恢复 none      | [翻转](screenshots/toolbar-flip-horizontal.png)                             |
| 快捷快进               | 5.055 秒样本被限制到 duration=5.055，提示“快进 1 分 30 秒”               | 实际时间与 notice                                                           |
| 最后一集点下一集       | 仅一集时影片不变、无新反馈；列待确认                                     | [末集](screenshots/toolbar-next-at-last.png)                                |
| 截图                   | 两次失败并有未处理 pageerror                                             | ROOM-18                                                                     |
| Tab 操作               | 跳过可点工具栏                                                           | ROOM-17                                                                     |

测试定位时两次选到了不可见的设置路径，已根据真实可见子菜单纠正，不计为产品缺陷；翻转恢复用正确子菜单并等待实际绘制后确认。补测期间开发服务有 webpack cache incorrect data check 警告，重编译后房间正常 HTTP 200；未删除缓存或修改构建配置，原因未定位。

## 待确认

- 同步房间的“屏幕共享”入口当前访问 screen 路由后被类型守卫退回。本轮仅修其误开首页/多连接副作用；没有擅自把 sync 房间转成 screen 房间。真正转换入口与数据/协议行为需单独确定。
- HLS 连续播放样本的双端差约 1.48 秒，接近 usePlaySync 现有 1.5 秒软校准门限；暂停/拖动后两端均为 19.104677/189.767942 秒。是否需要更紧的日常同步容忍是产品取舍，本轮不修改禁区同步逻辑。
- 顶栏“已连接”表示通信状态，“正在主持”表示当前控制者；成员“可接替主持”表示授权资格，语义不同，未为了文案统一合并这些状态。
- 普通渲染 Chrome、Node 与 PowerShell 曾有无 JS/TS 诊断的原生崩溃。后段使用独立 --disable-gpu Chrome 和现有启动器的 --regexp-interpret-all 继续验证，不能由此认定根因已定位或应用已修复原生崩溃。
- 已补测主要工具栏、画中画和全屏，结果见上表；设置内部所有扩展配置、字幕/弹幕源选择、音量听感、物理手机软键盘及真正 screen 类型房间共享采集仍未完整验收。390×520 是浏览器视窗模拟，不等于真机输入法。
- 单集末尾“下一集”仍可点但没有新反馈，是否应禁用/提示未明确，保守列待确认；倍速菜单将实际 1.25 显示为 1.3，属于现有第三方显示精度，本轮不擅自调整。
- Google 示例长片返回 HTTP 403，已改用实测返回 206 的 W3C 测试 MP4。诱发的失败与重试单独记录，不计为普通主流程通过；项目自己的错误提示确实出现。
- 排除项：窄窗细指针下“浏览片库”为 36px，但真实 `pointer:coarse` 已有 44px，原样符合手机规范；撤回临时增加高度的改动，不计为缺陷。证据：`screenshots/excluded-touch-link-44.png`。创建弹窗本来预填名称，初始可提交符合预期，不能把它当成空名称校验失败。

## 已执行的实际操作

- 两个独立 Chrome 上下文分别登录临时房主、普通成员，实际复制完整房号和邀请 URL 到系统剪贴板，并用复制的地址加入。成员无设置入口，未授权时没有播放按钮；房主可授权、撤销主持资格。成员头像簇可在成员和片单间切换，房间操作菜单方向键、End、Esc 可用。
- 聊天：纯空白发送禁用；输入 2200 字后实际受 2000 字上限约束；按钮、Enter、双方收发和单次表情发送均实测。未读聊天在片单页显示计数，切换读取后消失。表情发送保留文字草稿。真实停服显示“重连中”，发送禁用，重启恢复房间及草稿。
- 选片：影视库真实搜索无结果；视频直链拒绝 `javascript:` 与非 MP4/M3U8 网页。追加片单不改变当前影片，主持从片单开始后两端实际解码 MP4。刷新恢复房间、片单及聊天，主持短暂交接后恢复。
- 播放连续性：从房间进入片库，观察同一个 video 节点时间从 16.14s 增至 19.87s；折叠后仍仅一个 video 且继续到 23.72s；恢复、个人观看、回到一起看均实际点击。此证据证明节点和播放时间连续，不代表人工听音质量验收。
- 顶栏：发现、片库、房间实际跳转；搜索输入后 Enter 到搜索页；主题实际切换。头像菜单、房间弹窗、标签和表情的键盘缺陷逐项见问题记录。
- 基线响应式：1920/1440/1280/1024/820/768/390 各深浅截图；均无文档横向溢出，最小可见文字 12px。1280/1440/1920 舞台与侧栏底边一致；平板/手机按现有设计堆叠。390 另外使用真实浏览器触屏模拟核对 `pointer:coarse` 和命中区，未冒称物理手机测试。

## 最终响应式截图

主截图重拍时明确将 body 和内部滚动容器归零；面板图另外滚动到侧栏，不能拿滚动位置不同的图比较页首。下列尺寸均为浏览器 CSS 像素、100% 缩放，包含用户要求的五个宽度及项目要求的 820/1280。

| 视窗      | 深色                                    | 浅色                                     | 几何结果   |
| --------- | --------------------------------------- | ---------------------------------------- | ---------- |
| 1920×1080 | [截图](screenshots/final-1920-dark.png) | [截图](screenshots/final-1920-light.png) | 无横向溢出 |
| 1440×900  | [截图](screenshots/final-1440-dark.png) | [截图](screenshots/final-1440-light.png) | 无横向溢出 |
| 1280×800  | [截图](screenshots/final-1280-dark.png) | [截图](screenshots/final-1280-light.png) | 无横向溢出 |
| 1024×768  | [截图](screenshots/final-1024-dark.png) | [截图](screenshots/final-1024-light.png) | 无横向溢出 |
| 820×1180  | [截图](screenshots/final-820-dark.png)  | [截图](screenshots/final-820-light.png)  | 无横向溢出 |
| 768×1024  | [截图](screenshots/final-768-dark.png)  | [截图](screenshots/final-768-light.png)  | 无横向溢出 |
| 390×844   | [截图](screenshots/final-390-dark.png)  | [截图](screenshots/final-390-light.png)  | 无横向溢出 |

窄宽滚动面板为 `screenshots/final-{1024,820,768,390}-{dark,light}-panel.png`；390 紧凑标题已与账号区分离。手机聊天文字时间为 12px；最终空态叶子文字最小 13px（1920 使用已有宽屏缩放），未新增小于 12px 的字号。深浅时间文字实际合成对比度分别 7.28:1 / 6.25:1。

## 首屏、媒体、网络与性能边界

- 本机暖开发服务、独立软件渲染 Chrome 的单次样本：TTFB 181.2ms、DOMContentLoaded 259.2ms、load 803.2ms、FCP 356ms、LCP 1236ms（IMG）。这是采样事实，**不是生产性能基线、冷启动统计或真机结论**。
- 四张推荐图片实际 loading=lazy / decoding=async；成功加载与全失败占位分别实测。没有新增依赖、图片源或缓存策略。
- 入房静置 16 秒的目录 GET 从两个上下文各 1 次降为 0；退出立即一次，手动刷新再一次。没有注入 React Profiler，未量化重渲染次数；确认减少了无用 fetch 与隐藏目录 setState。
- MP4：两端 readyState 4，单例视频节点跨页/折叠/退出仍相同；主持交接后成员 t=1.192991、paused=false。HLS：两端 1280×720 解码，暂停/拖动同步，恢复后持续播放。没有用 DOM 数量冒充实际解码。
- 初轮未出现 pageerror 或 WebSocket socketerror；工具栏补测出现两次截图 pageerror（ROOM-18），所以不能再把初轮观察扩展到整个审查。真实停服测试产生连接拒绝和资源失败是负面测试预期，不计为正常流程干净。主流程仍保留 ROOM-15/16 错误；另有 Wake Lock 被浏览器拒绝的 warning。冷 MP4 探测曾真实元数据超时，后续播放成功，超时未被吞掉。
- 代表性保留日志（原始文本摘要，未改控制台分级）：

```text
HLS Error: hlsError {type: mediaError, details: bufferStalledError, fatal: false, ...}
HLS Error: hlsError {type: mediaError, details: bufferSeekOverHole, fatal: false, ...}
Failed to load resource: the server responded with a status of 418 ()
获取视频信息失败: SpeedTestError: 读取视频元数据超时
Wake Lock 请求失败: NotAllowedError: Wake Lock permission request denied
```

## 修改文件、设计依据与提交

| 文件                                             | 本轮最小修改                                                 | 设计依据/约束                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| src/lib/utils.ts                                 | MP4 原生元数据分支；HLS 路径保留                             | 房间 §5.2 加载/错误可识别；不改接口和播放器会话                                |
| src/features/rooms/RoomWorkspace.tsx             | 原生模态焦点、三标签键盘/语义、选片请求竞争、隐藏目录轮询    | §4 聚焦/控件、§5.1 房间结构与最新三标签修订、§5.2 状态；网络竞争属于正确性修复 |
| src/features/rooms/rooms.css                     | 模态容器、44px 命中区、时间对比度、紧凑标题、移焦留白        | §2.1/2.2、§2.5、§4；保持 token、减少动态和无模糊约束                           |
| src/components/UserMenu.tsx                      | 展开状态、Esc/回焦、原生子弹窗取消保留                       | §4 交互与聚焦；保留既有分组和路由                                              |
| src/components/watch-room/ChatFloatingWindow.tsx | 表情关闭/回焦、断线禁用与发送守卫、换房清理                  | §4、§5.2 重连状态；不改事件/接口                                               |
| src/app/watch-room/screen/page.tsx               | 仅 screen 类型启动专用副作用                                 | 两种房间类型现有约束；不改共享协议/存储键                                      |
| src/features/playback/playback.css               | mini 房间样式要求已有槽位变量存在                            | §3.3 小窗连续性；纯选择器，不改 Provider/视频实例                              |
| 五个测试文件                                     | 元数据、房间键盘/竞争/轮询、账号嵌套、聊天离线、共享类型回归 | 没有修改原测试断言来放过失败；沿用测试设施                                     |
| AUDIT.md、docs/design/PROGRESS.md、screenshots/  | 审查/证据和必要交接记录                                      | 项目要求每步更新 PROGRESS；图片共 194 张                                       |

新增/扩展测试文件为 `utils.video-metadata.test.ts`、`RoomWorkspace.accessibility.test.tsx`、`UserMenu.keyboard.test.tsx`、`ChatFloatingWindow.test.tsx`、`screen/page.room-type.test.tsx`。修复前有针对性的失败，再实现；纯 CSS 项使用真实几何、Tab/命中与截图，没有写镜像实现的测试。

| 问题    | 提交    | 修后主截图                                                        |
| ------- | ------- | ----------------------------------------------------------------- |
| ROOM-01 | 3f77cde | [MP4](screenshots/room-01-mp4-after.png)                          |
| ROOM-02 | 55c2822 | [模态](screenshots/room-02-dialog-390-light-after.png)            |
| ROOM-03 | 0031b27 | [触屏](screenshots/room-03-touch-390-after.png)                   |
| ROOM-04 | 40bf177 | [标签](screenshots/room-04-tabs-1280-light-after.png)             |
| ROOM-05 | 62d4701 | [账号](screenshots/room-05-account-390-light-after.png)           |
| ROOM-06 | 77daf5a | [断线](screenshots/room-06-disconnected-after.png)                |
| ROOM-07 | 63a9f8d | [对比度](screenshots/room-07-contrast-390-light-after.png)        |
| ROOM-08 | 84e95cf | [嵌套弹窗](screenshots/room-08-nested-390-light-after.png)        |
| ROOM-09 | 3fe15f0 | [选片](screenshots/room-09-picker-390-light-after.png)            |
| ROOM-10 | 36bcd53 | [类型守卫](screenshots/room-10-screen-guard-1280-light-after.png) |
| ROOM-11 | a5ae7d6 | [小窗](screenshots/room-11-mini-1280-light-after.png)             |
| ROOM-12 | 2e27121 | [标题](screenshots/room-12-title-390-light-after.png)             |
| ROOM-13 | 211e315 | [目录恢复](screenshots/room-13-directory-refresh-after.png)       |
| ROOM-14 | fdc8170 | [短视窗](screenshots/room-14-focus-390x520-light-after.png)       |

本轮只暂存自己的差异，未把原有大量未提交/未跟踪组件一并提交；这些提交的浏览器验收基于**当前完整工作区**，不能由此宣称单独 clean checkout 已验收。原 1027 个非忽略文件逐字节比较，缺失 0、越界修改 0；变化只有上述允许源码及本轮进度区。server、API、两个同步 hook、播放会话、数据库实现、middleware、admin、LegacyPlaybackSurface 本轮均未修改。main 仍为 `c6c78f24926c174aaaa99a35d1af17f5394d06de`，未改远程（原本无 remote），未 push/部署。

## 命令输出与边界

预览在类型和测试期间关闭；本轮最终普通命令结果如下。源文件完成最后一次修改后没有失败断言，没有跳过测试、改检查配置或升级依赖。

```text
$ pnpm typecheck
> tsc --noEmit --incremental false
exit 0

$ pnpm test --runInBand
Test Suites: 67 passed, 67 total
Tests:       388 passed, 388 total
Snapshots:   0 total
Time:        46.331 s
Ran all test suites.
exit 0

$ pnpm test:rooms
ℹ tests 19
ℹ pass 19
ℹ fail 0
ℹ skipped 0
exit 0

$ pnpm test:ops
ℹ tests 4
ℹ pass 4
ℹ fail 0
ℹ skipped 0
exit 0

$ pnpm exec eslint <本轮10个TS/TSX源码与测试文件>
✖ 9 problems (0 errors, 9 warnings)
exit 0

$ pnpm exec prettier --check <AUDIT与本轮12个源码/测试/样式文件>
All matched files use Prettier code style!
exit 0

$ node scripts/check-design.mjs <本轮相关界面源码/样式>
违规 0；TODO 0
exit 0

$ pnpm lint
69 errors / 1054 warnings（逐行统计，与开始时一致）
ELIFECYCLE Command failed with exit code 1.

$ pnpm format:check
[warn] Code style issues found in 233 files. Forgot to run Prettier?
ELIFECYCLE Command failed with exit code 1.
```

- 全库 lint 的 69 条 error 与基线逐行相同；目标 9 条 warning 为 UserMenu 的 5 条与 screen 页的 4 条既有 warning。未运行 --fix 或全库格式化。
- 全库格式中的 230 个原有文件名单与基线相同；另外 3 项为本轮 CLI YAML 和 build 生成的 sw.js/workbox 文件，删除被审批阻止。基线首次 232 项包含当时未格式化的 AUDIT 和 CLI YAML；本轮 AUDIT 已通过格式检查。不能把全库结果写成通过。
- 中途 typecheck/Jest/格式命令曾有原生崩溃（含 3221225477），没有 TS 诊断或失败断言。按要求停预览后串行重跑，部分使用本机已有 Node 24.19.0 或启动器既有 regexp 解释选项；最终上述普通 typecheck/Jest 均退出 0。根因未知；若用户终端再次崩溃，应保留原始输出，不能归因到已定位的源码问题。

### 构建的三种尝试（均未通过）

```text
1. pnpm build（系统 Node 24.18.0）
Next.js build worker exited with code: 3221225477 and signal: null
ELIFECYCLE Command failed with exit code 3221225477.

2. 同一 pnpm build（进程 PATH 使用本机已有 Node 24.19.0）
Compiled successfully
Checking validity of types ...
Generating static pages (283/283)
Build error occurred
Error: EPERM: operation not permitted, symlink ... @next/env ... .next/standalone/...
ELIFECYCLE Command failed with exit code 1.

3. 同一构建命令，进程临时 NODE_OPTIONS=--jitless
unhandledRejection ReferenceError: WebAssembly is not defined
ELIFECYCLE Command failed with exit code 1.
```

第二种已完成编译、类型与 283 页生成，但 Windows standalone 打包需要的链接创建被拒绝；第一种原生崩溃根因未知，第三种关闭 JIT 会破坏 Next 依赖的 WebAssembly，不能采用。按用户三种方案上限停止重试，没有改 next.config、tsconfig、锁文件、系统权限或构建目标来制造通过。三次尝试早于最后的局部修复，**最终版本没有获得一次成功 build**；最后源码另已通过类型和全部测试。已有 serverExternalPackages 配置 warning、旧 Browserslist 和 PWA 大块 warning 均未顺带修改。

<details>
<summary>全库 lint 的 69 条原有 error（不包含 1054 条 warning）</summary>

```text
./src/app/api/ai/chat/route.ts 94:16  Error: Unexpected constant condition.  no-constant-condition
./src/app/api/detail/route.ts 141:14  Error: Unexpected constant condition.  no-constant-condition
./src/app/api/emby/play/[token]/[filename]/route.ts 190:16  Error: Unexpected constant condition.  no-constant-condition
./src/app/api/live/epg/download/route.ts 40:14  Error: Unexpected constant condition.  no-constant-condition
./src/app/api/music/route.ts 263:29  Error: Do not access Object.prototype method 'hasOwnProperty' from target object.  no-prototype-builtins
./src/app/api/openlist/cms-proxy/[token]/route.ts 296:10  Error: Unexpected constant condition.  no-constant-condition
./src/app/api/openlist/play/route.ts 186:42  Error: Unexpected empty arrow function.  @typescript-eslint/no-empty-function
./src/app/api/tv-remote/devices/route.ts 6:33  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/app/api/tv-remote/key/route.ts 7:33  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/app/api/tv-remote/text/route.ts 7:33  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/anime-fansub-recognize.ts 70:17  Error: Unnecessary escape character: \[.  no-useless-escape
./src/lib/db.ts 46:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 46:32  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 49:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 49:39  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 57:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 57:34  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 64:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 66:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 66:29  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 73:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 75:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 75:35  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 82:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 84:7  Error: Unexpected lexical declaration in case block.  no-case-declarations
./src/lib/db.ts 84:45  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 98:31  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 112:28  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 135:50  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 155:19  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 179:20  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/db.ts 180:16  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/douban-anti-crawler.ts 54:10  Error: Unexpected constant condition.  no-constant-condition
./src/lib/emby-manager.ts 34:25  Error: Unexpected empty constructor.  @typescript-eslint/no-empty-function
./src/lib/legado.client.ts 1206:15  Error: Unnecessary escape character: \-.  no-useless-escape
./src/lib/legado.client.ts 1206:53  Error: Unnecessary escape character: \-.  no-useless-escape
./src/lib/legado.client.ts 1797:13  Error: Empty block statement.  no-empty
./src/lib/legado.client.ts 1810:11  Error: Empty block statement.  no-empty
./src/lib/login-fail2ban.ts 93:51  Error: Unnecessary escape character: \".  no-useless-escape
./src/lib/magnet-health.ts 177:6  Error: Unexpected control character(s) in regular expression: \x00, \x08, \x0b, \x0c, \x0e, \x1f.  no-control-regex
./src/lib/opds.client.ts 74:14  Error: Unexpected control character(s) in regular expression: \x00, \x08, \x0b, \x0c, \x0e, \x1f.  no-control-regex
./src/lib/openlist-path-meta.ts 50:16  Error: Irregular whitespace not allowed.  no-irregular-whitespace
./src/lib/openlist-path-meta.ts 51:15  Error: Irregular whitespace not allowed.  no-irregular-whitespace
./src/lib/openlist-path-meta.ts 53:16  Error: Irregular whitespace not allowed.  no-irregular-whitespace
./src/lib/openlist-path-meta.ts 53:19  Error: Irregular whitespace not allowed.  no-irregular-whitespace
./src/lib/openlist-refresh.ts 190:10  Error: Unexpected constant condition.  no-constant-condition
./src/lib/pancheck/vendor/checkers/aliyun.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/baidu.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/baidu.ts 20:15  Error: Empty block statement.  no-empty
./src/lib/pancheck/vendor/checkers/baidu.ts 117:15  Error: Empty block statement.  no-empty
./src/lib/pancheck/vendor/checkers/cmcc.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/http.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/pan115.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/pan123.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/pan123.ts 61:15  Error: Empty block statement.  no-empty
./src/lib/pancheck/vendor/checkers/quark.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/tianyi.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/uc.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/xunlei.ts 1:1  Error: Do not use "@ts-nocheck" because it alters compilation errors.  @typescript-eslint/ban-ts-comment
./src/lib/pancheck/vendor/checkers/xunlei.ts 102:15  Error: Empty block statement.  no-empty
./src/lib/pancheck/vendor/checkers/xunlei.ts 115:17  Error: Empty block statement.  no-empty
./src/lib/pancheck/vendor/http.js 1:15  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/pancheck/vendor/http.js 2:14  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/pancheck/vendor/http.js 3:17  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/special-sources-detail.ts 186:10  Error: Unexpected constant condition.  no-constant-condition
./src/lib/turso-adapter.ts 26:15  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/lib/video-parser.ts 68:40  Error: Unnecessary escape character: \[.  no-useless-escape
./src/test/node-web-environment.cjs 3:27  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
./src/test/node-web-environment.cjs 9:23  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
```

</details>

## 完成条件逐项对照

| 用户条件                                  | 当前证据                                                                          | 结论                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. 每个维度至少检查一次，AUDIT 有记录     | 上方验收矩阵、194 张实际截图、双端交互/网络/媒体记录                              | 维度已覆盖；深层扩展配置未遍历全部，不能承诺任意第三方控件都已穷尽 |
| 2. P0/P1 修复，P2 能修都修，P3/待确认列出 | 未发现 P0/P1，14 项修复已验证；两项 P2 位于明确禁区，三项 P3 保留                 | 不能把两项 P2 写为已修；继续修复需先解决现有禁区约束               |
| 3. build/lint/已有测试全部通过并贴输出    | tests/typecheck/rooms/ops 通过；build 三种失败、lint 69 旧 error、format 233 文件 | 未满足，未更改检查口径或修无关禁区文件                             |
| 4. 主流程控制台无 error                   | MP4 部分流程曾为 0；海报/HLS 错误保留，截图两次 pageerror                         | 未满足                                                             |
| 5. 清理临时文件/数据，仅保留指定产物      | 三个测试房间、两个新账号、补测播放记录正常删除；专用进程关闭；文件删除三次被拒绝  | 未满足，四个生成物和临时目录仍在；另按项目要求保留 PROGRESS        |
| 6. AUDIT 顶部总结数量、原因、人工事项     | 已实际读回顶部并核对 19 个编号和证据链接                                          | 已完成                                                             |

本次续查仅补充文档和截图，没有源码修改，因此没有再次重复全套代码测试。已重查文档格式、实际链接、数据删除与服务状态；保留前一轮对应最终源码的完整命令输出。以上未满足项没有以报告替代功能修复或验收通过。

## 测试数据、进程与文件清理

- 测试仅在在线备份的临时 SQLite 中进行，原数据路径和配置未修改。房间 `E0847AA0376F`、`46410E367037` 均通过房主设置中的精确名称确认删除；我的/公开/归档三个目录查询残留都是 0。成员实际收到删除后返回目录。错名时删除禁用、正确名启用分别有截图：[错名](screenshots/final-delete-wrong-name.png)、[正确名](screenshots/final-delete-correct-name.png)、[清理结果](screenshots/final-test-rooms-cleaned.png)。
- 补测房间 `8F5A9FFAEDFB` 同样通过正确名称删除，我的/公开/归档残留均 0：[补测清理](screenshots/toolbar-test-room-cleaned.png)。补测使用临时库内既有站长副本登录，正常 logout 为 HTTP 200，没有新建或删除该账号；独立浏览器已关闭，服务 PID 50908 已停。额外只读核对发现一条本轮影片播放记录，临时服务 40296 通过带唯一 key 的 DELETE /api/playrecords 精确删除（HTTP 200），随后 API 和只读 SQLite 均确认该标题残留 0；没有调用无 key 的清空接口。正常 logout 后 40296 已停，3001 已释放。原服务 34528 的房间页仍 HTTP 200、health ok。
- 临时账号 `audit-host-20261021`、`audit-member-20261021` 通过正常管理接口删除，均 HTTP 200。没有清空数据库、批量删除用户或触碰原库账号。
- 独立 Playwright 上下文/浏览器和 CLI room-host 会话已关闭；最后测试服务 PID 42224 已退出。原服务此前由启动器 41888、服务 34528 恢复；内置浏览器补测已确认其预览异常并沿 `scripts/start-local.cjs --no-browser` 重启，当前启动器 37596、服务 54656，房间页正常、health ready 为 ok。未关闭用户原有浏览器或其他项目进程。
- **未完成的文件清理：** 自动审批三次拒绝删除命令，工具仅返回 blocked by policy，未给出具体原因。工作区先尝试带路径校验的批量方式，再尝试精确绝对路径逐文件删除；报告提交后，对已核实的外部临时目录单独请求删除也被拒绝。三次均未执行，不再绕过拒绝。工作区残留以下四个本轮生成物，未提交：

```text
C:\Users\ss\Documents\桌面图标\编程\ai项目\TongMuTVPlus\.playwright-cli\page-2026-10-21T18-03-40-510Z.yml
C:\Users\ss\Documents\桌面图标\编程\ai项目\TongMuTVPlus\.playwright-cli\console-2026-10-21T18-03-39-105Z.log
C:\Users\ss\Documents\桌面图标\编程\ai项目\TongMuTVPlus\public\sw.js
C:\Users\ss\Documents\桌面图标\编程\ai项目\TongMuTVPlus\public\workbox-e9849328.js
```

- 外部本轮临时目录 `C:\Users\ss\AppData\Local\Temp\TongMu-room-audit-20261021` 仍保留，仅含本轮基线 .bak、日志、测试库副本和两个临时账号的浏览器状态。原用户库和既有 output 备份不在清理范围。因清理审批未解决，不能宣称“只剩代码/AUDIT/screenshots”。
- 按项目要求保留本轮 PROGRESS 交接区；output 未发现 .ts/.tsx/.d.ts 备份。除上述审批阻止的生成物外，没有额外调试输出；未新增依赖。

实现参考：[原生媒体元数据事件](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event)、[WAI 模态弹窗键盘规范](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)、[WAI 标签页键盘规范](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)。
