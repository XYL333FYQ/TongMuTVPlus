# P7 详情步骤 1、2 最终续验

日期：2026-10-13（America/Los_Angeles）。本轮不使用 Gemini，未提交 Git、部署或新增依赖。展示与所列浏览器行为已验收，全站 lint 和格式检查仍未通过。

## 改动文件与规范

依据 DETAIL.md §1、2、4、5 和末尾修订；DESIGN.md §5.3 指向该详情规范。原七项用户决定已写入 DETAIL.md 修订。

- AGENTS.md：原生 typecheck 崩溃关闭预览后重试一次；仍崩溃标记待用户手工验证，继续其他检查。备份/快照只用 .txt/.bak。
- docs/design/DESIGN.md、DETAIL.md、PROGRESS.md：规范指向、七项决定与最新进度。
- src/components/DetailPanel.tsx：请求、数据状态、来源切换留原文件；共享展示层接入；仅从已有 TMDB 响应读取 backdrop。没有新增数据 Hook、请求或缓存机制。
- src/components/detail/DetailShell.tsx、detail.css：原生 dialog、响应式居中/底层/窄抽屉、44px 拖动区域、固定底栏、焦点锁与返回、最上层 Esc、进退动效、两种减少动态偏好与无模糊；照片墙保持原 ref 的受约束滚动容器；短内容桌面垂直居中。
- src/components/detail/DetailContent.tsx、DetailActions.tsx、DetailActors.tsx、DetailEpisodes.tsx、DetailAuxiliaryPanels.tsx、DetailError.tsx、types.ts：共享资料、动作、演职员、原季集信息卡和图片/纠错展示。错误文字用 tm-text、装饰错误图标用 tm-danger，深浅文字对比分别 17.65/18.16。
- src/components/VideoCard.tsx：仅传收藏回调/状态与触发海报 ref，共 9 行新增，0 行删除；无关格式整理已还原。触屏点按不会保证海报自动获得焦点，显式 ref 用于关闭后的焦点返回。
- src/components/BannerCarousel.tsx：仅移除 useDrawer 并传已有 backdrop，1 行替换。现有 detailOpen 没有置 true 的入口，本轮未新增打开行为。
- src/components/PublicCatalogPage.tsx：公开详情复用展示组件，原公开资料、播放、一起看、搜索入口保留；没有接入认证详情 API。仅详情函数及所需导入变化。
- src/components/DetailPanel.actions.test.tsx：保留原 6 项断言，补 matchMedia 环境。
- src/components/DetailPanel.presentation.test.tsx：8 项展示回归，包括触摸未聚焦海报时显式 ref 返回、语义、焦点锁、顶层取消、季集信息、收藏与窄抽屉。

另恢复 5 个未改语义的控制器节点共 285 行原排版，保留请求代码原样。没有为格式检查重排整个 DetailPanel、VideoCard 或全站文件。本轮详情范围 git diff --check 退出 0。

本轮未改 LegacyPlaybackSurface 文件/调用、PlaybackSessionProvider 会话逻辑、useWatchRoom、usePlaySync、session.ts、server、API、数据库、middleware、admin。工作区原有 P4/P5 dirty 保留。没有接口、存储键或 Socket 事件变更。

## 串行检查结果

所有以下源码检查在本项目预览停止后运行；完成检查后才启动截图。验收结束后浏览器和 3215 服务再次关闭。

| 命令/检查                                | 结果                                                             | 证据文件                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| pnpm typecheck                           | 退出 0，tsc --noEmit --incremental false                         | accepted-typecheck.log、accepted-typecheck.exit.txt                                |
| pnpm lint                                | 退出 1，81 个既有错误                                            | resume-lint.log                                                                    |
| pnpm test                                | 退出 0，34 套件、228 项通过                                      | resume-test.log                                                                    |
| pnpm format:check                        | 首次原生崩溃 3221225477；独立重试退出 1，完整报 729 文件格式问题 | resume-format-check.log、accepted-format-retry.log、accepted-format-retry.exit.txt |
| pnpm test:rooms                          | 退出 0，19/19                                                    | resume-test-rooms.log                                                              |
| 详情展示 scoped ESLint                   | 退出 0，0 错误、30 个原控制器警告                                | accepted-scoped-lint.log                                                           |
| 新展示组件/测试/公开详情 scoped Prettier | 退出 0                                                           | accepted-scoped-format.log                                                         |
| DetailPanel 和共享展示 check-design      | 退出 0，违规 0、TODO 0                                           | accepted-check-design.log                                                          |
| 请求 AST 对比                            | 13 个请求表达式、4 组数据 effect 依赖一致                        | request-audit.json                                                                 |
| output 类型源码/快照扫描                 | .ts/.tsx/.d.ts/.mts/.cts 为 0                                    | output-source-scan.json                                                            |
| 详情范围 whitespace diff                 | 退出 0                                                           | diff-check.log                                                                     |

全项目格式问题包括旧源码及本机验收产物；Main/VideoCard 的原有排版按用户要求保留，没有全局格式化。Scoped Prettier 不包含恢复原排版的整个 DetailPanel/VideoCard，不能解释为这些整文件格式也通过。

此前 typecheck 原生崩溃的根因仍未知；没有证据把它写成已定位或已确认并行导致。用户手工 exit 0 是此前代码状态，本次最终源码另由 Codex 串行实测 exit 0；本次无需标记待用户手工验证。未改 tsconfig、检查范围或排除测试。系统检查使用原 pnpm 命令；后段浏览器预览/CLI 使用本机已有 Node 24.19.0，同为 Node 24，并不意味着原生崩溃原因已解决。

## 拆分前后请求逐条对比

统计范围与 before-network.json 一致：打开详情后的影视资料 API，排除图片、Next 开发资源、主题、首页目录及其他全站请求。采用本地固定响应；剧集场景包含打开后点击“切换到 TMDB”。因此本表不代表真实上游服务可用性或所有资源请求完全相同。

| 场景 | 顺序 | 拆分前 GET                                                  | 拆分后 GET                                                  | 一致 |
| ---- | ---- | ----------------------------------------------------------- | ----------------------------------------------------------- | ---- |
| 电影 | 1    | /api/douban/detail?id=901                                   | /api/douban/detail?id=901                                   | 是   |
| 剧集 | 1    | /api/douban/detail?id=902                                   | /api/douban/detail?id=902                                   | 是   |
| 剧集 | 2    | /api/tmdb/search?query=%E9%AA%8C%E6%94%B6%E5%89%A7%E9%9B%86 | /api/tmdb/search?query=%E9%AA%8C%E6%94%B6%E5%89%A7%E9%9B%86 | 是   |
| 剧集 | 3    | /api/tmdb/detail?id=902&type=tv                             | /api/tmdb/detail?id=902&type=tv                             | 是   |
| 剧集 | 4    | /api/tmdb/seasons?tvId=902                                  | /api/tmdb/seasons?tvId=902                                  | 是   |
| 剧集 | 5    | /api/tmdb/credits?id=902&type=tv                            | /api/tmdb/credits?id=902&type=tv                            | 是   |
| 剧集 | 6    | /api/tmdb/episodes?id=902&season=1                          | /api/tmdb/episodes?id=902&season=1                          | 是   |

电影 1→1、剧集 6→6；方法、完整 URL、数量及顺序 deepEqual。原始记录 before-network.json / after-network.json，逐行结果 network-comparison.json；前后各两张基线图保留。

## 浏览器验收

Chromium 桌面与触摸模拟，真实浏览器交互。本地隔离账号/数据库，影视资料与海报使用受控响应、SVG 占位，播放使用浏览器生成的本地 WebM；没有把固定响应当成真实豆瓣/TMDB/HLS 验收。

| 场景                         | 实测结果                                                                                                            | 证据                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1280/820/390 深浅，电影/剧集 | 12 组通过；无横向溢出；桌面宽 1000，820 宽面板 772，手机顶留 56                                                     | screens.json、detail-movie/tv-主题-宽度.png                       |
| 初始焦点与返回               | 电影初始关闭按钮聚焦；剧集切换来源后焦点在切换按钮属于用户操作；12 组关闭均回原海报                                 | screens.json                                                      |
| 访客三宽度深浅               | 6 组通过；没有收藏按钮、没有调用认证详情/收藏/记录 API；保留原播放与房间 URL                                        | guest-portrait.json、guest-主题-宽度.png                          |
| 无横图/横图/竖图误填横图字段 | 电影无横图用海报氛围；剧集已有宽图使用；400×600 候选判定竖图、横图 opacity 0、氛围保留                              | screens.json、guest-portrait.json、portrait-backdrop-1280/390.png |
| 手机底栏                     | 播放/一起看均 174×48；拖动区域高 44、展开目标 44；滚到底最后行在底栏上方约 96px，展开长简介同样成立                 | screens.json、final-extra.json、四张 bottom 图及展开图            |
| 拖动与动效                   | 普通拖动位移 108px 时遮罩 opacity .82，释放可关闭；系统 reduce 与用户 reduce 均无平移/缩放，手势保留、滚动行为 auto | interactions.json、final-extra.json、normal-drag.png              |
| 真触摸事件模拟               | coarse=true、maxTouchPoints=1；tap 打开，关闭返回海报，CDP touch 下拉关闭                                           | touch.json、touch-detail-390.png                                  |
| 最上层 Esc/焦点锁            | 海报大图上按 Esc 仅关大图，详情仍开，返回大图触发按钮；Shift+Tab 留在详情，最终返回海报                             | interactions.json、nested-escape.png                              |
| 关闭模糊                     | 用户菜单实际开启偏好；手机和桌面可见详情元素的 blur/backdrop-filter 检查均无残留                                    | interactions.json、final-extra.json、preferences 两图             |
| 播放页窄列抽屉               | 原 useDrawer 保持；非模态 aria-modal=false，宽 400、内部 scrollWidth 398，窄列显示                                  | playback.json、playback-drawer-1280.png                           |
| 短内容桌面居中               | 修前 y40，修后 y69.40625，等于 (900−761.1875)/2                                                                     | gallery-before/after.json、short-detail-centered-1280.png         |

照片墙追加 60 图回归：修前内层高度 9692/8072、scrollTop 恒 0、60 节点全量渲染。修后桌面/手机 viewport 为 745/629，首屏 12 节点，下滚到 1500 时 18 节点，末屏 12 节点并显示第 60 张；仅修外壳高度和 flex 约束，ref、请求、ResizeObserver、可见范围算法未动。证据 gallery-before.json、gallery-after.json、gallery 与 gallery-bottom 两宽截图。Codex 只读审查提出两项，复核修复后没有新的重要问题；Gemini 未参与。

同一 video 验证：打开播放页详情后，用 Next 顶栏真实搜索链接换页，随后折叠、恢复；保存 video 对象引用并比较身份/连接状态，同时记录 pause/emptied/abort、时间、解码帧与节点总数。每阶段 same=true、connected=true、paused=false、videos=1、events=[]；时间 0.025532→2.338560→2.942081→3.510870 秒，帧 4→27→33→39。此证据证明该短时本地文件场景连续播放，不是长时/HLS/真实上游证明。

## 备份改名

本轮改名 5 个文件，未删除：

1. C:/Users/ss/Documents/桌面图标/编程/ai 项目/TongMuTVPlus/output/playwright/p5-codex-fix/about-before.tsx → about-before.txt
2. C:/Users/ss/Documents/桌面图标/编程/ai 项目/TongMuTVPlus/output/playwright/p5-codex-fix/movie-request-before.tsx → movie-request-before.txt
3. C:/Users/ss/Documents/桌面图标/编程/ai 项目/TongMuTVPlus/output/playwright/p5-pilot/format-reference/about.tsx → about.txt
4. C:/Users/ss/Documents/桌面图标/编程/ai 项目/TongMuTVPlus/output/playwright/p5-pilot/format-reference/movie-request.tsx → movie-request.txt
5. C:/Users/ss/Documents/桌面图标/编程/ai 项目/TongMuTVPlus/output/playwright/p7-detail-20261013/DetailPanel.before.tsx → DetailPanel.before.txt

用户改名的 PublicCatalogPage.before.tsx.txt 保留。完整前后绝对路径见 backup-renames.json；最终 output 类型扩展扫描为 0。所有新的快照/排版参考使用 .txt/.bak。

## 停止边界与未验证

- 到此停止步骤 1、2；“一起看”仍跳转房间页，选房间、带片交接、待加入横幅、新存储键没有开始。
- 未验证 Safari、Firefox、真机/软键盘、真实上游、HLS、长时播放、全部多季度/多候选纠错及异常网络组合。
- Banner 原有 detailOpen 没有置 true 的入口，保持现有触发条件，未新增入口，不宣称 Hero 打开详情路径已实测。
- 浏览器出现首页 TMDB upcoming 配置不足及 Bangumi 图片资源错误；属于所测详情之外的已有入口。受控详情和所列操作通过，不宣称全站控制台完全无错误。
- 全站 lint、格式未通过；原生崩溃根因未知。旧中止报告为历史记录，以本报告及 PROGRESS 当前条目为准。
- 截图包只含报告、45 张图（41 验收图＋ 4 基线图）、检查日志与验收 JSON；不含源码/快照、临时数据库、随机凭据、认证状态、开发日志或本地媒体。遗留临时文件未删除，验收预览及命名浏览器已关闭。
