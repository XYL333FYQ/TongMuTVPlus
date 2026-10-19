# AGENTS.md

## 项目

TongMuTV Plus：Next.js 14（App Router）+ React 18 + Tailwind 3.4 + TypeScript 4.9。
两个平级功能：自己看电影、同步观影房间（Socket.IO）。上游为 MoonTVPlus。

## 你的角色

你是实现者。界面设计已定，依据是 `docs/design/DESIGN.md` 和 `docs/design/reference/`。

- 不要重新设计，不要自己发挥。
- 规范没写的地方：停下来问；或选最保守的方案，并在汇报里标出。

## 开工前

1. 读 `docs/design/DESIGN.md`、`docs/requirements.md`、`docs/architecture.md`。
2. 先给计划（要改的文件、顺序、风险），等用户确认再改。任务里写了"直接做"才可以直接改。

## 禁区：只换皮，不改行为

- 不改：`server/`（若存在）、`src/hooks/useWatchRoom.ts`、`src/hooks/usePlaySync.ts`、`src/features/playback/session.ts`、`PlaybackSessionProvider` 的会话逻辑、`src/lib/*.db.ts`、`src/app/api/**`、`src/middleware.ts`、`src/app/admin/page.tsx`。
- `LegacyPlaybackSurface.tsx`：只允许改 className、样式、文案，逐处说明；不碰内部逻辑。
- 不改接口、存储键、Socket 事件名、数据库路径（见 `docs/PROJECT_IDENTITY.md`）。
- 不新增依赖。已有可用：framer-motion、next-themes、lucide-react。确需新增，先问。
- 不要 git init / commit / push / 部署，除非用户明确要求。
- 不删除任何现有路由。入口要移动或隐藏时，必须说明。

## 视觉硬规则（违反即返工）

- 颜色只用 `--tm-*` token，不写死 hex。唯一彩色是报错红 `--tm-danger`。
- 新写的代码禁用 Tailwind 彩色类（green、purple、indigo、amber、rose、emerald、pink、orange、blue 等）。
- 禁用 `bg-gradient-*`。DESIGN.md 明确列出的聚光、玻璃高光、骨架扫光、Hero 底部压暗遮罩除外。
- 最小字号 12px。手机点按目标 ≥ 44px。所有可点元素有 `:focus-visible` 环。
- 动效遵守 DESIGN.md 第 3 节，并响应 `html[data-tm-reduced-motion]` 与 `prefers-reduced-motion`。
- 玻璃（backdrop-filter）响应 `html[data-tm-no-blur]`。
- 不用 emoji 当图标，图标用 lucide-react。
- 文案遵守 DESIGN.md 第 6 节。

## 验证（每次改完必须跑，并贴结果）

```
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
pnpm test:rooms    # 改动涉及房间时
```

- `typecheck` 失败时先保留原始日志并区分源码类型错误与环境问题。若出现没有 TS 诊断的原生崩溃（如退出码 3221225477、2147483651 等），关闭本项目预览服务，确认进程退出后串行重跑一次；仍崩溃则标记“typecheck 待用户手动验证”，继续其他验证，不因此停止或回滚。最终汇报明确写出，由用户在自己的终端运行 `pnpm typecheck` 并贴回结果；根因未知时不得写成已定位。
- `.next/types` 生成文件缺失或进程冲突等环境问题仍应先关闭预览并用项目原有方式恢复生成环境，再串行检查；不得修改 `tsconfig`、跳过类型检查或排除测试。只有源码类型错误或测试失败才恢复该批开始前的文件并停止，不能覆盖之前已验收的修改。
- 所有备份、快照和只读排版参考使用 `.txt` 或 `.bak` 扩展名，不得以 `.ts`、`.tsx`、`.d.ts` 放入会被 tsc 扫描的位置；验收前检查 `output/`。
- 批次的类型检查和测试完成后才启动预览截图；开始下一批前关闭预览/dev 并确认退出，避免生成类型与检查竞争。

- 浏览器检查：390 / 820 / 1280 三个宽度，深色和浅色各一次，附截图。
- 汇报要写清：没跑的、跑不了的、没验证的。"能编译"不等于"效果对"。

## 汇报格式

1. 改了哪些文件
2. 对应 DESIGN.md 哪一条
3. 验证结果
4. 没做的、有风险的

## 项目事实

- 全站播放器是单例，在 `src/app/layout.tsx` 的 `PlaybackSessionProvider` 层。换页面不能卸载它。
- 完整 / 小窗 / 折叠是同一个播放实例的不同形态，视频元素不得重建。
- Node 24，包管理器 pnpm，开发命令 `pnpm dev`。

## 进度记录（换人接手用）

每完成一步，更新 `docs/design/PROGRESS.md`：做完了什么、没做什么、下一步是什么、哪些没验证。
开工前先读它。同一时间只有一个工具在改这个项目。

## Gemini 委托规则（本项目）

- 委托任务文件的“必要读取”必须含 `AGENTS.md`、`docs/design/DESIGN.md`、`docs/design/p5-mapping.md`；“禁止”必须含本文件的禁区文件、不改接口/存储键/Socket 事件名、不新增依赖、不提交 Git。
- 只按 `p5-mapping.md` 替换，表里没有的原样保留并加 `/* TODO-P5: 原因 */`；不改逻辑和布局结构。
- `--allow-path` 用具体文件，不用整个目录；与任务文件的 `Delegate-Scope` 一致。
- 超过约 1500 行的文件不委托，由 Codex 用脚本或自己改，一次一个。
- 同一批 Gemini 最多返工 2 次，再不行 Codex 接手完成当前批次；未验收通过不得往下做。后续批次仍遵守用户的阶段授权。
- 验收除 skill 原有步骤外，再加：运行 `check-design.mjs` 违规为 0（TODO 除外）；核对没碰禁区；改过的页面 390 和 1280、深浅各一张截图；更新 `PROGRESS.md`，记录委托文件、返工次数、费用。原有 820 宽和项目验证要求仍适用。
- 原试运行的两页仅由 Gemini 修改；2026-10-12 用户已明确授权 Codex 接手 `about/page.tsx`、`movie-request/page.tsx` 返工。不能为返工绕过熔断。
- 委托前预检：任务文件里每个必要读取文件必须存在、可读、不在 `.gitignore` 或忽略目录里。参考资料一律放进 `docs/design/` 下。预检不过，不要调用 Gemini。
- 熔断或委托失败后：不再叫 Gemini，但不要停下等用户。把当前批次未完成的部分自己做完，汇报时说明接手了什么、为什么；不复位或绕过熔断，不擅自进入下一批。
