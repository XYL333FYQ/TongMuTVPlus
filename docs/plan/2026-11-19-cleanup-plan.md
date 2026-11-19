# 整理计划（2026-11-19 定，压缩上下文后照此执行）

> 这份文件是执行依据。压缩后的会话先完整读它，再读 `docs/design/PROGRESS.md` 和 `AGENTS.md`。
> 规范的来源：排查报告 https://claude.ai/artifact/1u3QQPkM39hrYGQxkffn15 （内容已全部抄进本文件，不依赖报告）。

## 一、用户已经定下的事

1. **目标**：代码要像一个人按一套规矩写的。“砌墙”：不要每段看着工整、拼起来砖头颜色大小都不一样。
2. **范围**：只整理用户自己做的部分——站点外壳、顶部三个页面（发现 `/`、片库 `/douban`、房间 `/watch-room`）、播放页 `/play`，以及它们共用的组件、样式、工具。漫画、小说、音乐、直播、网络直播、电视、管理后台这些上游页面这次不动。
3. **不再和上游 MoonTVPlus 合并**，当成自己的项目。
4. **禁区**（AGENTS.md 里列的）：我判断需要改就改；但对外的名字不动——接口路径、Socket 事件名、存储键（localStorage / IndexedDB 的键名）、数据库路径和字段。
5. **规范由我定**（第二节），先写进仓库，再照着改。
6. **整理不许改出新 bug**：每一步只换结构、不改行为，逐步验证（第五节）。
7. **部署**：现在只用 Docker；Vercel、Cloudflare、EdgeOne、Render 的能力必须保留并且真的能用（“可以不用，但是不能没有”）。整理，不删除。
8. **垃圾直接删**，不归档：提交在 git 里的截图、空文件、过时文档。
9. **README**：用已确认的草稿（`docs/plan/README.draft.md`）替换；图片先用现在 `docs/images/` 里的 4 张，用户以后自己截新图发过来再换。不许随便找图。
10. **界面重新设计要先出设计稿**，用户同意后才写代码。所以这次播放器整理**只换内核、不改界面**；播放页改版另做。
11. **提交和推送**：每一步验证通过后单独提交并推送到 GitHub（用户 11-19 同意推送）。推送后看 GitHub 构建是否通过，没过就先修好再进下一步。

## 二、规范（写进 `docs/STANDARD.md`）

原则：同一件事只有一个来源、一个名字、一种写法。尽量沿用项目里已经写得最好的部分。

**目标目录**

```
src/
  app/          路由入口：取参数 + 渲染某个 feature 的页面组件，不放业务逻辑
  features/     一个功能一个文件夹：组件、hooks、样式、测试都在里面，对外只暴露 index.ts
    shell/      站点外壳：顶栏、底栏、导航、手势、PWA、客户端桥接、沉浸模式
    discover/   发现（首页）
    library/    片库
    room/       一起看：大厅、房间页、会话、房间小窗、同步、语音、共享屏幕、活动
    playback/   自己看：播放页、会话、小窗
    player/     播放器内核（两边共用）：WatchPlayer + 通用插件
  components/   通用界面零件：不认识任何 feature
  hooks/        跨功能、不带业务的 hooks
  lib/          纯逻辑和数据访问：不引 React 组件
  styles/       全局：令牌、基础、通用零件样式
  types/        跨功能共享的类型
```

- **S1 依赖方向**：`app → features → components / hooks → lib`。`components`、`hooks`、`lib` 不能引 `features`。feature 之间只经对方的 `index.ts`。用 ESLint `no-restricted-imports` 强制。
- **S2 一件事一个来源**：一套播放器内核（`features/player`）；令牌只在 `styles/tokens.css`；z-index 只用层级令牌；时间格式化、本地存储读写、点外面关闭各一个工具。
- **S3 一个东西一个名字**：一起看在代码里叫 `room`，自己看叫 `playback`。不再用 Legacy / solo / standalone / together / tc。对外名字（路由 `/watch-room`、接口、事件、存储键）不变。
- **S4 样式只有一种写法**：核心功能用“组件旁边的 CSS 文件 + `tm-` 类名”，由组件自己 import。核心功能里不用 Tailwind 工具类（Tailwind 留给上游页面）。类名 `tm-<块>-<元素>`，块名在 `STANDARD.md` 的登记表里，一个块只属于一个文件。样式文件只管自己的块，不跨功能改别人的元素。
- **S5 改样式就改原规则**：不许在末尾追加“第几轮 / 对齐 / 收紧”段落覆盖前面；整页排版只认设备档位和 `data-layout`，不写像素宽度媒体查询；`!important` 只用于压 Artplayer 等第三方，集中在一个文件。
- **S6 文件大小与职责**：一个文件一件事，超过约 400 行要拆；页面组件只拼装，数据请求在 hooks，计算在 lib；不留只转发一行的空壳文件。
- **S7 命名**：组件 `PascalCase.tsx`，hooks `useXxx.ts`，其他 `kebab-case.ts`；测试和被测文件放一起 `Xxx.test.tsx`；标识符英文；注释中文，写为什么，不写日期和轮次；测试名英文。
- **S8 类型**：核心功能不许整文件 `eslint-disable`；不用 `any`，Artplayer 等无类型库在一个声明文件里写好类型。
- **S9 仓库**：根目录只放配置和入口说明；文档集中在 `docs/` 并有目录页；截图、导出物不进 git。
- **S10 机器守规矩**：能自动检查的都写成检查，进 CI，违反就失败。

**z-index 层级表**（令牌写进 `tokens.css`，数值按现状对齐，执行时逐个核对现有用途再定稿）：页面内容 `--tm-z-content` 0；局部浮起 1–3 不算层级，可以写数字；小窗 `--tm-z-mini` 600；顶栏 `--tm-z-header` 620；导航 `--tm-z-nav` 640；浮层 / 弹窗 `--tm-z-overlay` 1000（`--tm-z-modal` 并入它）；提示 `--tm-z-toast`；最顶层（全屏播放器等）`--tm-z-top`。现有写死的 85、86、999、9999、10000、2147483000 等全部换成令牌。

## 三、执行顺序

每一步：改 → 第五节验证 → 更新 `docs/design/PROGRESS.md` → 本地提交。一步没过不进下一步。

### 第 0 步：立模具

1. 写 `docs/STANDARD.md`（第二节全文 + 块名登记表 + 层级表 + 目录图）。
2. 重写 `AGENTS.md`：删掉 Gemini 委托规则和过时禁区；版本改成 Next.js 15、TypeScript 5；保留验证命令、对外名字不动、不加依赖要先问、提交 / 推送要用户说（本次整理已获准）、改版先出设计稿、分端验收（`docs/design/ACCEPTANCE.md`）、房间两个账号验证；指向 `STANDARD.md`。删除空的 `GEMINI.md`。
3. 加检查（`scripts/check-structure.mjs` + `pnpm check:structure`，接进 `.github/workflows/checks.yml`）：
   - 令牌（`:root` / `html.light` 里定义 `--tm-*`）只能在 `styles/tokens.css`；
   - z-index 只能是 `var(--tm-z-*)` 或 -1~3；
   - `features/**` 的 CSS 不许写像素宽度媒体查询；
   - 文件超过 400 行列出提醒（只提醒）；
   - `features/**` 不许整文件 `eslint-disable`。
   - ESLint 加 `no-restricted-imports`：`components/`、`hooks/`、`lib/` 不能引 `@/features/*`；feature 之间只能引 `@/features/<名>`（index）。
   - 现有违规先写进一个“待清理名单”，后面每一步做完就从名单里删掉对应项；全部做完时名单必须为空。

### 第 1 步：零风险清理

1. 删空壳 `src/features/playback/useMiniPlayerDrag.ts`、`src/features/playback/useAudioFocus.ts`，引用改到真身（含测试）。
2. `art-keyboard.ts` 两份一字不差：删 `src/features/playback/art-keyboard.ts` 和它的测试，自己看改用 `features/together/player/core/art-keyboard.ts`（第 4 步随内核一起搬家）。
3. 删 `src/components/catalog/Shelf.tsx`（没人引用）。
4. 删死样式：`home.css` 14 个（老首页房间卡片 `tm-home-room-*`、`tm-home-hero-poster-left/right`、`tm-home-compact-grid`、`tm-home-resume-name`、`tm-room-card-glyph` 等）、`tm-chat-launcher`（auth.css、layout.css）、`tm-return-room`、`tm-chat-messages`、`tm-dot`、`tm-t-tab`。删前逐个 grep 确认没有动态拼接。
5. 令牌归位：`playback.css`、`detail.css`、`mini-player.css` 开头的 `:root`，`detail.css` 的 `html.light`，`playback.css` 的手机档 `:root:where(...)`，全部搬进 `tokens.css`；`--tm-z-mini` 搬进去；`--tm-z-modal` 改用 `--tm-z-overlay`；按层级表替换全部写死的 z-index。
6. 仓库清理（`git rm`）：`screenshots/`（244 张）、`references/`、`GEMINI.md`、`AUDIT.md`（10 月的放映室审查，已过时）、`docs/design/p5-mapping.md`、`docs/design/CLIENT-EXPERIENCE-*.md`（3 份）、`docs/design/REBUILD-PLAN.md`（已完成）、`docs/optimization-plan.md`、`docs/implementation-status.md`、`docs/verification/`、`docs/superpowers/`。每个删前打开看一眼，确认是过时记录；有仍然有效的内容就并进对应的现行文档。`.gitignore` 加 `screenshots/`。
7. 更新日志：`CHANGELOG` 是上游的版本记录，`PROJECT_CHANGELOG` 是本项目的。保留本项目那份，改名为 `CHANGELOG.md`；上游那份删掉（git 历史里有）。
8. `output/` 本来不在 git 里。里面的 `branch-backup/` 是 11-15 删旧分支前的备份包，用户确认没用：**整个 `output/` 删掉**（先看一眼里面还有什么，只有导出物和这个备份就全删），`.gitignore` 保留对它的忽略。
9. 部署能力（只整理不删除，全部要“真的能用”）：
   - `render.yaml`：现在指向上游镜像 `ghcr.io/mtvpls/moontvplus`、服务名 `moontvplus`，改成本项目镜像 `ghcr.io/xyl333fyq/tongmutvplus:latest` 和本项目名字。
   - `wrangler.toml`：名字 `moontv-plus` 改成本项目名；检查 `open-next.config.ts` 和 `.github/workflows/cloudflare-deploy.yml`。
   - `vercel.json`、`edgeone.json`、`.env.edgeone.example`、`.github/workflows/edgeone-deploy.yml`、`docker-image-lite.yml`、`Dockerfile.lite`、`turso-migrate.yml`：逐个检查有没有上游名字、失效路径。
   - 写一份 `docs/deploy.md`：每个平台怎么部署、用哪些文件、这些平台上一起看要接外部房间服务（`WATCH_ROOM_SERVER_TYPE=external` + `WATCH_ROOM_EXTERNAL_SERVER_URL`）。`VERCEL_DEPLOYMENT.md` 并进去。平台规定必须在根目录的文件（`vercel.json`、`wrangler.toml`、`edgeone.json`、`render.yaml`）留在根目录，在文档里写原因。
   - 验证：能在本机跑的构建都跑一次（`pnpm build:edgeone`、OpenNext 的 Cloudflare 构建、`next build`；Windows 上 standalone 可能 EPERM，那就看 CI）；跑不了的写清楚“没验证”。
   - `start.js`、`server.js`、`start.sh`、`启动TongMuTVPlus.cmd`、`docker-entrypoint.sh`、`proxy.worker.js` 是各平台入口，不动。
10. README：用 `docs/plan/README.draft.md` 替换 `README.md`；`README_en.md` 照着中文版重写成英文。GitHub 简介和标签：**由我用 `gh repo edit` 改**（用户已同意），文字见第六节；改完用 `gh repo view` 确认。

### 第 2 步：一起看归位（`features/room`）

1. 搬家：
   - `src/features/together/*` → `src/features/room/*`（播放器内核 `player/core` 先留在原处，第 4 步再搬到 `features/player`）。
   - `src/hooks/` 里的 `useWatchRoom`、`useVoiceChat`、`useScreenShare`、`useRoomLiveActivity`、`useRoomMusicActivity`、`useWebLiveSync`（及测试）→ `features/room/hooks/`。
   - `src/components/WatchRoomProvider.tsx` → `features/room/session/`。
   - `src/app/watch-room/{music,screen,select}/page.tsx`：路由文件留在 `app/`，页面内容搬到 `features/room/pages/`，路由文件只剩几行。
   - `src/types/watch-room.ts` → `features/room/types.ts`（37 个文件引用，全部改引用；`server/` 是 cjs 不引它，再 grep 确认）。
   - `playback.css` 里的房间样式（`.tm-room-live-*`、`.tm-activity-*`）搬到房间。
   - 上游页面（`app/live`、`app/web-live`、`app/music`）对这些 hooks 的引用改成从 `@/features/room` 引。
2. 改名（内部）：TogetherRoute → RoomRoute，TogetherSession → RoomSession，useTogetherSession → useRoomSession，等等。存储键（如 `tm-together-dm-self`）、Socket 事件、接口路径、路由 `/watch-room` 不改。
3. 房间样式重建：
   - `together.css`（3,628 行）按组件拆成多个文件，放在组件旁边，由组件 import。
   - 同一选择器的多次定义合并成一条（together.css 里 27 个，“和原型对齐 / 收紧尺寸 / 第三轮”三段全部消化掉）。
   - 19 处像素宽度媒体查询换成档位 / `data-layout`。
   - 类名前缀 `tm-t-` / `tm-tc-` / `tm-pl-` / `tm-act-` 统一成登记过的块名（例如 `tm-room-*`，具体在 STANDARD.md 登记）。用脚本同时改 CSS 和 TSX，再 grep `tm-t-${` 这类动态拼接逐个处理。
4. 外壳“沉浸模式”：外壳提供一个 hook（例如 `useImmersiveShell()`，在 html 上标 `data-tm-immersive`），由外壳自己的样式隐藏顶栏 / 底栏、收回外壳留白。房间页只调用它；删掉房间 CSS 里 `body:has(.tm-tc...)` 改外壳元素的规则。
5. 验证重点：所有设备的房间页、房间小窗、房间活动、两个账号同步。

### 第 3 步：发现、片库

1. `features/discover`：`app/page.tsx`（915 行）的内容搬成 `DiscoverPage` + 数据 hooks；只给首页用的 `HomeHero`、`HomeRooms`、`useHeroAutoplay`、`PosterAmbient` 等搬进来。几个页面共用的 `PosterGrid`、`SectionHeader`、`PublicPoster`、`PublicCatalogPage` 留在 `components/catalog`。
2. `features/library`：`app/douban/page.tsx`（1,148 行）同样处理。
3. VideoCard（2,197 行）：按职责拆成卡片外观 / 长按与更多菜单 / 播放跳转，样式从 `home.css`（`.tm-video-*` 43 条）搬到组件旁边。它现在引 `features/playback`（违反 S1）：纯函数（`selection-links`、`queuePlaybackHref`）搬到 `lib/`；需要知道“正在播放”的部分改成通过 props 或 `hooks/` 层的通用接口传入。`BannerCarousel`、`PublicCatalogPage` 同样处理。
4. `home.css` 拆分：首页的搬进 `features/discover`，卡片的跟卡片走，死样式删掉。
5. 这些组件里的 Tailwind 类换成 `tm-` 类（S4），显示必须一样。
6. 去掉这些文件开头的整文件 `eslint-disable`，补类型。
7. 书和漫画那套卡片（MediaCard 等）属于上游页面，这次不合并，只在 STANDARD.md 记一笔。

### 第 4 步：播放器内核统一（界面不变）

1. 先盘点：把 `LegacyPlaybackSurface.tsx`（13,583 行）里每一个功能写成清单 `docs/plan/playback-inventory.md`（选集、换源、弹幕和弹幕设置、字幕、超分 Anime4K、AI 解说、下载、截图、倍速、跳过片头片尾、播放记录、iOS 全屏、横屏锁定、音频焦点、小窗、快捷键、热力图……逐条写清入口和行为）。这份清单就是验收标准。
2. `features/together/player/core` 中两边通用的部分（WatchPlayer、hls-engine、ad-filter、art-keyboard、env、source-policy、通用插件）搬到 `features/player`；只属于房间的插件（聊天弹幕、同步流程等）留在 `features/room`。
3. 自己看重建在 `features/player` 上：拆成播放页组件、各个面板、hooks；DOM 结构和类名尽量不变，**界面看起来和现在一样**。HLS、广告过滤、链接续期、时间格式化、键盘快捷键不再单独实现。
4. 按清单逐条验收后删除 `LegacyPlaybackSurface.tsx`。
5. 这一步最大，分成多个提交；每个提交都能单独运行、单独退回。
6. 播放页**改版**不在这一步：要先出设计稿，用户同意后另做。

## 四、做完的样子

- `check:structure` 的待清理名单为空；ESLint 依赖方向规则没有例外。
- 核心功能里没有超过 400 行的文件（播放器内核里确实拆不开的，在 STANDARD.md 写明理由）。
- 令牌只在 `tokens.css`；z-index 没有裸数字；核心样式没有重复选择器、没有像素宽度媒体查询。
- 一起看的代码全部在 `features/room`，自己看在 `features/playback`，内核在 `features/player`。
- 仓库根目录和 `docs/` 只剩现行文件；各部署平台都有说明并验证过（或写明没验证的原因）。

## 五、每一步的验证方法

1. 命令全部通过（Windows 上 Node 会随机崩溃，崩溃就重跑）：
   `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm test:rooms`、`pnpm format:check`、`node scripts/check-design.mjs <改过的文件>`、`pnpm check:structure`。
   - pnpm 用 `C:/Users/XYL/tools/node`；prettier 和脚本用 `C:/Users/XYL/tools/node2411/node.exe`。
   - **提交前在最后一次修改之后完整跑一遍**（11-18 就是漏了这一步，格式检查没过，构建失败）。
2. 样式改动（第 1、2、3 步）用“改前改后对比”：写一个脚本，在 390×844、844×390、820×1180、1280×800（平板触屏 / 电脑两种排版）、1440×900，深色和浅色下，记录关键元素的位置、大小和计算后样式；改前存一份，改后再存一份，差异必须为空。有差异就逐条解释或修正。
3. 浏览器验证要登录，**由我自己登录本地测试站**（用户要求），做法：
   - 不碰用户的 `.env`，不读里面的密码。另起一个只在本机用的测试环境：新建 `.claude/test.env`（`.claude/` 已被 git 忽略），里面放我**现生成的**测试站长账号密码、`AUTH_SECRET`，以及单独的测试库 `SQLITE_DB_PATH=.data/test.db`（不碰真实的 `moontv.db`）。
   - Windows 自带的 `USERNAME` 环境变量会盖住 env 文件（见 `scripts/dev-env.cjs`），所以写一个 `.claude/test-server.cjs`：先读 `.claude/test.env` 强制覆盖这几个变量，再 `require("../server.js")`；在 `.claude/launch.json` 加一个 `tongmu-test` 配置启动它。
   - 登录后用管理接口建第二个测试账号，用来做两个账号的房间同步测试；密码同样只写在 `.claude/test.env`，不在聊天里说。
   - 测试片源用公开的测试视频（房间里直接加 `.mp4` 直链；自己看用 `/play?source=directplay&id=<网址的 base58>`）。
   - 内置浏览器窗口被隐藏时动画不跑、截图会超时：用 DOM 测量和计算样式做对比，不依赖截图。
4. 房间改动用两个账号验证同步（播放、暂停、拖进度、换集、聊天）。没有第二个账号就请用户提供或在汇报里写明没验证。
5. 每一步汇报：改了哪些文件、对应规范哪一条、验证结果、没验证的和原因。

## 六、README 和 GitHub 简介

- README 草稿：`docs/plan/README.draft.md`（用户已认可；图片用现有 4 张）。
- GitHub 简介建议：和朋友一起看电影的私人影视站：自己看 + 同步观影房间，房间弹幕、语音、共享屏幕；Docker 一键部署，附 Windows / 安卓 / 电视客户端
- 标签：保留 docker、nextjs、self-hosted、socket-io、streaming、watch-party、danmaku，加 video-player、pwa。
- 新截图由用户以后提供，到时替换 `docs/images/` 并改 README 的图片引用。

## 七、用户的回答（11-19）和还在等的事

- 旧分支备份：没用，删（第 1 步第 8 条）。
- GitHub 简介和标签：我来改（第 1 步第 10 条）。
- 推送：每步通过后推送（第一节第 11 条）。
- 登录：我自己登录本地测试站（第五节第 3 条）。
- 还在等：新截图，用户以后自己截了发过来。

## 八、做完后

- 删掉 `docs/plan/` 里已执行完的计划和草稿（计划完成后就是过时文档），提交并推送。
- 停掉测试服务，删掉 `.data/test.db`；`.claude/test.env` 和启动配置留着下次测试用。
- 更新记忆：项目结构已按 STANDARD.md 整理。
