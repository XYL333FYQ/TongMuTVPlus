# P5 老页面套皮映射（2026-10-12）

执行依据：AGENTS.md、DESIGN.md §2、§3、§4、§5.3、§6。基线 7137443e1499d03550a4d9dd678ba8fde90ea447。只替换展示样式，不改变条件、事件、接口、布局结构或权限。

## 2026-10-17 执行补充

- TYPOGRAPHY 覆盖旧字号规则：Tailwind 非评分 text-xs 及小于 13px 文字 →text-[13px]；评分类（mtv-rate/tm-tv-card-rating/tm-poster-rating）仍 12。font-semibold/600→500（h1→700），800/900→700，负字距 →0；保留原响应式前缀和条件。原 pulse 加载块 →tm-skeleton，转圈/不明确动效仍 TODO 人工核对。CSS 字号仍按角色审查，不把脚本成功当全部排版通过。
- bg-library-ochre 的实心徽标与按钮同样配 tm-accent-contrast；text-library-paper 仅在固定深色媒体遮罩上用 tm-room-player-text，不能把该白字机械放在深色主题的白底徽标上。两类映射已有回归；图像遮罩、选中态与开关仍逐项实际复核。

- 旧自定义 library 色板同样按角色映射：paper/night→tm-bg，card/night-card→tm-surface，edge/night-edge→tm-line，ink/night-ink 与 ochre 系列 →tm-text，muted 系列 →tm-muted，ochre-tint 系列 →tm-surface-raised。主按钮背景 ochre 须配 tm-accent-contrast，不合并条件；封面深色遮罩 ink→tm-room-cinema-bg、浅字 paper→tm-room-player-text；保留遮罩透明度和 dark 分支。未知别名/透明度保留 TODO；书封 3:4、阅读器布局与阅读偏好不受 token 迁移改变。

- 用户已授权 Codex 自主继续，仍不使用 Gemini；下面原试运行的委托/阶段授权描述保留作历史记录，不覆盖最新授权。
- 字体以 TYPOGRAPHY.md 为准，下面旧“12px 最小”映射不能作为普通文字的验收标准：说明至少 13px，正文/次要信息按角色 16/14px，12px 只给评分角标。后续批次必须补排版审查，不能只凭四类扫描通过。
- 现有交互按钮的 `bg-white text-black` 或 `bg-black text-white` → `bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)]`；不能把这类选中态误当普通面板。半透明未选背景仍用 surface-raised/text；三元和 clsx 结构、border/ring 宽度不变。非交互面板不套按钮反色规则。
- B02 预检发现上述白底黑字选中态会被旧脚本弱化；已补失败回归并修复规则，通过原 8 类问题及新增双向黑白按钮/非按钮边界。没有写入 B02 五个页面，130 个候选和 4 个 TODO 仍须逐处审查。
- B02 现已完成：130 处脚本替换、4TODO 经人工处理归零，五页三宽度深浅浏览器通过。脚本再补渐变停点删除回归：删除 hover:from/to 时同时去掉空 hover:前缀。53 处人工 className 差异和 CSS 角色补正说明脚本仍不能替代排版、错误背景与减少动态验收；音乐内部旧色板留后续批次，不因外壳 checker=0 宣称全模块完成。
- B03 可读性补充（优先于下表旧错误文本规则）：指定--tm-danger 在深色--tm-surface-raised 上实测 3.527:1，不能用于普通错误正文。保留规范色值；错误正文用--tm-text，已有错误图标与描边用--tm-danger，不新增图标或依赖颜色单独表达错误。脚本按原生正文标签/图标角色区分，保留错误条件和动作。半透明彩色状态面板使用 surface-raised；任意渐变未映射时须 TODO，不得漏检。相关失败回归已补。

## 扫描边界与白名单

- 扫描 src 下 JS/TS/JSX/TSX/CSS；不写 admin、API、middleware、两个同步 Hook、session、数据库文件、LegacyPlaybackSurface；PlaybackSessionProvider 整文件不委托、不纳入 P5。测试文件不计 UI 库存，server 不在扫描范围。
- token 定义允许在 --tm-\* 声明中出现 hex。品牌/影片资源不改，画板只读。不把 token 定义计作违规。
- 仅允许 DESIGN.md 明列的顶部聚光、海报高光、玻璃高光、骨架扫光、横版 Hero 底部遮罩。CSS 渐变函数全部盘点，人工逐条核对白名单；check-design 检查 bg-gradient 类，不证明 CSS 渐变合法。
- 已有 rgba、命名色、动态拼接色和组件库主题仍需人工检查；检查器只覆盖本任务指定的四类。rem 按 16px 估算，em 的实际字号需要浏览器核实。
- TODO 只能豁免注释同一行或紧接下一行，并写明具体原因；不能用文件级注释藏掉所有违规。扫描通过不代替 DOM、操作和浏览器验收。

## 按角色替换

下表中的 OLD 表示原彩色/中性色类（包括 dark: 对应项）。先确定角色，再替换整个主题配对；不能只按颜色全局替换。现有 var(--tm-\*) 原样保留。布局类、间距、字号（已达标）、事件、条件、数据字段原样保留。

| 角色                | 旧写法 → 新 token 写法                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 主操作              | bg-blue-600 / bg-green-600 等 + hover 深一档 + text-white → bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] hover:opacity-90；已有 disabled 类保留                                               |
| 次要操作            | bg-gray-100/200 + dark:bg-gray-700/800 + 中性色文字 → bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] border-[var(--tm-line)] hover:bg-[var(--tm-line)]；不新增原本没有的 border 宽度             |
| 强调文字            | text-amber/green/blue 等 → text-[color:var(--tm-text)]；text-gray-800/900、dark:text-gray-100/200 同理                                                                                                      |
| 选中态              | bg-blue-600 text-white 或彩色选中边框 → bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)]；边框 → border-[var(--tm-text)]；条件原样保留                                                            |
| 进度条              | bg-green/blue/purple 等 → bg-[var(--tm-text)]；轨道 → bg-[var(--tm-line)]，百分比/宽度逻辑不动                                                                                                              |
| 成功                | text-green-500 等 → text-[color:var(--tm-text)]；成功背景 → bg-[var(--tm-surface-raised)]；保留已有 CheckCircle 与成功文案                                                                                  |
| 警告                | bg-yellow-50、dark:bg-yellow-900/20 → bg-[var(--tm-surface-raised)]；text-yellow-800/200 → text-[color:var(--tm-text)]；border-yellow-\* → border-[var(--tm-line)]；保留警告文案，不凭颜色区分              |
| 错误                | text-red/rose-\* → text-[color:var(--tm-danger)]；错误边框 → border-[var(--tm-danger)]；背景 → bg-[var(--tm-surface-raised)]；保留错误图标和文字                                                            |
| 链接                | text-blue/green-\* → text-[color:var(--tm-text)]，已有 underline 原样保留；hover → hover:opacity-80                                                                                                         |
| 徽标                | 成功/待处理彩色 bg/text 组合 → bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]；保留已有“已上架 / 待处理”等状态文字和分支                                                                         |
| 遮罩                | bg-black/50 → bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_50%,transparent)]；其他透明度照原值；不把遮罩换成主题白色，不加新模糊                                                                    |
| 普通背景            | bg-white/dark:bg-gray-800 或 900 → bg-[var(--tm-surface)]；bg-gray-100/dark:bg-gray-800 → bg-[var(--tm-surface-raised)]；页面底色 → bg-[var(--tm-bg)]                                                       |
| 辅助文字            | text-gray-400/500/600/700 及其 dark 对应项 → text-[color:var(--tm-muted)]；标题、操作文字优先 --tm-text                                                                                                     |
| 边框 / 分隔         | border-gray-_、dark:border-white/10 或 /15 → border-[var(--tm-line)]；divide-_ 同理                                                                                                                         |
| 焦点                | focus:ring-blue/green-\* → focus:ring-[var(--tm-text)]；原 focus 样式保留；可点击元素补 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] |
| 骨架 / spinner 颜色 | border-blue-600 → border-[var(--tm-text)]；保留 border-t-transparent 和现有加载条件，不改加载机制；spinner 动效无法机械重做，TODO 另列                                                                      |
| 字号                | text-[10px]/text-[11px]、font-size 小于 12px → text-[12px] / 12px；不变更标题层级或其他排版结构                                                                                                             |
| 手机按钮            | 现有高度 <44px → 补 min-h-[44px]（图标按钮 min-w-[44px]）；不改变排列和 handler                                                                                                                             |

### 两页试运行的精确补充映射

- about 页装饰小字 Shared moments → 关于项目；不删除节点、不改层级。text-amber-500 → --tm-muted，字号/间距原样保留。
- about dark:bg-white/[0.03] → bg-[var(--tm-surface)]；浅深边框配对 → --tm-line。
- movie-request 未选季度 bg-gray-100/dark:bg-gray-800 → --tm-surface-raised，hover gray → --tm-line；选中季度用主操作 token。
- movie-request 已上架 / 待处理两分支使用相同中性徽标样式，保留条件与不同文字；success 图标 --tm-text、error 图标 --tm-danger。
- movie-request 原有季度遮罩 backdrop-blur-sm 无法只靠色类响应 no-blur：保留并在同一行附近标 TODO-P5: 季度遮罩模糊尚未接入无模糊偏好，需要共享样式阶段处理。
- movie-request 两处 animate-spin：保持节点、条件与动画，标 TODO-P5: 原有加载转圈留待骨架动效阶段，不在本批改加载机制。
- 所有表外样式/文案保留；真正疑难加紧邻 /_ TODO-P5: 具体原因 _/，JSX 用合法 {/_ ... _/}。禁止用 TODO 豁免已有明确映射的颜色。
- 可为可点元素补 focus-visible/min-h 样式；不改 grid、flex、container、列数、margin、padding、Portal、handler、请求或状态。
- 两页原格式可由 Gemini 做必要 Prettier 整理；Codex 不修改两页内容或格式。原有 router/any 等逻辑及 lint 历史项不借机清理。

## 无法机械替换（需 Codex 逐处判断）

- CSS 渐变函数、JS 模板拼接颜色、图表/书籍主题/字幕/弹幕/Canvas 色值、色彩选择器、影片 ambient、SVG 图标资源：颜色可能表示用户数据或媒体内容，不能统一 regex 改掉。
- 警告/成功仅靠颜色而没有图标或文字的地方：保留并 TODO，下一步逐处明确展示语义。
- 渐变删除会影响文字可读性时：按 --tm-surface 或现有 --tm-\* 遮罩替换需要实际截图；白名单渐变保留。
- em 字号、动态字体/库默认字号、动画和 backdrop-filter 偏好：人工浏览器验收。
- 共享 CSS 和跨页面组件一次只做一文件；禁止只凭单页截图宣布所有消费者通过。

## 分批清单

每批最多五文件，试运行先做；随后低风险静态页优先，动态页与共享组件后置。存在映射不等于授权：本轮只做试运行，正式清单等待“继续”。每批检查器违规为 0（明确 TODO 除外），验收通过才下一批。大文件自己做、一次一个。

| 批次   | 文件                                            | 行数 | 扫描项（彩色/hex/bg-gradient/小字） | 中性类 / CSS 渐变候选 |
| ------ | ----------------------------------------------- | ---: | ----------------------------------- | --------------------- |
| 试运行 | `src/app/about/page.tsx`                        |   81 | 1 / 0 / 0 / 0                       | 15 / 0                |
| 试运行 | `src/app/movie-request/page.tsx`                |  434 | 28 / 0 / 0 / 0                      | 65 / 0                |
| B01    | `src/app/sp/SpecialSourceToggle.tsx`            |   57 | 2 / 0 / 0 / 0                       | 3 / 0                 |
| B01    | `src/app/qr-login/page.tsx`                     |   75 | 3 / 0 / 0 / 0                       | 9 / 0                 |
| B01    | `src/app/tv/login/page.tsx`                     |   83 | 2 / 0 / 0 / 0                       | 9 / 0                 |
| B01    | `src/app/sp/page.tsx`                           |   97 | 7 / 0 / 0 / 0                       | 29 / 0                |
| B01    | `src/app/warning/page.tsx`                      |  100 | 19 / 0 / 1 / 0                      | 7 / 0                 |
| B02    | `src/app/music/music.css`                       |  109 | 0 / 9 / 0 / 0                       | 43 / 1                |
| B02    | `src/app/tv/TVHomeClient.tsx`                   |  118 | 0 / 0 / 0 / 0                       | 4 / 0                 |
| B02    | `src/app/tv/private/page.tsx`                   |  145 | 8 / 0 / 0 / 0                       | 27 / 0                |
| B02    | `src/app/tv/anime/page.tsx`                     |  155 | 2 / 0 / 0 / 0                       | 15 / 0                |
| B02    | `src/app/oidc-register/page.tsx`                |  177 | 17 / 0 / 1 / 0                      | 23 / 0                |
| B03    | `src/app/advanced-recommendation/page.tsx`      |  231 | 7 / 0 / 0 / 0                       | 26 / 0                |
| B03    | `src/app/tv/live/page.tsx`                      |  235 | 21 / 0 / 0 / 0                      | 37 / 0                |
| B03    | `src/app/tv/search/page.tsx`                    |  250 | 8 / 0 / 0 / 0                       | 29 / 0                |
| B03    | `src/app/watch-room/screen/page.tsx`            |  332 | 24 / 0 / 0 / 0                      | 53 / 0                |
| B03    | `src/app/tv/me/page.tsx`                        |  401 | 34 / 0 / 1 / 0                      | 49 / 4                |
| B04    | `src/app/manga/detail/page.tsx`                 |  439 | 0 / 0 / 0 / 1                       | 0 / 0                 |
| B04    | `src/app/register/page.tsx`                     |  475 | 34 / 0 / 1 / 0                      | 63 / 0                |
| B04    | `src/app/books/history/page.tsx`                |  480 | 4 / 0 / 0 / 0                       | 3 / 0                 |
| B04    | `src/app/login/page.tsx`                        |  522 | 24 / 0 / 1 / 0                      | 52 / 0                |
| B04    | `src/app/books/detail/page.tsx`                 |  553 | 2 / 0 / 0 / 0                       | 0 / 0                 |
| B05    | `src/app/tv/detail/page.tsx`                    |  554 | 11 / 0 / 0 / 0                      | 25 / 0                |
| B05    | `src/app/tv/live/play/page.tsx`                 |  614 | 33 / 0 / 2 / 0                      | 55 / 0                |
| B05    | `src/app/duanju/page.tsx`                       |  661 | 5 / 0 / 0 / 0                       | 47 / 0                |
| B05    | `src/app/watch-room/music/page.tsx`             |  757 | 9 / 12 / 0 / 0                      | 104 / 2               |
| B05    | `src/app/source-search/page.tsx`                |  759 | 22 / 0 / 0 / 0                      | 70 / 0                |
| B06    | `src/app/web-live/page.tsx`                     |  896 | 60 / 0 / 9 / 0                      | 151 / 0               |
| B06    | `src/app/douban/page.tsx`                       |  926 | 1 / 0 / 0 / 0                       | 15 / 0                |
| B06    | `src/app/page.tsx`                              | 1001 | 0 / 0 / 0 / 0                       | 34 / 0                |
| B06    | `src/app/private-library/page.tsx`              | 1187 | 47 / 0 / 0 / 0                      | 115 / 0               |
| B06    | `src/app/manga/read/page.tsx`                   | 1260 | 0 / 0 / 0 / 0                       | 4 / 0                 |
| B07    | `src/lib/music/shared.ts`                       |   96 | 3 / 0 / 0 / 1                       | 3 / 0                 |
| B07    | `src/lib/email.service.ts`                      |  186 | 0 / 7 / 0 / 0                       | 0 / 0                 |
| B07    | `src/styles/themes.ts`                          |  390 | 0 / 118 / 0 / 0                     | 42 / 12               |
| B07    | `src/lib/email.templates.ts`                    |  404 | 0 / 40 / 0 / 0                      | 0 / 0                 |
| B07    | `src/lib/anime-subscription.ts`                 |  735 | 0 / 7 / 0 / 0                       | 0 / 0                 |
| B08    | `src/components/BackButton.tsx`                 |   14 | 0 / 0 / 0 / 0                       | 4 / 0                 |
| B08    | `src/components/DoubanCardSkeleton.tsx`         |   22 | 0 / 0 / 0 / 0                       | 1 / 0                 |
| B08    | `src/components/ImagePlaceholder.tsx`           |   25 | 0 / 0 / 0 / 0                       | 0 / 1                 |
| B08    | `src/components/tv/TVRow.tsx`                   |   29 | 0 / 0 / 0 / 0                       | 5 / 0                 |
| B08    | `src/components/media/RippleCountBadge.tsx`     |   32 | 0 / 0 / 0 / 1                       | 1 / 0                 |
| B09    | `src/components/media/MediaActionButton.tsx`    |   35 | 4 / 0 / 0 / 0                       | 0 / 0                 |
| B09    | `src/components/tv/TVCard.tsx`                  |   43 | 1 / 0 / 2 / 0                       | 11 / 0                |
| B09    | `src/components/UpdateNotification.tsx`         |   57 | 8 / 0 / 0 / 0                       | 0 / 0                 |
| B09    | `src/components/Toast.tsx`                      |   65 | 3 / 0 / 0 / 0                       | 2 / 0                 |
| B09    | `src/components/media/EmptyState.tsx`           |   74 | 6 / 0 / 0 / 0                       | 0 / 0                 |
| B10    | `src/components/WeekdaySelector.tsx`            |   75 | 2 / 0 / 0 / 0                       | 4 / 0                 |
| B10    | `src/components/tv/TVLayout.tsx`                |   90 | 2 / 0 / 0 / 0                       | 11 / 3                |
| B10    | `src/components/tv/TVBrowsePage.tsx`            |   94 | 2 / 0 / 1 / 0                       | 9 / 0                 |
| B10    | `src/components/ConfirmDialog.tsx`              |   96 | 9 / 0 / 0 / 0                       | 22 / 0                |
| B10    | `src/components/Drawer.tsx`                     |  107 | 0 / 0 / 0 / 0                       | 10 / 0                |
| B11    | `src/components/DoubanRecommendations.tsx`      |  122 | 1 / 0 / 0 / 0                       | 2 / 0                 |
| B11    | `src/components/HttpWarningDialog.tsx`          |  124 | 7 / 0 / 0 / 0                       | 14 / 0                |
| B11    | `src/components/VirtualScrollableRow.tsx`       |  129 | 0 / 0 / 0 / 0                       | 12 / 0                |
| B11    | `src/components/media/ContinueReadingCard.tsx`  |  140 | 0 / 0 / 0 / 1                       | 0 / 0                 |
| B11    | `src/components/PersonalCenterPanel.tsx`        |  147 | 13 / 0 / 0 / 0                      | 39 / 0                |
| B12    | `src/components/DeviceManagementPanel.tsx`      |  159 | 22 / 0 / 0 / 0                      | 33 / 0                |
| B12    | `src/components/GlobalErrorIndicator.tsx`       |  160 | 4 / 0 / 0 / 0                       | 2 / 0                 |
| B12    | `src/components/DownloadBubble.tsx`             |  164 | 5 / 0 / 1 / 0                       | 4 / 0                 |
| B12    | `src/components/SearchSuggestions.tsx`          |  167 | 0 / 0 / 0 / 0                       | 8 / 0                 |
| B12    | `src/components/TrailerPickerDialog.tsx`        |  167 | 20 / 0 / 0 / 2                      | 48 / 0                |
| B13    | `src/components/ScrollableRow.tsx`              |  172 | 0 / 0 / 0 / 0                       | 16 / 0                |
| B13    | `src/components/ImageViewer.tsx`                |  174 | 0 / 0 / 0 / 0                       | 4 / 0                 |
| B13    | `src/components/media/MediaCard.tsx`            |  176 | 0 / 0 / 0 / 3                       | 1 / 0                 |
| B13    | `src/components/media/library.ts`               |  181 | 4 / 0 / 0 / 0                       | 6 / 0                 |
| B13    | `src/components/CapsuleSwitch.tsx`              |  240 | 0 / 0 / 0 / 0                       | 10 / 0                |
| B14    | `src/components/FavoritesPanel.tsx`             |  243 | 15 / 0 / 0 / 0                      | 26 / 0                |
| B14    | `src/components/BangumiScheduleTimeline.tsx`    |  246 | 2 / 0 / 0 / 0                       | 36 / 0                |
| B14    | `src/components/SearchResultFilter.tsx`         |  246 | 16 / 0 / 0 / 0                      | 18 / 0                |
| B14    | `src/components/ContinueWatching.tsx`           |  251 | 5 / 0 / 0 / 0                       | 34 / 0                |
| B14    | `src/components/SmartRecommendations.tsx`       |  252 | 1 / 0 / 0 / 0                       | 8 / 0                 |
| B15    | `src/components/AIComments.tsx`                 |  280 | 22 / 2 / 0 / 0                      | 27 / 0                |
| B15    | `src/components/DoubanComments.tsx`             |  290 | 10 / 2 / 0 / 0                      | 26 / 0                |
| B15    | `src/components/NotificationPanel.tsx`          |  297 | 33 / 0 / 0 / 0                      | 32 / 0                |
| B15    | `src/components/DoubanCustomSelector.tsx`       |  319 | 0 / 0 / 0 / 0                       | 14 / 0                |
| B15    | `src/components/AddToPlaylistModal.tsx`         |  333 | 7 / 0 / 0 / 0                       | 33 / 0                |
| B16    | `src/components/DownloadEpisodeSelector.tsx`    |  359 | 38 / 0 / 0 / 0                      | 64 / 0                |
| B16    | `src/components/tv/player/TVNativeVideo.tsx`    |  378 | 1 / 0 / 0 / 0                       | 11 / 0                |
| B16    | `src/components/tv/TVRemotePanel.tsx`           |  382 | 20 / 0 / 0 / 0                      | 88 / 0                |
| B16    | `src/components/DownloadPanel.tsx`              |  402 | 86 / 0 / 1 / 1                      | 131 / 0               |
| B16    | `src/components/EmailSettingsPanel.tsx`         |  402 | 64 / 0 / 0 / 0                      | 103 / 0               |
| B17    | `src/components/PlayRecordsPanel.tsx`           |  414 | 33 / 0 / 0 / 0                      | 53 / 0                |
| B17    | `src/components/LyricsPiPWindow.tsx`            |  429 | 0 / 1 / 0 / 1                       | 0 / 0                 |
| B17    | `src/components/DanmakuFilterSettings.tsx`      |  454 | 23 / 0 / 0 / 0                      | 74 / 0                |
| B17    | `src/components/OfflineDownloadPanel.tsx`       |  467 | 31 / 0 / 1 / 0                      | 67 / 0                |
| B17    | `src/components/EpisodeTitleCorrectDialog.tsx`  |  470 | 12 / 0 / 0 / 0                      | 68 / 0                |
| B18    | `src/components/MobileActionSheet.tsx`          |  483 | 8 / 0 / 0 / 0                       | 56 / 0                |
| B18    | `src/components/EpisodeFilterSettings.tsx`      |  527 | 27 / 0 / 0 / 0                      | 84 / 0                |
| B18    | `src/components/MultiLevelSelector.tsx`         |  594 | 12 / 0 / 0 / 0                      | 14 / 0                |
| B18    | `src/components/DoubanSelector.tsx`             |  597 | 0 / 0 / 0 / 0                       | 34 / 0                |
| B18    | `src/components/DataMigration.tsx`              |  616 | 60 / 0 / 0 / 0                      | 101 / 0               |
| B19    | `src/components/AnimeSubscribeModal.tsx`        |  633 | 32 / 0 / 0 / 8                      | 106 / 0               |
| B19    | `src/components/EpgScrollableRow.tsx`           |  636 | 73 / 0 / 0 / 0                      | 87 / 0                |
| B19    | `src/components/tv/TVVirtualRemote.tsx`         |  653 | 3 / 0 / 0 / 0                       | 15 / 0                |
| B19    | `src/components/VersionPanel.tsx`               |  678 | 89 / 0 / 2 / 0                      | 50 / 0                |
| B19    | `src/components/DanmakuPanel.tsx`               |  679 | 39 / 0 / 0 / 0                      | 79 / 0                |
| B20    | `src/components/music/tokens.ts`                |  684 | 6 / 4 / 0 / 0                       | 4 / 2                 |
| B20    | `src/components/AcgSearch.tsx`                  |  790 | 30 / 0 / 0 / 0                      | 64 / 0                |
| B20    | `src/components/DownloadManagementPanel.tsx`    |  798 | 19 / 0 / 0 / 0                      | 56 / 0                |
| B20    | `src/components/CorrectDialog.tsx`              |  836 | 35 / 0 / 0 / 0                      | 157 / 0               |
| B20    | `src/components/PansouSearch.tsx`               | 1187 | 110 / 0 / 0 / 0                     | 107 / 0               |
| B21    | `src/components/AnimeSubscriptionComponent.tsx` | 1219 | 113 / 0 / 0 / 7                     | 171 / 0               |
| B21    | `src/components/AIChatPanel.tsx`                | 1324 | 35 / 0 / 1 / 0                      | 181 / 0               |
| B21    | `src/components/public-poster.css`              |   11 | 0 / 2 / 0 / 0                       | 0 / 0                 |
| B21    | `src/components/visual-preferences.css`         |   79 | 0 / 0 / 0 / 1                       | 0 / 0                 |
| B21    | `src/styles/globals.css`                        |  119 | 0 / 2 / 0 / 0                       | 2 / 2                 |
| B22    | `src/styles/motion.css`                         |  145 | 0 / 0 / 0 / 0                       | 0 / 1                 |
| B22    | `src/components/public-catalog.css`             |  329 | 0 / 2 / 0 / 3                       | 0 / 1                 |
| B22    | `src/styles/home.css`                           | 1027 | 0 / 0 / 0 / 0                       | 0 / 4                 |

## 自己做：超过 1500 行

| 文件                                  | 行数 | 扫描项（彩色/hex/bg-gradient/小字） | 中性类 / CSS 渐变候选 |
| ------------------------------------- | ---: | ----------------------------------- | --------------------- |
| `src/components/EpisodeSelector.tsx`  | 1638 | 85 / 0 / 0 / 0                      | 108 / 0               |
| `src/lib/changelog.ts`                | 1688 | 0 / 1 / 0 / 0                       | 0 / 0                 |
| `src/app/tv/play/page.tsx`            | 1958 | 36 / 1 / 2 / 0                      | 70 / 0                |
| `src/app/globals.css`                 | 2045 | 0 / 51 / 0 / 17                     | 0 / 27                |
| `src/components/VideoCard.tsx`        | 2203 | 27 / 2 / 0 / 11                     | 46 / 0                |
| `src/components/SearchPageClient.tsx` | 2723 | 87 / 0 / 0 / 2                      | 152 / 0               |
| `src/components/DetailPanel.tsx`      | 2829 | 47 / 0 / 0 / 1                      | 308 / 0               |
| `src/app/live/page.tsx`               | 3241 | 102 / 5 / 10 / 0                    | 207 / 0               |
| `src/app/music/MusicClient.tsx`       | 3552 | 73 / 23 / 4 / 11                    | 203 / 9               |
| `src/app/books/read/page.tsx`         | 4122 | 10 / 11 / 0 / 4                     | 8 / 0                 |
| `src/components/UserMenu.tsx`         | 6344 | 310 / 20 / 2 / 5                    | 1059 / 6              |

## 定位与验收

- 上表是初始库存；每批执行 node scripts/check-design.mjs 加具体文件路径，获得当前行号。完整逐处初始清单保存在本轮验收 output/playwright/p5-pilot/inventory.json，正式开始前重新扫描，不能把初始计数当最终剩余计数。
- 中性类也要换 token，但不能只按 gray 的深浅判定角色。错误只用 --tm-danger，其他状态用图标和文字区分。
- CSS 渐变候选、动态值、命名色、SVG/媒体内容色先人工判定；没写明的原样保留并标 TODO，不自行扩大替换。
