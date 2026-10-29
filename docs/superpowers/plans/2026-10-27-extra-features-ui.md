# 附加功能界面优化实施计划

> 执行方式：Codex 在独立工作区按顺序实施。用户已明确授权全部 UI 决策、布局重排与适配，要求不再提问；不提交、不推送、不部署。

**目标：** 全面检查附加内容与辅助工具页面，使其导航、内容层级、交互反馈、触屏和键盘操作与全站主题一致。

**架构：** 保留已有 Next.js / React / Tailwind、数据请求与业务回调；通过 media 与 music 共用组件修复共性问题，再局部调整独立页面。不修改服务器、API、数据库、播放会话、房间协议或相邻项目。

**依据：** 用户本次授权与 docs/design/DESIGN.md（主题 token、1320px 容器、12px 最小字、44px 点按、focus-visible、减少动态与无模糊）。本次授权覆盖旧 §5.3 的不重排限制。

## 顺序与文件

- [x] 盘点全部附加路由与子页，保留基线验证，记录具体缺陷。
- [x] 电子书 / 漫画：`src/components/media/{MediaShell,MediaGrid,MediaSectionHeader,MediaPressCard,MediaCard,ContinueReadingCard}.tsx`、`library.ts`、`src/styles/media.css` 与 `src/app/{books,manga}/**/page.tsx`。统一页头、可见的二级导航、书架菜单入口、封面尺寸、详情与章节排列、搜索和来源卡。
- [x] 阅读器：`src/components/{books/BooksLayout,manga/MangaLayout}.tsx` 与两套 `read/page.tsx`。仅改展示和浮层可达性，保持阅读模式、翻页、缓存、TTS 与进度逻辑。短横屏 / 安全区 / 章节与设置浮层需重点验收。
- [x] 音乐：`src/components/music/*`、`src/app/music/music.css` 和必要子页；主 `MusicClient.tsx` 只做最少展示修改（Claude 另有未提交修改，整合时注意冲突）。处理窄屏按钮、歌曲操作、弹层和悬停 / 聚焦。
- [x] 逐页检查直播、网络直播、私人影库、源站寻片、高级推荐、短剧、求片、反馈、关于及账号辅助入口；必要修复仅在展示层，已符合规范的页面不为改而改。TV 专用页面也检查布局，不改播放器。
- [x] 运行 typecheck / lint / Jest / format:check、设计检查和 diff 边界核对。涉及房间才运行 rooms。
- [x] 完成验证后启动独立 3107 端口预览；真实 Edge 从 1440×900 开始，检查 390 / 820 / 1280 深浅主题、320 窄屏、短横屏与宽屏。使用本地模拟来源展示满数据、长标题、空 / 错误状态，明确模拟与真实上游的边界，截图放 `output/playwright/extra-features-ui-20261027/`。
- [x] 汇总路由检查矩阵、缺陷与证据，更新 `docs/design/PROGRESS.md`，保留可合并分支 `codex/extra-features-ui`。

## 风险与验收重点

1. 当前主目录有另一任务未提交修改；本分支基于已提交 `6c7efad`，不拷贝其他任务的改动。
2. 共用 media 组件同时影响小说与漫画，必须覆盖两套满数据与空态。
3. 可滚动导航需要明确当前项，焦点不能被裁掉；长标题不撑开列。
4. 弹层在低高度设备上应能滚动到关闭 / 确认按钮；底部控件避开安全区与站点导航。
5. 浏览器模拟只证明展示与交互，不证明真实书源、音乐源、设备软键盘或 TV 遥控兼容。

## 执行记录

- 已建立原生管理工作区 `C:/Users/ss/.codex/worktrees/extra-features-ui/TongMuTVPlus` 与分支；依赖按原锁文件离线安装，无新增依赖。
- 已核对选中标签 `bg-raised text-inverse` 的前景 / 背景不匹配、手机详情全宽封面、书架只有隐藏手势菜单、音乐操作尺寸不足等代码事实。基线与后续完整 Jest 已验证；最终类型 / lint / 格式通过，完整 Jest 123 套 / 671 项、房间 21/21；各路由与设备证据见最终报告。
