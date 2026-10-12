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
