# 界面改造进度

> 换人接手先读这里。Codex 2026-10-10 ～ 10-18 的逐批流水账已归档在提交 `c01220f` 的本文件旧版，需要时用 `git show c01220f:docs/design/PROGRESS.md` 查看。

## 当前状态（2026-10-19，ui-redesign 分支）

方向不变（黑白灰、Apple TV 质感），重做执行与收尾整理。改动未提交，基线是 `c01220f`。

### 做完了

- **样式分层**：`src/styles/` 按 tokens → base → primitives → layout → feedback → shell → home → 播放器 → 房间 → globals 全局加载；auth / search / controls / panels / media / loading 由组件按需引入。详见 DESIGN.md「2026-10-19 — 重做执行与样式结构」。
- **共享组件**：`PageHeader`、`BackToTop`（配 `src/lib/page-scroll.ts`）、`auth/AuthVersion`；统一开关 `.tm-switch-*`、下拉筛选 `.tm-dropdown-trigger + .tm-popover`、模态框 `.tm-modal*`、提示条 `.tm-toast`、空状态 `.tm-empty`、海报栅格 `.tm-poster-grid`。
- **页面**：登录 / 注册 / OIDC 注册 / 扫码登录、我的、搜索、求片、源站寻片、短剧、高级推荐、私人影库、首页公告与直链弹窗、账号菜单与设置面板、确认框、错误提示。
- **颜色**：画面遮罩统一 `bg-ink/N`、画面上文字统一 `text-on-art(-muted)`（约 150 处 `color-mix(...room-cinema-bg...)` 收掉）；修掉多处选中态文字与底色同色、深浅主题对比不足。
- **触屏**：`pointer: coarse` 下胶囊、主题三段、文字标签、区块头链接、最近搜索删除、Hero 圆点点按区均 ≥ 44px，视觉尺寸不变；手机顶栏已显示页名时，页头不再重复标题。
- **清理**：删 FireworksCanvas（无引用）、4 个重复 CSS（并入 layout / home / controls）、music.css 死规则 130 行、`tm-card*` / `tm-btn-danger` 未用类、约 50 处两分支相同的三元式、Codex 一次性脚本 `scripts/p5-codemod*.mjs` 和过程文档（AUTONOMOUS-PLAN、p5-pilot-conclusion、p5-temp-files）；`legacy-panels.css` 改名 `panels.css`。
- `.prettierignore` 补上已被 gitignore 的本地状态与第三方构建产物。

### 验证（2026-10-19 最后一轮）

- `pnpm typecheck` 通过（中途两次 Node 原生崩溃 2147483651，串行重跑通过）。
- `pnpm test` 57 套件 331 项通过；`pnpm test:rooms` 19 项通过。
- `pnpm lint` 70 个 error 全在 `src/lib/**`、vendor 与 `src/test/*.cjs`，均为基线旧问题；UI 文件 0 error。
- `pnpm format:check` 只剩 227 个禁区文件（基线就未格式化，按规定不动）。
- 禁区文件 diff 为 0 行。
- 浏览器：/ /douban /search /my /watch-room /duanju /source-search /movie-request /about /warning /advanced-recommendation 深浅两套对比度审计 0 问题；375 宽横向溢出 0、触屏点按区 < 44px 为 0；1280 / 820 / 375 深浅抽查截图。

### 没做 / 没验证

- 直播、音乐、漫画、电子书、网络直播、私人影库、特殊源本地未配置会跳走，只做了静态检查，没看到真实画面。
- 详情页、已选片房间、真实播放未逐项重验。
- `LegacyPlaybackSurface.tsx` 只改了 className 和文案；"旧版加载款式"里的 emoji 是用户可选的旧样式，保留。
- `src/components` 已做方案 B 部分整理（见下）；上游原有组件不搬，原因：`admin/page.tsx`（禁区）直接引用其中多个组件，且会让上游 MoonTVPlus 合并大面积冲突。建议另开任务处理。
- 本机 Node 24.18 偶发 V8 原生崩溃（typecheck / lint / format / dev 都遇到过），根因未知；dev 崩溃后清 `.next/cache` 再启动可恢复。

### 下一步

1. 用户实测确认后提交（提交前跑 `/verify`）。
2. 配好直播 / 音乐 / 书籍等来源后补看这些页面。
3. `src/components` 方案 B 已完成（2026-10-19）：36 个文件（23 个自有组件及其测试）搬入 `shell/ catalog/ feedback/ account/`，import 统一为 `@/components/<域>/<名>`；`AnimeSubscriptionComponent / CorrectDialog / DataMigration / PageLayout / WatchRoomProvider` 留原位。验证：typecheck 通过、test 57 套件 331 项、test:rooms 19 项、lint 69 error（≤ 基线 70）、禁区 diff 0。「自有 / 上游」是按重做新增和带测试的文件判断的，仓库无上游历史，可能有遗漏。
