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

### 2026-10-19 第二轮（用户实测反馈后）

- 通栏布局（去掉两侧大块留白）、通栏首页大图、海报/房间卡悬停动效、访客登录入口等，细则见 DESIGN.md「2026-10-19 — 通栏布局、通栏大图与卡片动效」。
- 修掉：大图文字没垂直居中（framer 的 scale 内联 transform 覆盖了 CSS 定位）、左箭头压住文字、浅色大图后的矩形亮区、浅色投影过重、片库卡片满屏「电影」、房间页访客灰标签、「公开」实为需密码。
- 验证：typecheck 通过；test 57 套件 331 项；test:rooms 19 项；1600 宽深浅首页与片库截图、对比度审计 0；375 宽横向溢出 0、点按区 < 44px 为 0。房间卡悬停用注入的同构卡片核对了规则生效（测试账号当前在房间里，没退出房间去看真实列表）。

### 2026-10-19 第三轮（用户实测反馈后）

- 管理面板进不去：Windows 自带环境变量 `USERNAME`（系统登录名）在 `pnpm dev` 下盖住了 `.env` 的 `USERNAME=admin`，管理接口把 admin 当普通用户拒绝。新增 `scripts/dev-env.cjs`，`pnpm dev` 用 `node -r` 先加载：只在 Windows 且 `USERNAME` 等于系统登录名时改用 `.env` 的值。接口和禁区文件未动。验证：`/api/admin/config` 由 401 变 200（owner）。双击 `启动TongMuTVPlus.cmd` 本来就没有这个问题。
- 大图铺满并跟随主题、房间页放映屏与面板、账号菜单分组、首页并排区与直链卡，细则见 DESIGN.md「2026-10-19 — 大图跟随主题、房间屏幕、账号菜单分组」。
- 验证：typecheck 通过；test 57 套件 331 项；test:rooms 19 项；lint 69 error（与基线相同，全在旧文件）；改动文件 prettier 通过；`check-design.mjs` 违规 0；禁区 diff 0。截图（1600 / 1280 / 820 / 390，深浅各一套）在桌面「TongMuTV 截图-第三轮」。房间桌面版舞台与面板底边对齐（1600：750/750，1280：680/680），各宽度无横向溢出。
- 没验证：轮播数据源切 TX 后的横图效果（等用户在管理面板切换）；房间正在播放时的新布局；管理面板内部仍是上游原样（蓝色按钮等），在禁区里未换皮。

### 验证（2026-10-19 第一轮）

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

1. 用户实测确认后提交（提交前跑 `/verify`）。管理面板切 TX 后再看一次大图。
2. 配好直播 / 音乐 / 书籍等来源后补看这些页面。
3. `src/components` 方案 B 已完成（2026-10-19）：36 个文件（23 个自有组件及其测试）搬入 `shell/ catalog/ feedback/ account/`，import 统一为 `@/components/<域>/<名>`；`AnimeSubscriptionComponent / CorrectDialog / DataMigration / PageLayout / WatchRoomProvider` 留原位。验证：typecheck 通过、test 57 套件 331 项、test:rooms 19 项、lint 69 error（≤ 基线 70）、禁区 diff 0。「自有 / 上游」是按重做新增和带测试的文件判断的，仓库无上游历史，可能有遗漏。
