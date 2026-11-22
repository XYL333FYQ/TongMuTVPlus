# AGENTS.md

## 项目

TongMuTV Plus：Next.js 15（App Router）+ React 18 + TypeScript 5 + Socket.IO 4 + Artplayer 5，Tailwind 3.4 只留给上游页面。Node 24，包管理器 pnpm，开发命令 `pnpm dev`。

两个平级功能：自己看（`src/features/playback`）和同步观影房间（一起看）。项目起点是 MoonTVPlus，已独立发展，不再和上游合并。

## 开工前必读

1. `docs/STANDARD.md`：代码规范（目录、依赖方向、命名、样式写法、块名登记表、层级表）。**新代码先对照它，再对照旁边的文件。** 公共零件登记表（每个公共零件的唯一主人）、三档范围、术语表也在这份文件里。
2. `docs/design/PROGRESS.md`：做到哪了、没验证什么。每完成一步更新它。
3. 动界面：`docs/design/DESIGN.md`、`docs/design/ACCEPTANCE.md`（分端验收标准）。
4. 动房间或播放：`docs/architecture.md`。

同一时间只有一个工具在改这个项目。

## 规矩

- **对外的名字不改**：接口路径、Socket 事件名、存储键（localStorage / IndexedDB 的键名）、数据库路径和字段、路由（见 `docs/PROJECT_IDENTITY.md`）。内部代码可以按规范改名、搬家。
- **不新增依赖**。确需新增，先问。
- **界面要重新设计时先出设计稿**，用户同意后再写代码。整理代码不改界面和行为。
- **改规则先问**：改待清理名单 `scripts/structure-allowlist.json`、检查范围 `scripts/structure-scope.json`、检查脚本（`scripts/check-*.mjs`、`scripts/lib/`）、`.eslintrc.js`，或删改已有测试，都要先问用户。修好旧账后用 `--shrink` 让名单变短不用问。
- **不打补丁**：出了问题不要再加一条更高优先级的 CSS、更大的 z-index 或一个特判去压住；先查是不是重复模块、规则打架、死代码，从根上改。同一件事只能有一个来源。
- **提交、推送、部署**只在用户明确要求时做。
- **仓库只有一个 `main` 分支**：直接提交到 main，不建功能分支、不开 PR，也不启用会自动开分支的机器人（Dependabot 等）。用过的临时分支和工作区用完即删。
- 不删除现有路由。入口要移动或隐藏时说明。
- 房间同步是 SyncTV 模型（权限按账号、单一带版本的播放状态、服务器时钟推算，见 `docs/architecture.md`）。不要恢复“唯一主持设备”选举，也不要恢复“个人观看 / 跟随”半脱离状态。改房间时同时更新 `server/room-service.test.cjs`、同步引擎和播放器接口的测试，并用两个账号实际验证同步。

## 视觉硬规则

- 颜色只用 `--tm-*` 令牌，不写死 hex。唯一的彩色是报错红 `--tm-danger`。
- 不用 Tailwind 彩色类，不用 `bg-gradient-*`（DESIGN.md 明确列出的聚光、玻璃高光、骨架扫光、Hero 底部压暗除外）。
- 最小字号 12px；手机点按目标 ≥ 44px；所有可点元素有 `:focus-visible` 环。
- 动效遵守 DESIGN.md 第 3 节，响应 `html[data-tm-reduced-motion]` 和 `prefers-reduced-motion`；玻璃（backdrop-filter）响应 `html[data-tm-no-blur]`。
- 图标用 lucide-react，不用 emoji。文案遵守 DESIGN.md 第 6 节。

## 验证（每次改完都跑，并贴结果）

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rooms
pnpm format:check
pnpm check:structure
pnpm check:lint
pnpm check:design
node --test scripts/lib/*.test.mjs scripts/check-design.test.mjs
node scripts/check-design.mjs <改过的文件>
```

- **用 Node 24 跑**（`.nvmrc`）。这台机器 PATH 上默认是 Node 26，先切：PowerShell `$env:Path = "$env:USERPROFILE\tools\node;" + $env:Path`，Git Bash `export PATH="/c/Users/XYL/tools/node:$PATH"`，再 `node -v` 确认是 `v24.x`。
- **提交钩子**：第一次检出后执行 `git config core.hooksPath scripts/git-hooks`，提交前会自动跑结构检查、设计检查和暂存文件的格式检查。不要用 `--no-verify` 跳过。
- `check:lint` 和 `check:structure` 的旧账只许减少；修好后用 `--shrink` 写回名单，规则见 `docs/STANDARD.md` S10。
- **最后一次修改之后再完整跑一遍**，再提交。
- Windows 上 Node 会随机原生崩溃（退出码 3221225477、139 之类，没有 TS 诊断）：关掉本项目的预览服务后重跑；仍崩溃就写明“待用户在自己终端运行”，不要改 `tsconfig`、跳过检查或排除测试。
- 浏览器检查按 `docs/design/ACCEPTANCE.md` 分端过：手机竖屏、手机横屏、平板、电脑（网页 / 客户端），深色和浅色。整理样式时用“改前改后计算样式对比”，差异必须为空或逐条解释。
- 备份、快照用 `.txt` / `.bak` 扩展名，不放进会被 tsc 扫描的位置。截图和导出物不进 git。
- 汇报写清：改了哪些文件、对应规范哪一条、验证结果、没跑的 / 跑不了的 / 没验证的。“能编译”不等于“效果对”。

## 项目事实

- 自己看的播放器是单例，在根布局的 `PlaybackSessionProvider` 层。换页面不能卸载它；完整 / 小窗 / 收起是同一个播放实例，视频元素不重建。
- 房间播放器也是单例，在根布局的房间会话里。房间页是大画面，离开房间页转到房间小窗继续同步，同一个视频元素在两处之间搬家；自己看开始播放时房间画面先停（人还在房间里）。
- 设备档位只在 `src/lib/device-tier.ts` 定义（phone / phone-landscape / tablet / wide），整页排版只认它。
