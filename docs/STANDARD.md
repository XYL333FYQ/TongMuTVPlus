# 代码规范

整个项目要读起来像一个人按一套规矩写的。原则只有一条：**同一件事只有一个来源、一个名字、一种写法。** 新代码先对照这里，再对照旁边的文件；两者不一致时以这里为准，并把旁边的文件改过来。

能让机器检查的规则都写成了检查（S10），进 CI，违反就失败：

```bash
pnpm lint              # 依赖方向（S1）、核心不用 any（S8）
pnpm check:lint        # 代码警告只许减少（S10）
pnpm check:structure   # 公共零件、块名归属、令牌、层级、媒体查询、!important、跳过检查注释、文档路径（S2 / S4 / S5 / S8）
pnpm check:design      # 核心范围的视觉硬规则：彩色类、写死 hex、渐变、小于 12px 的字号
```

## 范围

这套规范管本项目自己做的部分：站点外壳、发现（`/`）、片库（`/douban`）、房间（`/watch-room`）、播放页（`/play`），以及它们共用的组件、样式和工具。漫画、小说、音乐、直播、网络直播、电视、管理后台等页面来自上游 MoonTVPlus，暂时保持原样（可以继续用 Tailwind），以后要改它们时再按这里整理。书和漫画用的卡片（`components/media/MediaCard`）也属于上游这一套，和影片卡片 `VideoCard` 是两样东西，暂不合并。

检查覆盖的文件列在 `scripts/structure-scope.json`，分三档，见下面的“三档范围”。

## 三档范围

`scripts/structure-scope.json` 是检查范围的唯一来源：结构检查、设计检查、`.eslintrc.js`（核心不用 `any`）都从它读，不另抄一份。

| 档       | JSON 里的键                              | 是什么                                                                         | 怎么管                                                                                 |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 核心     | `coreCss`、`coreCode`（减去 `excluded`） | 本项目自己做的部分：外壳、发现、片库、房间、播放页和它们共用的组件、样式、工具 | 全部规则都管；`any` 按错误报                                                           |
| 常用上游 | `dailyUpstream`                          | 上游来的、但用户天天在用的页面和接口：我的、搜索、登录、账号菜单、播放记录等   | 公共零件旧账按这一档单独计数，改到它们时优先收口                                       |
| 上游     | 其余                                     | 管理后台、音乐、书、漫画、直播、电视等上游独立功能区                           | 暂时保持原样；公共零件、跳过检查注释、代码警告仍按棘轮只许减少，服务器权限以后统一收口 |

以 `/` 结尾的是目录前缀，其余是单个文件。`scripts/lib/structure-scope.mjs` 的 `tierOf()` 给文件分档，`check:structure` 通过时按三档打印每个公共零件还剩多少旧账。

## 目录

```
src/
  app/          路由入口：取参数 + 渲染某个功能的页面组件，不放业务逻辑
  features/     一个功能一个文件夹：组件、hooks、样式、测试放在一起，对外只经 index.ts
    discover/   发现（首页）
    library/    片库
    room/       一起看：大厅、房间页、全站会话、房间小窗、同步、语音、共享屏幕、活动
    playback/   自己看：播放页、全站会话、小窗
    player/     播放器内核（两边共用）：WatchPlayer + 通用插件
  components/   通用界面零件：不认识任何功能
    shell/      站点外壳：顶栏、底栏、导航、手势、PWA、客户端桥接、沉浸模式
  hooks/        跨功能、不带业务的 hooks
  lib/          纯逻辑和数据访问：不引 React 组件
  styles/       全局：令牌、基础样式、通用零件样式
  types/        跨功能共享的类型
```

站点外壳放在 `components/shell/` 而不是 `features/`：所有页面（包括上游页面）都套着它，它是共用的一层，不是一个功能。

`styles/home.css` 也留在共用层、由根布局引入：发现页的版面之外，继续观看一排（“我的”、搜索页也用）、影片卡片里的“继续观看”样式、海报进场动画、访客首页和片库都用它的类，搬进 `features/discover` 会让这些共用组件依赖一个功能。只属于某个组件的部分已经拆出去（影片卡片 → `components/VideoCard.css`）。

房间的**连接层**也是共用的一层，不在 `features/room` 里：`lib/watch-room-socket.ts`（连接）、`hooks/useWatchRoom.ts`（连接状态、确认回包、消息补齐）、`components/WatchRoomProvider.tsx`（全站共用一个连接）、`types/watch-room.ts`（房间、成员、播放状态的类型）。外壳、自己看、直播 / 音乐等页面都要知道“人在不在房间、有没有控制权”，它们只经这一层知道；房间的界面、会话、同步、播放器、活动都在 `features/room`，建在这一层上面。

自己看也一样：全站播放会话的**接口**在共用层——`hooks/usePlaybackSession.tsx`（会话的类型、context、`usePlaybackSession` / `usePlaybackSessionSafe`），站内播放地址的纯函数在 `lib/playback-links.ts`（`filmPlaybackHref`、`roomSelectionHref`、`queuePlaybackHref` 等）。影片卡片、外壳的媒体会话、房间都只经这两个文件知道“正在放什么、怎么去放”；提供会话的 `PlaybackSessionProvider` 和播放页在 `features/playback`。

## 规则

### S1 依赖方向

`app → features → components / hooks → lib`，只能向右引用。

- `components/`、`hooks/`、`lib/` 不能引 `@/features/*`。
- 一个功能的**根目录只放对外的入口文件**：`index.ts`（类型、纯函数、hooks，不带组件和样式）和页面 / 会话这类入口组件（如 `features/room/RoomRoute.tsx`）。子目录都是功能内部。
- 功能之间、`app/` 引功能，都只能引对方根目录下的入口文件：`import { displayRoomName } from '@/features/room'`、`import RoomSession from '@/features/room/RoomSession'`，不能 `@/features/room/session/...`。功能内部用相对路径或自己的深路径都可以。
- 不做把所有东西都转出去的总入口：那样任何页面引一个小函数，都会把整个功能的界面打进它的包里。
- 需要“正在播放”这类跨功能状态的通用组件，通过 props 或 `hooks/` 里的通用接口拿，不直接引功能。

由 ESLint `no-restricted-imports` 检查（`.eslintrc.js`）。

### S2 一件事一个来源

一件事一个来源，见下面的公共零件登记表；登记表里每个零件只有它的主人能直接用原材料，旧账在待清理名单里只许减少。

- 一套播放器内核：`features/player`。
- 设计令牌（`--tm-*`）只在 `styles/tokens.css` 定义（`:root`、`html.light`、设备档位下的覆盖都写在那里）。组件内部用的局部变量可以写在组件的块上。
- z-index 只用层级令牌（见下面的层级表）。
- 时间格式化、浏览器存储读写、设备档位：现在还有多份实现（旧账数量见 `check:structure` 的输出），新代码只用登记表里的主人。“点外面关闭”由弹窗层 `ModalLayer` 承担（点遮罩关闭），贴着按钮弹出的菜单、筛选、提示用 `Popover`（或 `useAnchoredLayer`），在它外面按下就关。

### S3 一个东西一个名字

- 一起看在代码里叫 `room`，自己看叫 `playback`，播放器内核叫 `player`。不再用 Legacy / solo / standalone / together / tc 这类名字。
- 对外的名字不改：路由 `/watch-room`、接口路径、Socket 事件名、存储键（localStorage / IndexedDB 的键名）、数据库路径和字段（见 `docs/PROJECT_IDENTITY.md`）。

### S4 样式只有一种写法

- 核心功能用“组件旁边的 CSS 文件 + `tm-` 类名”，由组件自己 import（全站一直在用的写在 `styles/`，由根布局 import）。核心功能里不用 Tailwind 工具类。
- 类名 `tm-<块>-<元素>`，`<块>` 必须登记在下面的块名登记表里。一个块只属于一个文件。
- 样式文件只给自己的块定样式，不跨文件改别人的元素。需要别人配合时，由对方提供一个开关（属性或 hook），例如房间页要隐藏站点顶栏，就调用外壳提供的沉浸模式，而不是在房间样式里写 `.tm-shell-header { display: none }`。

检查方法：每条选择器里“最靠右的 `tm-` 类”（不算 `:not()` / `:where()` / `:has()` 和属性选择器括号里的）就是这条规则在给谁定样式，它所属的块必须登记在这个文件名下。`tm-app` 是 body 上的全站根标记，不算块。

### S5 改样式就改原规则

- 不在文件末尾追加“第几轮 / 对齐 / 收紧”段落去覆盖前面的规则；同一选择器在一个文件里只出现一次。
- 整页按哪套排版只认设备档位（`html[data-tm-device]`，见 `src/lib/device-tier.ts`）和页面上的 `data-layout`，`features/` 里不写像素宽度媒体查询。单个零件“放不放得下”（卡片列数、表单列数）在 `components/` 和 `styles/` 里仍可用宽度查询。
- `!important` 只许用在四种场合：压 Artplayer 等第三方的内联样式（选择器里有 `.art-` / `artplayer`）、减弱动效（`data-tm-reduced-motion` / `prefers-reduced-motion`）、关闭玻璃效果（`data-tm-no-blur`）、主题切换动画（`data-tm-theme-transition`）。核心样式里其余的 `!important` 是旧账，按文件记在待清理名单的 `important` 类别里，只许减少。

### S6 文件大小与职责

- 一个文件一件事，超过约 400 行就该拆（`check:structure` 会列出来提醒）。播放器内核里确实拆不开的，在本文件末尾写明理由。
- 页面组件只拼装；数据请求放 hooks，计算放 lib。
- 不留只转发一行的空壳文件，引用直接改到真身。

### S7 命名

- 组件 `PascalCase.tsx`，hooks `useXxx.ts`，其他 `kebab-case.ts`。
- 测试和被测文件放一起：`Xxx.test.tsx`。
- 标识符用英文；注释用中文，写“为什么”，不写日期、轮次和改动记录（那些在 git 和 `docs/design/PROGRESS.md` 里）；测试名用英文。

### S8 类型

- 核心功能的文件开头不写整文件 `eslint-disable`；确实需要时用 `eslint-disable-next-line` 并写原因。
- 行内跳过检查的注释（`eslint-disable-next-line` / `eslint-disable-line`）全部 `src` 按文件计数，记在待清理名单的 `eslintDisableInline` 类别里，只许减少：新代码要跳过一条规则，先想办法不跳过；真要跳过，就在同一次提交里删掉别处的一条。
- 不用 `any`（ESLint 在核心范围内按错误报，测试文件除外）。第三方库类型缺的部分只在一处补：播放器相关（Artplayer 实例、弹幕 / 字幕插件、hls.js）在 `features/player/core/art-types.ts`；浏览器带前缀的私有接口（Safari 全屏、iOS 主屏模式等）在 `src/types/vendor-dom.d.ts`。

### S9 仓库

- 根目录只放配置、各部署平台规定必须在根目录的文件、各平台入口脚本和说明（README、CHANGELOG、LICENSE、AGENTS.md）。
- 文档集中在 `docs/`，入口是 `docs/README.md`。
- 截图、导出物、备份不进 git。

### S10 机器守规矩

能自动检查的都写成检查，进 CI（`.github/workflows/checks.yml`）。现有违规写在待清理名单 `scripts/structure-allowlist.json` 里，每条是“键 × 数量”：名单只能变短（修好或变少就用 `node scripts/check-structure.mjs --shrink` / `pnpm check:lint --shrink` 写回），不能往里加新的，数量也不能变大。

- **新类别**：新加一种检查时，用 `--baseline <类别>` 把现有的旧账记一次。每个类别只能做这一次，名单里已有的类别（哪怕是空的）拒绝重新生成，免得用它洗白新问题。
- **改名、搬家**：旧路径的数量变 0、新路径冒出同样的数量时，检查会提示“像是改名”。在同一次提交里把名单里的键改成新路径，数量不能增加。
- **代码警告**：`pnpm check:lint` 把现有 ESLint 警告按“文件 :: 规则”记成基线（`lintWarnings`），只许减少；错误一律失败。
- **设计检查**：`pnpm check:design` 扫整个核心范围；改过的文件也可以单独跑 `node scripts/check-design.mjs <文件>`。`em` 字号相对父元素，不判断。确实要保留原值的，在同一行或上一行写 `/* TODO-P5: 原因 */`，它不算违规但要人工验收。
- **提交钩子**：`scripts/git-hooks/pre-commit` 在本机提交前跑结构检查、设计检查和暂存文件的格式检查（类型检查、单元测试、代码警告基线交给 GitHub）。第一次检出后执行一次 `git config core.hooksPath scripts/git-hooks` 启用。Node 不是 24 版时只提醒，不拦提交。
- **规则改动报告**：推送后，GitHub 检查会把这次改了名单、范围、检查脚本、`.eslintrc.js`、本规范或测试的文件列在运行摘要里，方便看出“改规则”和“改代码”混在一起。

## 层级表

z-index 只写下面的令牌（定义在 `styles/tokens.css`）。同一个组件内部的上下关系（自己建了层叠上下文的局部浮起）用 -1 到 3 的数字，不算层级。需要紧贴某一层的上方或下方时写 `calc(var(--tm-z-…) ± 1)`。

| 令牌                    | 值    | 用途                                                  |
| ----------------------- | ----- | ----------------------------------------------------- |
| `--tm-z-page-float`     | 60    | 浮在页面内容上的控件：片架翻页按钮、自己看底部操作坞  |
| `--tm-z-docked`         | 85    | 自己看嵌入在页面里的画面（画面节点 +1）               |
| `--tm-z-page-notice`    | 100   | 自己看页上的提示条                                    |
| `--tm-z-page-error`     | 110   | 自己看页上的操作出错条                                |
| `--tm-z-mini`           | 600   | 两种小窗                                              |
| `--tm-z-header`         | 620   | 站点顶栏                                              |
| `--tm-z-nav`            | 640   | 手机底栏、导航                                        |
| `--tm-z-overlay`        | 1000  | 浮层：弹窗、抽屉、底部面板、菜单、详情                |
| `--tm-z-popover`        | 3000  | 下拉选择（要能盖住弹窗里的内容）                      |
| `--tm-z-toast`          | 9999  | 提示、确认框                                          |
| `--tm-z-top`            | 10000 | 最顶层：顶部进度条、开发用的叠加层                    |
| `--tm-z-player-chat`    | 20    | 播放器内部：房间聊天弹幕层                            |
| `--tm-z-player-heatmap` | 30    | 播放器内部：进度条上方的弹幕热度曲线                  |
| `--tm-z-player-touch`   | 45    | 播放器内部：触屏中间一组，夹在 Artplayer 自带的层之间 |
| `--tm-z-player-badge`   | 50    | 播放器内部：画面右上角的链接刷新提示（控制条之下）    |
| `--tm-z-player-live`    | 65    | 播放器内部：房间直播消息和发消息框（控制条之上）      |
| `--tm-z-player-cover`   | 500   | 播放器内部：加载 / 出错遮罩、弹幕加载提示（盖住全部） |

数字沿用整理前各处写死的值。播放器内部的层（`--tm-z-player-*`）只在播放器的层叠上下文里有意义，要和 Artplayer 自带的层（画面 10、弹幕 30、遮罩 50、控制条 60……）比较，所以不能缩成 1–3。

## 公共零件登记表

全站共用的零件，每个只有一个主人：只有“主人”列里的文件或目录能直接用这种“原材料”（例如 `createPortal`），别处要用就调主人提供的“用法”。`check:structure` 用“检查”列里的探测器统计主人以外的文件，旧账在待清理名单的 `parts:<探测器>` 类别里，只许减少。“检查”写 `—` 的零件不自动统计，靠审查。

`src/components/feedback/`、`src/components/ui/` 里的每个文件都必须是某一行的主人；新加公共零件先在这里登记。

| 零件       | 主人                                                                                                                           | 用法                                                                                                                                                                                                                          | 检查          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 弹窗层     | `src/components/feedback/` `src/components/ui/Select.tsx` `src/features/room/activities/RoomLiveMessages.tsx`                  | `ModalLayer`、`ConfirmDialog`、`MobileActionSheet`、`askConfirm()`、`Popover` / `useAnchoredLayer`（贴按钮的浮层）、`SideLayer`（不挡页面的右侧面板）；房间直播消息层挂进播放器全屏元素（画面叠加，不是弹窗）                 | `portal`      |
| 浏览器存储 | `src/lib/`                                                                                                                     | 键先登记在 `src/lib/settings.ts`（固定键或带变量的键族），再用 `readSetting` / `writeSetting` / `removeSetting`（要分清“读不了”时用 `readSettingStrict`）；键名不改                                                           | `storage`     |
| 设备档位   | `src/lib/device-tier.ts` `src/lib/platform.ts`                                                                                 | 整页排版用 `html[data-tm-device]` / `useDeviceTier`；局部判断用 `viewportSize()`、`matchesMedia()`、`watchMedia()`、`isCoarsePointer()`、`isInstalledWebApp()`；哪一端（App / 电脑客户端 / 网页）用 platform.ts               | `screen`      |
| 播放器     | `src/features/player/core/` `src/lib/media-engines.ts`                                                                         | 点播用 `WatchPlayer`；直播挂流（`attachHlsStream` / `attachFlvStream` / `createLivePlayer`）和片源测速用 media-engines                                                                                                        | `player`      |
| 时间格式   | `src/lib/time.ts`                                                                                                              | 时长 `formatClock` / `formatPaddedClock` / `formatDuration`；日期时刻 `formatLocalDate` / `formatLocalTime` / `formatDateTime` / `formatTimestamp` / `formatTimeAgo`                                                          | `timeFormat`  |
| 服务器权限 | `src/lib/require-role.ts` `src/lib/roles.ts`                                                                                   | 接口用 `requireRole()`；页面按角色显示用 `isOwnerRole()`、`isAdminRole()`、`isPrivilegedRole()`（站点和房间角色都用）                                                                                                         | `roleCheck`   |
| 提示       | `src/components/feedback/`                                                                                                     | `notify(message, type, { duration })`、`notifyError()`；不自己渲染 `Toast`                                                                                                                                                    | `toast`       |
| 加载       | `src/components/feedback/LoadingStyle.tsx` `src/styles/loading.css`                                                            | `LoadingStyle`（整页加载）、`BusyDots`（按钮和短状态的处理中，不转圈）                                                                                                                                                        | `spinner`     |
| 海报       | `src/components/poster/` `src/components/VideoCard.tsx` `src/components/video-card/` `src/components/catalog/PublicPoster.tsx` | 影片卡片用 `VideoCard`；其他地方的影片海报用 `FilmPoster`（取图走 `ProxyImage`，缺图显示片名首字）、加载占位用 `PosterSkeleton`；尺寸由使用方定，小图用 `--tm-art-radius` / `--tm-art-shadow` / `--tm-poster-initial-size` 调 | `poster`      |
| 图标       | `src/features/room/view/chat-emoji.ts`                                                                                         | 界面图标只用 lucide-react，不用 emoji；聊天表情是用户发出的内容，只放在 chat-emoji.ts                                                                                                                                         | `emoji`       |
| 开关       | `src/components/ui/Switch.tsx`                                                                                                 | `Switch`（`checked`、`onChange(next)`、`busy`）；名字用 `aria-label`，或外面包一层 `<label>`；外观是 primitives.css 的 `tm-switch-btn`                                                                                        | `switch`      |
| 空状态     | `src/components/feedback/EmptyState.tsx`                                                                                       | `EmptyState`（`icon`、`title`、`description`、`action`；面板和弹窗里用 `compact`）；样子是 layout.css 的 `tm-empty`；筛选区里一行字的“正在加载 / 暂无”用 `tm-inline-state`                                                    | `emptyState`  |
| 加载失败   | `src/components/feedback/RetryNotice.tsx`                                                                                      | `RetryNotice`（`message`、`onRetry`、`retryLabel`、`action`）；加载失败不显示成“没有内容”                                                                                                                                     | `retryNotice` |
| 网络请求   | `src/lib/` `src/app/api/`                                                                                                      | 页面、组件、功能、hooks 发请求用 `apiFetch`（`src/lib/api-client.ts`，接口路径和请求体照旧）；要登录过期自动刷新、失败抛错的用 `fetchWithAuth`；`lib/` 里的数据层和接口路由直接用 `fetch`                                     | `fetch`       |
| 滚动锁     | `src/lib/scroll-lock.ts`                                                                                                       | `lockScroll()`（弹窗层自带）                                                                                                                                                                                                  | `scrollLock`  |
| 点外面关闭 | `src/components/feedback/`                                                                                                     | `ModalLayer` 点遮罩关闭（五种款式都带）；贴按钮的浮层由 `useAnchoredLayer` 在外面按下时关                                                                                                                                     | —             |

## 术语表

同一个东西只用一个说法，界面文字按这里写。

| 说法                   | 代码名                                                 | 不再用的说法                     |
| ---------------------- | ------------------------------------------------------ | -------------------------------- |
| 自己看                 | `playback`                                             | Legacy、solo、standalone         |
| 一起看（功能名）       | 房间 `room`（路由 `/watch-room` 不改）                 | together、tc                     |
| 播放器内核             | `player`（`WatchPlayer`）                              | Legacy                           |
| 播放记录（历史类统称） | `playRecords`（`PlayRecord`、接口 `/api/playrecords`） | 观看记录、历史记录（作界面词时） |
| 继续观看               | 只指首页那一栏（`ContinueWatching`）                   | 用“继续观看”指全部播放记录       |
| 阅读记录（书、漫画）   | 书和漫画的 `history` 页                                | 历史（作导航词时）               |
| 收藏                   | `favorites`（`FavoritesPanel`、接口 `/api/favorites`） | 收藏夹（作功能名时）             |

## 块名登记表

第一列是类名前缀（`tm-<块>`），第二列是唯一能给它定样式的文件。前缀按最长匹配：`tm-page-transition` 登记在外壳，`tm-page` 的其他元素登记在版面。

| 块                                                                                                                                                                                                                                                                                                                                                                                     | 文件                                                     | 说明                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `tm-btn` `tm-icon-btn` `tm-switch` `tm-tab` `tm-tabs` `tm-chip` `tm-chips` `tm-badge` `tm-skeleton` `tm-glass` `tm-press` `tm-input` `tm-field` `tm-dot` `tm-theme-emblem` `tm-theme-toggle` `tm-theme-morph` `tm-morph` `tm-drawer-surface`                                                                                                                                           | `src/styles/primitives.css`                              | 通用零件、主题切换                                                                         |
| `tm-visual-preferences` `tm-dropdown` `tm-dropdowns` `tm-capsule` `tm-expand-search` `tm-animated-theme` `tm-popover` `tm-control-selection` `tm-filter` `tm-display-chevron` `tm-theme-segments`                                                                                                                                                                                      | `src/styles/controls.css`                                | 筛选、下拉、外观设置                                                                       |
| `tm-select`                                                                                                                                                                                                                                                                                                                                                                            | `src/styles/form-controls.css`                           | 下拉选择（另有原生表单控件的全站样式）                                                     |
| `tm-confirm` `tm-toast` `tm-feedback` `tm-modal`                                                                                                                                                                                                                                                                                                                                       | `src/styles/feedback.css`                                | 提示、确认框、通用弹窗                                                                     |
| `tm-modal-layer` `tm-popover-layer` `tm-side-layer`                                                                                                                                                                                                                                                                                                                                    | `src/styles/modal-layer.css`                             | 原生模态层；贴着按钮的浮层；不挡页面的右侧面板                                             |
| `tm-loading` `tm-busy`                                                                                                                                                                                                                                                                                                                                                                 | `src/styles/loading.css`                                 | 加载样式；处理中的三个点                                                                   |
| `tm-action-sheet` `tm-http-warning` `tm-image-viewer` `tm-profile` `tm-search-suggestions` `tm-continue-header`                                                                                                                                                                                                                                                                        | `src/styles/panels.css`                                  | 面板类零件                                                                                 |
| `tm-search` `tm-history`                                                                                                                                                                                                                                                                                                                                                               | `src/styles/search.css`                                  | 搜索页                                                                                     |
| `tm-auth`                                                                                                                                                                                                                                                                                                                                                                              | `src/styles/auth.css`                                    | 登录、注册                                                                                 |
| `tm-page` `tm-section` `tm-poster` `tm-shelf` `tm-library` `tm-public` `tm-back-to` `tm-fade-image` `tm-spin` `tm-design-grid` `tm-desktop-page` `tm-inline-state` `tm-empty` `tm-admin`                                                                                                                                                                                               | `src/styles/layout.css`                                  | 页面版面、片架、片库网格                                                                   |
| `tm-shell` `tm-main` `tm-top-header` `tm-header-glass` `tm-logo` `tm-primary-nav` `tm-mobile` `tm-explore` `tm-account` `tm-menu` `tm-guest` `tm-more-trigger` `tm-launch` `tm-page-transition` `tm-page-instant` `tm-route-skeleton` `tm-repository` `tm-perf` `tm-install-hint` `tm-ptr` `tm-icon-button` `tm-embedded` `tm-media-shell` `tm-media-page` `tm-selectable` `tm-header` | `src/styles/shell.css`                                   | 站点外壳                                                                                   |
| `tm-touch` `tm-heatmap`                                                                                                                                                                                                                                                                                                                                                                | `src/styles/player-controls.css`                         | 播放器触屏按钮、弹幕热力图提示（两个播放器共用）                                           |
| `tm-home` `tm-hero-score` `tm-media-initial`                                                                                                                                                                                                                                                                                                                                           | `src/styles/home.css`                                    | 发现页、影片卡片                                                                           |
| `tm-video`                                                                                                                                                                                                                                                                                                                                                                             | `src/components/VideoCard.css`                           | 影片卡片（访客卡片 `PublicCatalogPage` 借用 `tm-video-card` / `tm-video-card-art` 的观感） |
| `tm-music`                                                                                                                                                                                                                                                                                                                                                                             | `src/app/music/music.css`                                | 音乐页（上游页面，只登记手机档位下外壳要它让出的两处）                                     |
| `tm-schedule`                                                                                                                                                                                                                                                                                                                                                                          | `src/features/library/parts/BangumiScheduleTimeline.css` | 片库的番剧时刻表                                                                           |
| `tm-playback` `tm-solo` `tm-audio-focus`                                                                                                                                                                                                                                                                                                                                               | `src/features/playback/playback.css`                     | 自己看                                                                                     |
| `tm-room`                                                                                                                                                                                                                                                                                                                                                                              | `src/features/room/room.css`                             | 一起看共用零件：按钮、图标、表单、对话框、房间头部                                         |
| `tm-room-view`                                                                                                                                                                                                                                                                                                                                                                         | `src/features/room/view/RoomView.css`                    | 房间页                                                                                     |
| `tm-room-chat`                                                                                                                                                                                                                                                                                                                                                                         | `src/features/room/view/ChatPanel.css`                   | 房间聊天                                                                                   |
| `tm-room-playlist`                                                                                                                                                                                                                                                                                                                                                                     | `src/features/room/view/PlaylistPanel.css`               | 片单面板                                                                                   |
| `tm-room-members`                                                                                                                                                                                                                                                                                                                                                                      | `src/features/room/view/MembersPanel.css`                | 成员面板                                                                                   |
| `tm-room-activity`                                                                                                                                                                                                                                                                                                                                                                     | `src/features/room/view/RoomActivities.css`              | 房间活动面板                                                                               |
| `tm-room-recs`                                                                                                                                                                                                                                                                                                                                                                         | `src/features/room/view/Recommendations.css`             | 今晚看什么                                                                                 |
| `tm-room-picker`                                                                                                                                                                                                                                                                                                                                                                       | `src/features/room/view/FilmPicker.css`                  | 选片                                                                                       |
| `tm-room-danmaku`                                                                                                                                                                                                                                                                                                                                                                      | `src/features/room/view/DanmakuSheet.css`                | 弹幕面板                                                                                   |
| `tm-room-lobby`                                                                                                                                                                                                                                                                                                                                                                        | `src/features/room/lobby/Lobby.css`                      | 大厅                                                                                       |
| `tm-room-dock`                                                                                                                                                                                                                                                                                                                                                                         | `src/features/room/session/RoomDock.css`                 | 离开房间页后的房间入口条                                                                   |
| `tm-room-sheet`                                                                                                                                                                                                                                                                                                                                                                        | `src/features/room/session/FilmSheet.css`                | 站内点开影片时的“怎么看”                                                                   |
| `tm-room-dm`                                                                                                                                                                                                                                                                                                                                                                           | `src/features/room/player/chat-danmaku.css`              | 房间聊天弹幕                                                                               |
| `tm-room-share`                                                                                                                                                                                                                                                                                                                                                                        | `src/features/room/ScreenSharePage.css`                  | 共享屏幕页                                                                                 |
| `tm-room-activity-actions` `tm-room-activity-error`                                                                                                                                                                                                                                                                                                                                    | `src/features/room/activities/RoomActivityActions.css`   | 直播、音乐页里的房间活动按钮                                                               |
| `tm-room-live`                                                                                                                                                                                                                                                                                                                                                                         | `src/features/room/activities/RoomLiveMessages.css`      | 直播页里的房间消息                                                                         |
| `tm-mini`                                                                                                                                                                                                                                                                                                                                                                              | `src/components/mini-player/mini-player.css`             | 两种小窗共用的按钮层                                                                       |
| `tm-detail`                                                                                                                                                                                                                                                                                                                                                                            | `src/components/detail/detail.css`                       | 影片详情                                                                                   |
| `tm-ptools`                                                                                                                                                                                                                                                                                                                                                                            | `src/features/playback/page/PlaybackTools.css`           | PlaybackTools 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                           |
| `tm-pdetail`                                                                                                                                                                                                                                                                                                                                                                           | `src/features/playback/page/PlaybackDetail.css`          | PlaybackDetail 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                          |
| `tm-pdmsrc`                                                                                                                                                                                                                                                                                                                                                                            | `src/features/playback/page/DanmakuSourceDialog.css`     | DanmakuSourceDialog 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                     |
| `tm-poverlay`                                                                                                                                                                                                                                                                                                                                                                          | `src/features/playback/page/VideoOverlays.css`           | VideoOverlays 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                           |
| `tm-pfail`                                                                                                                                                                                                                                                                                                                                                                             | `src/features/playback/page/PlaybackFailure.css`         | PlaybackFailure 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                         |
| `tm-pkeys`                                                                                                                                                                                                                                                                                                                                                                             | `src/features/playback/page/ShortcutDialog.css`          | ShortcutDialog 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                          |
| `tm-pload`                                                                                                                                                                                                                                                                                                                                                                             | `src/features/playback/page/PlaybackLoading.css`         | PlaybackLoading 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                         |
| `tm-ptitle`                                                                                                                                                                                                                                                                                                                                                                            | `src/features/playback/page/PlaybackTitle.css`           | PlaybackTitle 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                           |
| `tm-pcomments`                                                                                                                                                                                                                                                                                                                                                                         | `src/features/playback/page/PlaybackComments.css`        | PlaybackComments 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                        |
| `tm-ppansou`                                                                                                                                                                                                                                                                                                                                                                           | `src/features/playback/page/PansouDialog.css`            | PansouDialog 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                            |
| `tm-precs`                                                                                                                                                                                                                                                                                                                                                                             | `src/features/playback/page/FallbackRecommendations.css` | FallbackRecommendations 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                 |
| `tm-prail`                                                                                                                                                                                                                                                                                                                                                                             | `src/features/playback/page/PlaybackRail.css`            | PlaybackRail 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                            |
| `tm-pepisodes`                                                                                                                                                                                                                                                                                                                                                                         | `src/features/playback/page/EpisodePanel.css`            | EpisodePanel 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                            |
| `tm-pdock`                                                                                                                                                                                                                                                                                                                                                                             | `src/features/playback/page/PlaybackDock.css`            | PlaybackDock 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                            |
| `tm-psurface`                                                                                                                                                                                                                                                                                                                                                                          | `src/features/playback/surface/PlaybackSurface.css`      | PlaybackSurface 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                         |
| `tm-msheet`                                                                                                                                                                                                                                                                                                                                                                            | `src/components/feedback/MobileActionSheet.css`          | MobileActionSheet 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                       |
| `tm-httpw`                                                                                                                                                                                                                                                                                                                                                                             | `src/components/feedback/HttpWarningDialog.css`          | HttpWarningDialog 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                       |
| `tm-release`                                                                                                                                                                                                                                                                                                                                                                           | `src/components/feedback/ReleaseNoticeDialog.css`        | ReleaseNoticeDialog 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                     |
| `tm-daux`                                                                                                                                                                                                                                                                                                                                                                              | `src/components/detail/DetailAuxiliaryPanels.css`        | DetailAuxiliaryPanels 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                   |
| `tm-depisodes`                                                                                                                                                                                                                                                                                                                                                                         | `src/components/detail/DetailEpisodes.css`               | DetailEpisodes 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                          |
| `tm-dactors`                                                                                                                                                                                                                                                                                                                                                                           | `src/components/detail/DetailActors.css`                 | DetailActors 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                            |
| `tm-dshell`                                                                                                                                                                                                                                                                                                                                                                            | `src/components/detail/DetailShell.css`                  | DetailShell 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                             |
| `tm-dside`                                                                                                                                                                                                                                                                                                                                                                             | `src/components/detail/DetailSidePanel.css`              | DetailSidePanel 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                         |
| `tm-cw`                                                                                                                                                                                                                                                                                                                                                                                | `src/components/ContinueWatching.css`                    | ContinueWatching 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                        |
| `tm-cupdate`                                                                                                                                                                                                                                                                                                                                                                           | `src/components/shell/ClientUpdatePrompt.css`            | ClientUpdatePrompt 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                      |
| `tm-cbuild`                                                                                                                                                                                                                                                                                                                                                                            | `src/components/shell/ClientBuildInfo.css`               | ClientBuildInfo 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                         |
| `tm-pheader`                                                                                                                                                                                                                                                                                                                                                                           | `src/components/shell/PersistentHeader.css`              | PersistentHeader 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                        |
| `tm-perfprobe`                                                                                                                                                                                                                                                                                                                                                                         | `src/components/shell/PerfProbe.css`                     | PerfProbe 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                               |
| `tm-phd`                                                                                                                                                                                                                                                                                                                                                                               | `src/components/shell/PageHeader.css`                    | PageHeader 的样式（原 Tailwind 类按 Tailwind 的输出原样转来）                              |

## 允许的例外

确实拆不开或必须破例的，在这里写明文件和理由。检查范围同步排除（`scripts/structure-scope.json` 的 `excluded`）。

- `src/features/room/MusicPage.tsx`（`/watch-room/music`，房间里一起听音乐）：界面沿用上游音乐页，282 个 Tailwind 类，和音乐模块其他页面一个样子。它属于房间的入口所以放在 `features/room`，但样式按上游页面对待；以后整理音乐模块时一起改成 `tm-` 类。

- 超过约 400 行但不拆（S6）：
  - `src/features/player/core/WatchPlayer.ts`：两个播放器共用的内核，一个实例管着同一个 `<video>`、Artplayer、hls.js 和插件清理表；拆开要把内部字段公开，破坏“外面只能经方法操作播放器”的边界。
  - `src/features/player/core/plugins/danmaku.ts`：纯函数已拆到 `danmaku-match.ts`；控制器的方法共用一个运行序号判断请求是否过期，拆开容易让过期请求覆盖新结果。
  - `src/features/player/core/plugins/subtitles.ts`：解析、切换、样式、自动加载共用同一个 Artplayer 实例和轨道表。
  - `src/features/room/sync/sync-engine.ts`：一个状态机（期望状态 desired、回声判断、对齐记号都在一个类里），规则见文件开头；拆开会把“只有对齐过之后的本机事件才算用户操作”这条约束分散到几处。
