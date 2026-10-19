# TongMuTV Plus 静态对照验收 · 2026-10-14

本轮应用修正已落实用户确认的方案。保留原始自动差异表和逐条复核表，不宣称原始「必须修正」清零或全站检查全部通过。打开 index.html 可逐页查看修正前后并排图。

## 1. 改动与规范依据

- 首页：page.tsx、BannerCarousel.tsx、ContinueWatching.tsx、HomeRooms.tsx、PublicCatalogPage.tsx、home.css、SectionHeader.tsx。依 reference-static 首页布局及 TYPOGRAPHY 字号/对齐覆盖，修箭头/文字块、单海报栏宽房间卡、纯色浅色页面背景、Hero 内氛围、分类、评分和后续模块。SectionHeader 左标题/右查看全部；模块间距 64px。继续观看清空移入原有记录面板，原确认后清空逻辑不变。
- 共享外壳：PageLayout.tsx、MobileHeader.tsx、ThemeSettings.tsx、shell.css、UserMenu.tsx（仅账号触发按钮显示真实用户名首字，未格式化大文件或更改菜单逻辑）。深浅/系统三段、44px 日月按钮、顶栏玻璃去 saturate；桌面搜索恢复参考的 36px 边框按钮；手机点按保持 44px。
- 详情：DetailPanel.tsx、detail/DetailContent.tsx、DetailActors.tsx、DetailMoreMenu.tsx、detail.css。按电影版静态稿与 DETAIL 修订；来源、照片墙、纠错、外链移入 44px 更多；缺原名和收藏直接隐藏；无收藏两主按钮 168px 等宽；资料请求留在原文件。
- 房间：RoomWorkspace.tsx、rooms.css、RoomPlaybackButton.tsx、playback/context.tsx、PlaybackSessionProvider.tsx（新增展示调用与角标按钮）。依 RoomPhone 与用户对桌面右侧的明确覆盖。仅自己看复用原处理函数；收起仍 setFolded(true)，44px 玻璃图标在播放器右上方；提示为「收起画面，继续播放」。当前影片输入转接之外，原 chooser 分支、命令、确认顺序和媒体身份判断的 AST 一致。
- 记录确认：PlayRecordsPanel.tsx 仅修改清空入口/确认展示。原先已经有确认流程；本轮改为「清空全部观看记录？此操作不能撤销」，取消不删除，确认才调用原清空方法。其余记录面板旧样式保留，未作为新画板重排。
- 访客例外：用户明确授权最小公开资料 API/middleware 修改：public-catalog.ts、public-duanju.ts、api/public/catalog/route.ts、middleware.ts、duanju/page.tsx 外层。五类均可浏览，作品点击登录，redirect 保留片名/年份/类型；私有片源配置、播放接口和房间加入未开放；无新依赖、存储键或 Socket 事件。
- DESIGN.md、DETAIL.md、PROGRESS.md 记录已确认修订；禁区 server/、useWatchRoom、usePlaySync、session.ts、LegacyPlaybackSurface 未修改。本地 Git 基线 7137443 保留，没有提交、部署、Gemini。

## 2. 对照方法和逐页结果

同一专用 Chromium 比较本地 HTML 和应用；两边注入 Microsoft YaHei 回退字体；几何容差 ±2px。字体以 TYPOGRAPHY 覆盖，不把旧 76px、负字距、居中分类等复刻。字体文件按用户要求未接入。

测量代码、配对规则与容差未修改。修正了验收清单中的参考选择器：注入字体会把 inline style 规范化为空格写法，原组合字符串不能匹配卡片；最终增加等价选择器并拆开连续属性。首轮卡片覆盖不足，因此下列原始条数不能用作修正工作量或百分比指标。

| 页面/主题            | 实际截图尺寸 | 修正前原始必修 | 修正后原始必修 |
| -------------------- | -----------: | -------------: | -------------: |
| home-desktop-dark    |    1280×1872 |             95 |             23 |
| home-desktop-light   |    1280×1872 |             91 |             23 |
| home-phone-dark      |      390×844 |             22 |              0 |
| home-phone-light     |      390×844 |             18 |              0 |
| room-desktop-dark    |     1280×860 |             64 |             17 |
| room-desktop-light   |     1280×860 |             63 |             17 |
| room-phone-dark      |      390×844 |              9 |              9 |
| room-phone-light     |      390×844 |              9 |              9 |
| detail-desktop-dark  |     1280×960 |             27 |              6 |
| detail-desktop-light |     1280×960 |             26 |              6 |
| detail-phone-dark    |      390×844 |             33 |             11 |
| detail-phone-light   |      390×844 |             33 |             11 |

原始剩余 132 条不是 132 处已确认的应用错误。逐条解释在 pages/各页面/reviewed.csv 和 reviewed.json；保留对应的原始数值、选择器与分类，不覆盖原始 diff。

- 重复配对：同名 7.2 跨 Hero 与海报；查看全部把海报底部按钮配到继续观看标题行。正确海报底部按钮 x583、宽 114、高 44，y1661.125 对参考 1663.125，在 2px 内。
- 未绘制属性：layoutId 选中块在子元素，原脚本比较父按钮透明背景；未选中透明按钮圆角没有绘制。
- 用户已确认：真实一房/两房数量与创建卡顺序，额外模块和常驻聊天，手机下方小链接使片单下移；详情缺英文原名导致评分/动作上移；无收藏按钮 168px；44px 命中区；主题和更多。
- 字体覆盖：13→14px 的信息、22→24px 小标题使行宽/居中坐标变化；单列，不据此更改 TYPO 规范。

本轮未偷偷修改脚本以把以上归零。已向用户请求是否允许仅修复已证实的配对错误并录入批准差异后重测；这仍是完成原始自动表清零的下一步。人工归类表用于审阅，不能冒充自动全 0 结论。

## 3. 浏览器与行为证据

- 12 组桌面/手机深浅对照：pages/目录包含 before/、after/截图、差异、测量数据和并排 HTML。
- 820 三页深浅、访客 390/820/1280 深浅、五类点击登录、房间播放态、个人观看、清空确认等补充图在 supplement/。访客五类有真实点击操作，四个私有接口返回 401；数据列表采用受控资料 fixture，不冒充真实上游验证。
- 更多：1280/390 按钮 44×44、条目 44px/14px，方向键、Esc 先关菜单、返回焦点、第二次 Esc 关详情通过；无照片/纠错数据的入口不显示。
- 主题：三项 44px/14px、浅色与跟随系统切换、44px 顶栏图标通过；OS 减少动态与直接 html 属性检查通过；关闭模糊时顶栏计算值 none。没有把直接属性检查写成已操作设置页开关。
- 个人观看：新增入口走真实 room:following 确认。折叠、恢复、个人观看、回到同步、搜索往返均同一 video；小窗在占位卡下方 16px，不盖文字/按钮或聊天。桌面角标实测 44×44 且命中点没有被视频遮挡。
- 个人播放连续性：0.011→2.503 秒，视频数 1，无 pause/emptied/abort；折叠/恢复/往返搜索仍同节点。同步房间快照原本停在短片结尾，返回同步时遵从该暂停快照，因此没有把整个个人 → 同步流程写成不暂停证明。
- 请求保护：DetailPanel 直接 fetch12→12，表达式与顺序一致；数据 effect9→9，函数体与依赖一致。此轮没有重录真实外部网络清单，AST 结果不是实测网络次数。

证据 JSON 在 evidence/。部分补拍曾遇到浏览器 ERR_NO_BUFFER_SPACE/ChunkLoadError、浏览器 Node 原生崩溃及读取瞬时未 ready 视频的验收脚本错误；保留验证边界，不归因为应用源码或宣称根因已定位。最终播放补拍结果以 room-playing.json 和报告末尾补充状态为准。

## 4. 串行验证（预览关闭后）

| 命令                               | 结果                                         |
| ---------------------------------- | -------------------------------------------- |
| pnpm typecheck                     | 退出 0                                       |
| pnpm lint                          | 退出 1，81 个既有错误                        |
| pnpm test -- --runInBand           | 退出 0，40 套件/246 项                       |
| pnpm format:check                  | 退出 1，991 文件问题，含旧源码/参考/验收产物 |
| pnpm test:rooms                    | 退出 0，19/19                                |
| 目标展示文件 check-design          | 退出 0，违规 0/TODO0                         |
| 目标新增展示/房间/确认 scoped lint | 退出 0                                       |

没有全局格式化。日志在 checks/；本轮备份全部.bak/.txt，output 源码扩展扫描为 0。原生崩溃根因仍未知，最新 typecheck 成功不解释此前失败。

## 5. 未验证、下一步与包内容

未验证：Safari/Firefox、真机、真实豆瓣/TMDB/CMS 短剧上游、登录后真实片源解析、HLS 长时播放与双客户端同步；短剧资料仅首个配置源/根分类，真实源根分类为空或需子分类的情况未实测。记录面板其他旧彩色未做 P5 套皮。820 只有响应式补图，没有静态 820 画板。

需要用户决定：是否允许修复原始配对工具的已证实错误并录入已批准差异后重测，使原始必修统计达到 0；此前页面/数据/入口决定已落实，不再重复询问。

本包仅报告、截图、差异表、测量和验证日志；不含源码、脚本、备份、私有数据库、随机密码、认证状态或开发日志。没有删除临时数据库、凭据或已有验收包。

最终补拍状态：房间 1280/820/390 深浅 6 组成功，video.readyState=4，桌面常驻聊天、移动三标签及切换通过；最终图和证据已更新。
