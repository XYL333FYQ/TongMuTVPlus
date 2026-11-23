# 界面改造进度

更早的记录在 git 历史里（`git log -p -- docs/design/PROGRESS.md`），第二阶段计划见 `docs/plan/2026-11-23-phase2-shared-parts-plan.md`（已执行完）；下一步是第三阶段（弹窗试点），计划见 `docs/plan/2026-11-23-phase3-popup-pilot-plan.md`（2026-11-23 用户批准；做完后按计划末尾清单逐项接着做，不再单独写计划）。

## 当前状态

- **一起看（房间）**：按 SyncTV 模型重做完成（权限按账号、单一带版本的播放状态、服务器时钟推算）；房主刚播放就暂停、拖动后操作偶尔丢失的问题已修（2026-11-20）。
- **自己看**：播放器换成内核 `WatchPlayer`，接上全站播放会话，旧的 `LegacyPlaybackSurface` 已删（2026-11-21）。
- **代码规范两轮**：第一轮把房间、发现、片库、影片卡片、播放代码归位；第二轮待清理名单 101 → 0，播放页、影片卡片拆出几块（2026-11-22）。
- **依赖安全警报**：Next.js 升到 15.5.29，`next-pwa` 只在构建时加载，生产镜像里不再有它（2026-11-22）。
- **立规矩第零、第一阶段**：“一件事只有一个来源”变成机器检查，旧账登记、只许减少（2026-11-22，已推送 `f3e5a4e`、GitHub 检查和镜像构建通过、用户已部署到 VPS，线上没有问题）。第二阶段计划已写好（`docs/plan/2026-11-23-phase2-shared-parts-plan.md`：时间格式、设置读写、服务器权限、公共弹窗层），2026-11-23 用户批准（P2-D1 保留 `Unauthorized`、设计稿先做、分两次部署），在新会话里执行。
- **第二阶段（公共零件）**：时间格式、设置读写、服务器权限、公共弹窗层各只有一个主人（2026-11-23）。Task 1–2 已推送 `fbe0725`、用户已部署、线上没有问题；Task 3 权限、审查修正、Task 4 弹窗层第二次推送到 `5b5d449`；GitHub 上单元测试失败一次（`web-live/route.test.ts` 没固定存储类型，靠本机 `.env`，CI 默认本地存储模式时 `requireRole` 拒绝了测试里的管理员），用户同意后测试里加了一行存储类型，`dd40ade` 重新推送，GitHub 检查和 amd64 / arm64 镜像构建通过。以后跑测试要再用不带 `.env` 存储类型的环境跑一遍（`NEXT_PUBLIC_STORAGE_TYPE=localstorage pnpm test`）。

## 没验证 / 没做的

- **真机**：手机、平板、iPhone / Safari、电视 App、电脑客户端都没有按现在的代码分端手动验收。
- **大文件**：37 个核心文件超过 400 行（S6，只提醒）。
- **手机端“我的”页面**：历史卡片是直角，原因未查。
- **播放页**：剩下的换源、换集、快捷键、保存进度、页面结构和播放器回调共用十几个 ref，再拆要先把页面状态收成一处。
- **房间**：真实手机切后台、多台设备同账号、HLS 片源下的跳转落点没测。
- **自己看**：实际弹幕加载 / 选源 / 上传、热力图画面、超分画面、ASS / PGS 字幕渲染、本地字幕上传、HLS 片源、鸿蒙和网盘原生 HLS 切换、链接续期（小雅 / OpenList）、Wake Lock 都没有可用的测试片源或环境验证。
- **平板**：600–767px 平板档的声音提示位置没验证（快照窗口里没有这个宽度）。
- **第二阶段**：改前改后计算样式快照没能当证明（两次之间测试站数据变了，见下面的记录）；离线下载开着时的权限只有单元测试；弹窗层新款式还没有调用方（第三阶段试点），只看了设计稿和默认款式。

## 最近的记录

### 2026-11-23 第二阶段：公共零件（执行 `docs/plan/2026-11-23-phase2-shared-parts-plan.md`）

- **时间格式**（`9cfc9f4`）：时长格式只在 `src/lib/time.ts`（`formatClock` / `formatPaddedClock` / `formatDuration`），播放器插件、播放页、影片卡片、音乐、读书、电视页都改用它；播放页不再把 `formatTime` 当参数层层传。看得见的变化：P2-D3 三处（影片卡片“已看 3 分 0 秒”→“3 分钟”、超过一小时的歌 `1:01:40`、跳过设置时间舍去），另有音乐列表和读书朗读超过一小时 `61:40` → `01:01:40`。
- **设置读写**（`fbe0725`）：`src/lib/settings.ts` 登记全部本地键（键名、存法不变，带变量的键按前缀登记），核心 26 个文件不再直接碰浏览器存储（84 → 0）；云同步白名单由登记里 `sync: true` 的键生成，内容和顺序不变；`src/hooks/useSetting.ts` 已就绪但还没有调用方。
- **服务器权限**（`c23f80b`…`325d36f`、`53bafe3`）：`src/lib/require-role.ts` 的 `requireRole` 是唯一的角色检查，角色每次按用户表（站长 = 环境变量 `USERNAME`），不信 Cookie。约 70 个接口换过去；`auth-behaviour.test.ts` 对每个接口 × 五种来访者拍了“现在的行为”快照，换完状态码只有用户批准的两类变化（没登录 403 → 401 Unauthorized 的 9 个处理函数；先校验后查权限的接口，成员带坏参数 400 → 401 的 8 个处理函数），报错文字按 P2-D1 统一。没登录照旧 `Unauthorized`（前端靠它续登录）；顺带修掉一个旧问题：视频源脚本接口原来用 `Unauthorized` 拒绝已登录的成员，前端会把成员登出。管理员在只限站长的操作上看到的文字从“只有站长可以……”变成“没有权限”。用户表里写着 owner 但名字不是 `USERNAME` 的账号、只在配置文件里还没迁到用户表的管理员，会失去管理权限（P2-D2）。
- **公共弹窗层**（`51309eb`）：设计稿 `docs/design/prototypes/modal-layer.html` 用户同意后，`ModalLayer` 加 `variant`（dialog 默认样子不变、sheet、drawer、confirm、viewer），打开时用 `src/lib/scroll-lock.ts` 锁滚动（引用计数，叠两层时关上层不解锁）。还没有调用方换款式（第三阶段）；`tm-drawer-layer`、`tm-download-modal-layer` 是旧的同类写法，第三阶段并入。
- **独立审查**（Opus 5.5；Fable 没有额度）：没有严重问题。修了两条：音乐 3 个接口残留的手写封禁检查、反馈接口“看全部”先读后查权限。留给以后：`src/lib/permissions.ts` 还有第二套“谁有特权”的规则；账号菜单、设置面板、云同步拉取仍直接写浏览器存储（`useSetting` 推广前要先迁）；几个管理接口先解析请求内容再查权限（没登录又带坏数据得到 500）。
- **各零件旧账（核心 / 常用上游 / 上游）**：时间格式 17 → 6（6→0 / 2 / 4）；浏览器存储 361 → 277（84→0 / 159 / 118）；服务器权限新登记 148 → 115（13 / 14 / 88，剩下的是界面按角色显示菜单、导出数据里的角色字段、续登录协议 `auth/refresh`）；滚动锁新登记 25（6 / 15 / 4）；弹窗层 68、设备档位 72、播放器 9、提示 9、加载 133、图标 123 不变。待清理名单 638 → 627（含两个新类别），代码警告 1153 → 1151。
- **验证**（Node 24，最后一次修改之后）：typecheck、lint（0 错误）、check:lint、check:structure、check:design（0）、format 通过；Jest 194 组 / 1317 条（起点 185 / 1202）、test:rooms 42、test:ops 4、检查脚本 27；端到端自己看 5/5、两个账号同步 12/12（Task 2、Task 3 后各跑一次）。无头浏览器检查大厅“创建房间”弹窗：手机竖屏和电脑都在打开时锁住、关闭后恢复并回到原滚动位置，样子不变。分端截图（首页、片库、播放页、房间页、管理后台 × 手机竖屏 / 横屏 / 平板 / 电脑 × 深浅 = 40 张）：档位、主题正确，没有横向滚动；首页开发模式的“1 Issue”是原有的“即将上映取不到”（测试站没配 TMDB 密钥），和本次无关。
- **样式快照**：改前（Task 0）和改后（Task 3 完）比出 2.3 万处差异，逐类核对都是测试站数据变了（同步测试留下的聊天、推荐片单、房间小窗状态、工具面板点开的时机），同一份代码连拍两次也有同类差异；试过在临时工作区起改前代码的第二个测试站做同数据对比，Next 开发模式在目录联接下编译不起来，已撤掉。代码层面：第二阶段没有改任何样式文件（弹窗层只新增款式类名），组件只改了显示的时间文字，没有改类名或结构。
- **没验证**：真机；离线下载开着时的真实页面；弹窗层新款式的真实调用（第三阶段）。

### 2026-11-23 播放器两处白色换成令牌

- `WatchPlayer.ts` 的字幕颜色和控制条主题色原来写死 `#fff`：主题色写的是 `var(--tm-player-accent, #fff)`，但 `--tm-player-accent` 从没定义过，房间播放器一直用的是后备白色；自己看则在 `load-player.ts` 里另传了 `var(--tm-room-player-text)`。现在两处都默认用已有的“画面上的文字色”令牌 `--tm-room-player-text`（= `--tm-on-art`，深浅两种主题都是白色），自己看不再另传，两个播放器只有一个来源。没有新增令牌。
- 验证：测试站上自己看和房间、深浅两种主题，改前改后控制条已播放部分的颜色都是 `rgb(255, 255, 255)`，只有房间的 `--art-theme` 从 `#fff` 变成经由令牌算出的同一个白色。新增单元测试（默认主题色和字幕色是令牌、不是 hex），改前跑会失败、改后通过。设计检查核心范围违规 0、TODO 0。字幕的实际画面没看（测试片没有字幕），按 Artplayer 把 `subtitle.style` 写成行内样式的实现，`var()` 能生效。

### 2026-11-22 立规矩第零、第一阶段（执行 `docs/plan/2026-11-22-rules-first-plan.md`，D1–D6 用默认值）

- **新增的检查**（界面和行为不变，`src/` 只多了两条注释）：
  - 检查范围只有一个来源 `scripts/structure-scope.json`，分三档（核心 / 常用上游 / 上游），结构检查、设计检查、`.eslintrc.js` 都从它读。
  - 待清理名单改成“键 × 数量”的计数棘轮（`scripts/lib/ratchet.mjs`）：只许减少；新类别只能用 `--baseline` 生成一次；改名会提示。
  - 公共零件登记表（STANDARD.md）+ 8 种原材料探测器：主人以外直接用原材料的地方都记成旧账。`feedback/`、`ui/` 里的文件必须登记。
  - 行内跳过检查注释（`eslintDisableInline`）、核心样式里不在豁免场合的 `!important`（`important`，S5 按 D6 改写）也进棘轮。
  - 代码警告基线 `pnpm check:lint`：1153 条警告按 文件 × 规则 记成 362 条，只许减少。
  - 设计检查 `pnpm check:design` 扫整个核心；`em` 不再判断（原来唯一的“违规” `shell.css` 0.68em 是误报）。
  - 三份规范文件（AGENTS.md、docs/README.md、STANDARD.md）里写的路径必须存在。
  - 提交钩子 `scripts/git-hooks/pre-commit`（本机已启用，Node 24 约 2 秒）；GitHub 检查加上三步和不拦截的“规则改动报告”。
  - 端到端脚本搬进 `scripts/e2e/`（账号仍只在被忽略的 `.claude/test.env`），共用的环境和测试片在 `test-env.mjs`。
- **各零件旧账（主人以外直接用原材料的次数，核心 / 常用上游 / 上游）**：弹窗层 `portal` 68（3 / 32 / 33）；浏览器存储 `storage` 361（84 / 159 / 118）；设备档位 `screen` 72（28 / 8 / 36）；播放器 `player` 9（0 / 1 / 8）；时间格式 `timeFormat` 17（6 / 2 / 9）；提示 `toast` 9（2 / 3 / 4）；加载 `spinner` 133（19 / 67 / 47）；图标 `emoji` 123（50 / 19 / 54）。另：行内跳过检查 68 处 / 52 个文件，非豁免 `!important` 40 处 / 8 个文件。
- **设计检查发现计划没预料到的两处**：`src/features/player/core/WatchPlayer.ts` 字幕颜色、控制条主题色写死 `#fff`。改颜色要补令牌（界面决定），先按项目已有的写法标 `TODO-P5`（只加注释），等用户定。
- **验证**（Node 24，最后一次修改之后）：typecheck、lint（0 错误）、check:lint、check:structure、check:design（违规 0，TODO 2）、format、Jest 185 套 / 1201 条、test:rooms 42、test:ops 4、检查脚本测试 35 全过。端到端：原测试房间已归档，重新 seed 后自己看 5 / 5；两个账号同步第一次 10 / 12（“连着拖到 60、90 秒”那步房主停在 120 秒），之后连跑三次（含旧脚本一次）都 12 / 12，没能复现。
- **推送和部署**：推送 `c11617b..f3e5a4e` 后，GitHub 的检查（含新加的四步；规则改动报告这一步跑通了，摘要内容没在网页上看）、amd64 / arm64 镜像构建全部通过；用户在 VPS 上拉新镜像部署，确认线上没有问题。
- **没验证**：真机没测。

### 2026-11-22 依赖安全警报：升级 Next.js 15.5.29，next-pwa 只在构建时加载

- GitHub 依赖安全警报开着后第一次扫描报 120 条。按包归类：真正跑在线上的只有 Next.js 自身 3 条中危（图片优化处理 SVG、Edge 路由泄露 cookie、原样转发上游响应时可能串号）。本站关了图片优化、没有 Edge 路由、中间件不设 cookie，第三条只在反向代理开了请求管线化时才会触发；补丁版本一起修掉，升到 15.5.29（`eslint-config-next` 同步）。
- 约 70 条来自 `next-pwa` 带进来的构建工具（babel、rollup、workbox、lodash、serialize-javascript、minimatch 等）。它只在构建时生成 `public/sw.js`，但原来放在运行时依赖里，生产镜像也装着它；`server.js` 启动时读 `next.config.js` 会加载它，所以不能直接挪走。现在 `next.config.js` 只在构建阶段（`PHASE_PRODUCTION_BUILD`）加载 `next-pwa`，它挪到开发依赖，生产镜像里不再有它和它带进来的那些包。
- 其余：开发 / 构建工具里的约 45 条（undici、js-yaml、svgo、sharp 等）不进镜像，不动；zod 的 2 条要求“不限长度的数组”，本站只在站长填的版本公告里用 zod，数组都限了长度，不受影响，不为此升大版本；glib 那条在电脑客户端的 Linux 构建里，Windows 版不用。
- 验证：本机生产构建（Node 24）编译通过、`public/sw.js` 照常生成（Windows 上复制 standalone 时的 EPERM 是已知问题，Docker 里没有）；把 `node_modules/next-pwa` 藏起来后用生产模式启动 `server.js`：健康检查 200，登录页、样式文件、`sw.js` 都是 200。typecheck、lint、format、check:structure、`pwa-options` 测试通过；Jest 185 套 / 1201 条、test:rooms 42 / 42；首页、片库、房间、播放页在 6 种窗口 × 深浅色下和升级前的快照对比，除了图片淡入、入场动画、播放器提示 / 控制条自动隐藏的时机，没有差异；自己看行为测试 5 项、两个账号房间测试 12 项全过。

### 2026-11-22 代码规范第二轮：待清理名单清零，播放页、影片卡片拆出几块

- **待清理名单 101 → 0**（`scripts/structure-allowlist.json` 全空），界面和行为不变：
  - 层级（12）：数字全部换成令牌。新增 4 个令牌，值沿用原来的数字（`--tm-z-page-float` 60、`--tm-z-docked` 85、`--tm-z-page-notice` 100、`--tm-z-page-error` 110，见 STANDARD.md 层级表）；组件内部的 `z-10`、首页海报悬停的 5 改成 3（同一层叠上下文里没有更高的兄弟，前后顺序不变）。
  - 重复选择器（62）：每个选择器在一个文件里只写一处。分组规则拆开并进各自规则；被后面覆盖的值直接写成最终值（例：手机上详情标题 18px 被 16px 覆盖，只留 16px）；`shell.css` 里两段减少动态的页面过渡，前一段完全被后一段的 `!important` 覆盖，删掉前一段。手机 / 平板的选集面板和工具面板共用的底部面板样式改挂在新类 `tm-solo-sheet` 上（两个元素都加了这个类）。
  - 块名归属（17）：规则搬回样式所属的文件，或给元素加自己块的类名——首页大图按钮 `tm-home-hero-action(-glass)`、首页区块 / 片架 / 区块标题 `tm-home-section(-header/-title/-link)`、`tm-home-grid`（`SectionHeader` 新增 `variant='home'`）、安装提示和“更多”说明里的按钮；主题按钮在顶栏 / 手机账户区的尺寸归 `primitives.css`；主题分段选择归 `controls.css`；自己看小窗里宿主的规则从 `mini-player.css` 搬到 `playback.css`；自己看让出底栏的两条搬到 `shell.css`；影片详情的氛围背景搬到 `detail.css`；放在模态层里的弹窗高度归 `feedback.css`；音乐页的两条归 `app/music/music.css`（登记 `tm-music` 块）。
  - 整文件 `eslint-disable`（10）：都是为了写 `any`。`.eslintrc.js` 原来对 `any` 只警告，现在核心范围内按错误报（S8）。第三方类型补在两处：`features/player/core/art-types.ts`（Artplayer 实例补上运行时代理的 `paused` 等、弹幕 / jassub 插件、hls.js）、`src/types/vendor-dom.d.ts`（Safari 全屏、iOS 主屏模式、文件夹权限）。
- **顺带查出的隐藏问题**：`Art`（播放器实例的类型）原来就是 `any`，播放页 17 个文件把它当万能类型用（文档、窗口、TMDB 数据、文件夹句柄都写成 `as Art`），98 处没有类型检查。全部换成真实类型：TMDB 详情有了 `TmdbPlayDetails`，弹幕插件的边距 / 模式按插件的真实类型。两处行为上的细微差别：延迟 0.5 秒的“上次播放到”检查，若这期间换集重建了播放器就交给新实例；弹幕插件里如果字号被设成百分比就不记（本站只设数字）。
- **拆文件**：
  - 播放页 `surface/PlaybackSurface.tsx` 2,790 → 2,300 行。拆出的 hook 都在原来那段代码的位置调用，state 和 effect 的先后不变：`usePlayerPreferences`（跳过片头片尾、快进步长、去广告、弹幕热力图）、`useEpisodeNames`（弹幕 / TMDB 分集名）、`useFavorite`、`useFilterConfigs`、`useNetdiskTmdbMerge`、`usePlaybackFeatureFlags`。删掉死代码：没人读的原生全屏监听、没人调的 `parseSourceForApi`。
  - 影片卡片 `VideoCard.tsx` 1,624 → 1,400 行：各页面显示什么（`video-card/card-config.ts`）、长按菜单（`video-card/mobile-actions.tsx`）。
  - 结构检查范围去掉已不存在的 `components/BannerCarousel.tsx`，加上 `components/video-card/`。
- **没拆完的**：播放页剩下的部分（换源、换集、快捷键、保存进度、页面结构）和播放器回调共用十几个 ref，再拆要先把页面状态收成一处（例如一个页面级 store），不是搬代码能解决的，要单独设计、真机测；影片卡片剩下的是 450 行的海报区 JSX，引用三十来个变量。超过 400 行的核心文件还有 37 个（只提醒）。
- **验证**：typecheck、lint（0 错误）、format:check、check:structure 通过；Jest 185 套 / 1201 条全过；test:rooms 42 / 42（用 Node 24）。改前改后计算样式对比（17 页 × 6 种窗口 × 深浅色 = 204 份）：除了图片加载淡入、入场动画、小窗记住的拖动位置、测试站推荐内容这些两次之间本来就会变的，没有样式差异；平板横屏深色那一份改前没点开工具面板，同尺寸浅色那一份点开了且一致。自己看行为测试 5 项全过（播放、离开播放页同一个视频元素进小窗接着播、回来恢复）；两个账号房间测试 2 轮各 12 项全过。
- **没验证**：真机（手机、平板、iOS、电脑客户端）。check-design 报的 `shell.css` `.tm-launch-wordmark small` 0.68em 是原有的，实际约 16px。

### 2026-11-20 房间同步：房主刚播放就暂停、或拖动后，操作偶尔没传到房间（修复）

- 现象（第 2 步 B 实测时看到）：房主播放后约 3 秒暂停，或拖进度，偶尔不生效——房主自己的画面被拉回（又播起来 / 跳回原位），成员也没跟。
- 根因有两处，都在“分辨本机播放器事件是引擎自己做的还是用户做的”：
  1. `src/features/room/sync/sync-engine.ts` 旧的 `expect()` / `consume()`（原 589–604 行）：引擎每替房间暂停 / 播放 / 跳转 / 变速一次，就给这类事件记“2.5 秒内还会来一个”，下一次同类事件直接当回声吞掉。但引擎的事件不一定来：跳转被下一次跳转打断只有一个 `seeked`；房间等缓冲暂停后 0.3 秒内又继续时，`player/port.ts` 的暂停确认（排除切后台用的 0.3 秒延迟）把这次 pause 丢掉。多出来的预期就把用户 2.5 秒内真实的暂停 / 拖动当成回声，`onPause` / `onSeeked` 不发命令，下一次纠偏按房间旧状态把房主拉回。反过来，弱网下引擎跳转超过 2.5 秒才完成，又会把自己的跳转当用户拖动发给房间。成员网速慢、房间反复“等缓冲”暂停 / 继续时最容易撞上——外网测试视频卡顿正是这个条件。
  2. 同一个 0.3 秒暂停确认：用户按了暂停、确认还没完成时，引擎每秒一次的纠偏看到“房间在播、本机停着”，就把视频重新播起来；确认到期时视频已不在暂停，暂停被丢掉。
- 修法（不改 SyncTV 模型，不恢复主持设备 / 个人观看）：
  - 引擎去掉按时间窗口计数，改为按状态判断：记住它让播放器变成的样子（`desired`：该播 / 该停、倍速、最近一次跳转目标）。事件和它一致是回声，不一致是用户操作；用户操作后 `desired` 跟着改。`seeked` 按位置判断：离引擎跳转目标 0.5 秒内，或离房间应在位置在纠偏阈值（播放 1.2 秒 / 暂停 0.3 秒）内，不发。
  - `PlayerPort` 新增 `pauseUnconfirmed`（`player/port.ts` 在 0.3 秒确认期间为真）：确认期间引擎不替房间把视频播起来；引擎自己做的暂停不受影响（房间继续了马上继续）。
  - `docs/architecture.md` 同步模型一节改写了“回声抵消”的说明。
- 测试：`sync-engine.test.ts` 新增 8 条（被打断的对齐跳转后用户拖动送出、等缓冲暂停 / 继续后用户暂停送出且不被拉回、迟到的对齐 `seeked` 不发、追赶变速迟到的 `ratechange` 不发、用户改倍速送出、播放后马上暂停送出、确认中的暂停不被播起来、引擎自己的暂停确认中照样能继续），其中 4 条在旧代码上失败；原“发送拖动”用例不再需要先等 5 秒躲开窗口。
- 两个账号实测（`.claude/sync-test.mjs`，git 忽略）改了三处：① 默认用本机生成的 200 秒 WAV（`.claude/test-media/`，脚本起一个支持 Range 的小服务器，开始前房主把房间影片换成它），外网视频卡在 0 秒、被播放器重连拉回 0 秒的噪音没了；`SYNC_TEST_MEDIA=remote` 用回外网视频。② `SYNC_TEST_SLOW=1` 画面就绪后把成员网速压到每秒 9 KB，房间反复等缓冲。③ 新增“连着拖两次”“播放 0.6 秒就暂停”两步，并检查房主自己没被拉回；没跟上时区分 FAIL（房主被拉回或成员已加载好却没跟）和 NET（房主保持住、成员视频还在加载）。
- 结果：旧代码正常网速 4 轮全过，成员限速 3 轮里 2 轮失败（房主暂停后自己又播起来，成员也在播——就是报告的现象）；新代码成员限速 4 轮、正常网速 4 轮全过（每轮 12 项）。
- 验证：typecheck、lint、format:check、check:structure 通过，check-design 对改动的 3 个文件 0 违规；Jest 184 套 / 1194 条，房间相关 165 条全过。`pnpm test` / `pnpm test:rooms` 在默认 PATH 下会撞上 Node 26（`better-sqlite3` 按 Node 24 编译，`ERR_DLOPEN_FAILED`，只影响 `migrate-branding.test.js` 和 `room-service.test.cjs`）；改用项目的 Node 24（`C:/Users/XYL/tools/node`）重跑：test:rooms 42 / 42、`migrate-branding` 5 / 5 通过。
- 顺带发现：测试站（端口 3100）一度所有页面的 JS 都 404、页面不水合，房间停在“正在连接房间服务…”——它启动后 `.next` 在 15:48 被别的构建 / 开发服务器改写过。重启测试站进程后恢复。同一目录里跑构建或第二个开发服务器后要重启测试站。
- 没测：真实手机切后台、多台设备同账号、HLS 片源下的跳转落点（WAV 和 MP4 跳转是精确的，HLS 跳转落点若偏离目标超过 0.5 秒，会按“离房间应在位置在阈值内”兜底判断）。

### 2026-11-21 代码整理收尾

- 代码整理计划（原 `docs/plan/2026-11-19-cleanup-plan.md`）第 0–4 步全部完成，按计划第八节删掉 `docs/plan/`（计划和已经替换进 `README.md` 的 README 草稿）。测试站已停，测试库 `.data/test.db` 已删；`.claude/test.env`、`tongmu-test` 启动配置、快照 / 行为检查 / 两个账号同步测试的脚本留着下次用。
- 留给以后的：`features/playback` 里还有几个超过 400 行的文件（`surface/PlaybackSurface.tsx` 2,790 行、`data/load-source-detail.ts` 880 行、`player/wire-instance.ts` 670 行等，结构检查只提醒）；这些是原样搬过去的，要再拆得按功能重写，单独做。`PlaybackSessionProvider` 的 `registerSlot`（房间停靠挂点）现在没有任何地方注册，可能也是死代码，没动。

### 2026-11-21 代码整理第 4 步之三、之四：接好全站会话，删掉 `LegacyPlaybackSurface`

- **之三（全站播放会话）**：旧文件本来就接着会话（挂载点 `data-tm-player-mount`、汇报正在放什么、把播放器交给会话、媒体会话的标题和封面、完整 / 小窗 / 收起是同一个实例），这一步没改代码，只验证：`PlaybackSessionProvider` 的测试（含“房间里停靠时可以手动接管声音”）全过；两个账号的房间测试（`.claude/sync-test.mjs`）12 项全过；行为检查里整页 → 小窗 → 回播放页始终是同一个 `<video>`。
- **之四（删旧文件、整理目录）**：
  - `LegacyPlaybackSurface.tsx` 删除。播放页本体移到 `surface/PlaybackSurface.tsx`（2,790 行，去掉了整文件 `eslint-disable`），其余原样搬进子目录（代码不改，用到的页面状态从参数传进去；在调用处之后才声明的用 getter 晚取，行为和原来的闭包一样）：
    - `data/`：进入播放页的详情 / 片源搜索 / 测速 / 恢复记录（`load-source-detail`）、TMDB 背景（`load-tmdb-backdrop`）、豆瓣评分（`load-douban-rating`）；
    - `sources/`：解析播放地址（`update-video-url`）、测速优选和打分、换源、当前片源分辨率；
    - `downloads/`：本机下载 / 离线缓存检查、下载选集；
    - `player/`：加载播放器（`load-player`）、设置菜单、控制条、实例事件、转码、保存进度、跳过配置；
    - `session/`：`useStandalonePlayback`（电视版播放页用，经 `index.ts` 对外）、`useVideoAspectRatio`；
    - `lib/`：`hls-modes`（鸿蒙 / 网盘 HLS 模式和两个存储键，键名没改）、`xiaoya-correction`（小雅纠错，`any` 换成 `XiaoyaCorrection` 类型）。
  - 根目录只剩入口：`PlaybackRoute`、`PlaybackSessionProvider`、`index.ts`、`playback.css`（根布局直接引用这张样式表，留在根目录）。
  - 删掉没人用的 `PlaybackSlot`（房间早就有自己的画面挂点；它和 `useVideoAspectRatio` 重复）和它的测试、样式。
  - `playback.css` 最后的 767px 媒体查询换成档位：手机两档原来只有 `max-width: calc(100vw - 32px)` 真正生效（`top` / `right` 被后面的手机规则盖掉），并进手机规则；**600–767px 宽的窗口（平板档）跨标签页声音提示改用平板 / 电脑的位置**（右上 82px / 24px），和平板档的其余部分一致。
  - 待清理名单 103 → 101 条（旧文件的整文件 `eslint-disable`、767px 查询）。
- 文档：`docs/architecture.md` 模块表、`docs/playback-rebuild.md` 写明完成情况。
- 验证：全部检查通过，check-design 0 违规；行为检查和第 2 步结束时完全一致；计算样式快照（5 个场景 × 6 种窗口 × 深浅）和第 2 步结束时对比，见下一行。
- 快照结果：页面部分只有 `margin: auto` 的读数差（盒子位置和大小没变，第一步就解释过的噪声）；其余都在 Artplayer 自己的层里（加载圈、播放图标、设置面板被拍到的时机不同）。第 2 步结束时（和 2a 比）同样只有 Artplayer 内部差异：热力图画布换成内核的类名，没有弹幕时隐藏（原来是一块看不见的空画布）。
- 没验证：600–767px 平板档的声音提示位置（快照窗口里没有这个宽度）；真机分端手动验收（手机、平板、电视客户端）。
