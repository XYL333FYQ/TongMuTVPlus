# 自己看重建清单（代码整理第 4 步）

目标：自己看换到两边共用的播放器内核 `src/features/player`（房间已经在用），删掉 13,583 行的 `src/features/playback/LegacyPlaybackSurface.tsx`。**界面和行为不变**：每一处可见的东西和交互都要在新实现里有对应，验收用改前改后的计算样式对比 + 分端手动过一遍（`docs/design/ACCEPTANCE.md`）。

2026-11-20 现状：

- 内核已经从 `features/room/player/core` 搬到 `features/player/core`，对外只经 `features/player/index.ts`。房间用它；自己看还没用。
- 内核里 `anime4k`、`link-refresh`、`playback-flow` 三个插件是给自己看预备的，目前只有测试在用。
- `LegacyPlaybackSurface` 直接创建 Artplayer，所有插件、设置项、页面上的各块都写在一个组件里（同一个文件里大约 120 个 state）。它通过 `PlaybackSessionProvider` 的挂载点（`data-tm-player-mount`）在完整 / 小窗 / 收起之间搬家，换页面不卸载。

## 功能清单与对应

“内核”一列：✓ 内核里已有，〜 有一部分，✗ 没有。

### 播放器本身

| 旧实现里的功能                                                                       | 内核 | 说明                                                                           |
| ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| 片源加载：普通文件 / HLS / 代理 m3u8，WebKit 原生 HLS 判断                           | ✓    | `WatchPlayer.load` + `source-policy` + `env`                                   |
| hls.js 缓冲策略、错误转中文                                                          | ✓    | `hls-engine`（自己看的缓冲参数要和旧的一致，房间用 120 秒）                    |
| 去广告（默认关键字 + 后台下发规则）、设置里的“去广告”开关                            | 〜   | `ad-filter` 有过滤；开关和“外部播放器去广告”没有                               |
| 鸿蒙 / 网盘 HLS 播放模式（`harmony_hls_playback_mode`、`netdisk_hls_playback_mode`） | ✗    | 两个存储键不能改                                                               |
| 清晰度切换（`videoQualities`）                                                       | ✗    |                                                                                |
| 转码（`isTranscoding`、转码 cookie）                                                 | ✗    |                                                                                |
| 播放链接过期自动换新（小雅 / OpenList）                                              | ✓    | `link-refresh`                                                                 |
| 倍速记忆、防息屏、进度条图标、iOS 全屏                                               | ✓    | `basics`                                                                       |
| 键盘快捷键 + 快捷键说明对话框（`PLAY_SHORTCUT_GROUPS`）                              | 〜   | `keyboard` 有按键；说明对话框是页面上的                                        |
| 触屏中间一组按钮、全屏退出按钮                                                       | ✓    | `lib/player-touch-controls`（两边共用）                                        |
| 横屏锁定（`lib/player-orientation`）                                                 | 〜   | 房间没有，自己看要接上                                                         |
| 网页全屏 / 系统全屏状态                                                              | 〜   |                                                                                |
| 跳过片头片尾、续播提示、自动下一集、进度保存、下一集预加载                           | ✓    | `playback-flow`；“跳过配置”“快捷快进配置”“快进 / 倒退时间”三个设置项的界面要补 |
| 播放记录跳转（`play-record-jump`）                                                   | 〜   | 续播提示是同一件事，交互要按旧的对齐                                           |
| Anime4K 超分（模式 6 种、倍数 4 档，需要 WebGPU）                                    | ✓    | `anime4k`；设置项界面要补                                                      |
| 截图按钮                                                                             | ✗    |                                                                                |
| 外部播放器（复制 / 打开）                                                            | ✗    |                                                                                |

### 弹幕

| 旧实现里的功能                                                 | 内核 | 说明                                      |
| -------------------------------------------------------------- | ---- | ----------------------------------------- |
| 自动匹配弹幕源、手动选择 / 搜索、上传、数量上限、下一集预加载  | ✓    | `danmaku`（匹配顺序注释里写了和旧版一致） |
| 弹幕过滤规则 + 设置面板（`DanmakuFilterSettings`）             | 〜   | 过滤有；面板是页面上的组件，接上即可      |
| 弹幕热力图（开关）                                             | ✓    | `heatmap`                                 |
| 弹幕源选择面板、当前选中记忆（`lib/danmaku/selection-memory`） | 〜   |                                           |

### 字幕

| 旧实现里的功能                                          | 内核 | 说明                 |
| ------------------------------------------------------- | ---- | -------------------- |
| 片源自带字幕、本地上传、字幕选择（`subtitle-selector`） | ✓    | `subtitles`          |
| ASS / SSA（jassub + 中文字体）、PGS / SUP（libbitsub）  | ✓    | `subtitles`          |
| 字幕格式转换（`lib/subtitle-converter`）                | 〜   | 核对两边是否同一条路 |

### 页面上的部分（不属于内核，要拆成自己看的组件）

- 加载过程：分阶段文案、加载动画样式（`LoadingStyle`）、出错与跨域失败提示。
- 片源：搜索全部片源、测速 / 优选（`precomputedVideoInfo`）、后台继续加载、换源、没有片源时的推荐。
- 选集（`EpisodeSelector`，可折叠）、集数过滤（`lib/episode-filter`）、集名修正（`lib/episode-title-correction`）。
- 影片信息：豆瓣 / TMDB 资料、评分、别名、剧照背景、网盘的 TMDB 匹配、“纠错”（`CorrectDialog`）。
- 收藏、详情面板（`DetailPanel`）、短评（`DoubanComments`）、AI 短评（`AIComments`）、问片（`AIChatPanel`）、相关推荐（`SmartRecommendations`）。
- 网盘搜索（`PansouSearch`）、下载选集（`DownloadEpisodeSelector` + `DownloadContext`）。
- 用这部片开房间（一起看入口）。
- 手机上的底部面板 / 侧栏（`soloSheet`、`soloRail`）。
- 全站播放会话：`PlaybackSessionProvider` 的挂载点、小窗 / 收起、媒体会话、自己看开始播放时让房间画面先停。

## 做法（每一步单独能跑、单独提交）

1. **自己看的页面骨架换成组件**：先不动播放器，把页面上的各块（加载、片源、选集、信息、评论、推荐、底部面板）从 `LegacyPlaybackSurface` 拆成 `features/playback/page/` 下的组件，状态先原样传进去。每拆一块对比一次计算样式。
2. **播放器换内核**：用 `WatchPlayer` + 插件替换直接创建 Artplayer 的那部分；内核缺的（上表 ✗ / 〜）先在 `features/player` 里补成插件，房间也能用。设置菜单的每一项按旧的顺序和文案。
3. **接全站播放会话**：挂载点、小窗、收起、媒体会话、和房间的互让，跑 `PlaybackSessionProvider` 的测试和两个账号的房间测试。
4. **删 `LegacyPlaybackSurface`**，`features/playback` 根目录只留入口（`PlaybackRoute`、`PlaybackSessionProvider`、`index.ts`），其余进子目录；`playback.css` 里最后一处 767px 媒体查询换成档位。

验收：每一步都跑全部检查；第 2、3 步各做一次分端手动验收（手机竖屏 / 横屏、平板、电脑网页 / 客户端，深浅色），重点是播放、换集、换源、弹幕、字幕、小窗来回切换不重建视频元素。
