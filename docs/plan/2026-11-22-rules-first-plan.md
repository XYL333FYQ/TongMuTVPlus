# 立规矩（第零、第一阶段）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把“一件事只有一个来源”从纸面规矩变成机器检查：旧账全部登记、只许变少，新代码一写重复就报错。这一阶段不改任何界面和行为。

**Architecture:** 在已有的结构检查（`scripts/check-structure.mjs` + 只能变短的 `scripts/structure-allowlist.json`）上扩展：

- 规范 `docs/STANDARD.md` 新增“公共零件登记表”，每行声明一个公共零件的主人和一种“原材料探测器”。
- 检查脚本统计主人以外的文件用了多少原材料，和名单里的数量比，只许减少（计数棘轮）。
- 代码警告、行内跳过检查注释、`!important` 也用同一个棘轮。
- 设计检查和以上检查都进 GitHub 自动检查，本机加 git 提交钩子。

**Tech Stack:** Node 24（`.nvmrc`）、pnpm 10.14.0、ESLint 8.57（`.eslintrc.js`）、Prettier、Jest、`node --test`、GitHub Actions。不新增任何依赖。

**Spec:** 用户 2026-11-22 认可的路线，存在长期记忆 `coherence-roadmap` 和 `coherence-inventory`。清点结果见在线文档《TongMuTV Plus 清点报告》，原则见《给 AI 立规矩》，两份 Word 在用户桌面。项目规矩见 `AGENTS.md`、`docs/STANDARD.md`。

## 开工前用户一次性拍板（批准本计划即视为同意下列默认值，有异议在批准时改）

| 编号 | 问题                                                                   | 默认值                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | 每个任务做完、全部检查通过后，能不能直接提交到 main？                  | 能直接提交（不推送）。第一阶段全部做完时，再问用户要不要推送和部署                                                                                                                                      |
| D2   | 术语表用哪些标准叫法？                                                 | 自己看 = `playback`；一起看 = 功能名，房间 = `room`；播放记录 = 历史记录类统称（界面词以出现最多的“播放记录”为准，“继续观看”只指首页那一栏）；收藏 = `favorites`。这一阶段只写术语表，不改界面文字      |
| D3   | `docs/playback-rebuild.md`（已做完的重建清单）怎么处理？               | 保留，文件开头标“已完成（2026-11-21），留作记录”                                                                                                                                                        |
| D4   | 代码警告（现有 1153 条）怎么办？                                       | 记成基线，只许减少；新代码不许新增警告                                                                                                                                                                  |
| D5   | 本机测试脚本（单人播放、双账号同步、样式快照、测试站）能不能搬进仓库？ | 搬到 `scripts/e2e/`，账号密码继续只放在被 git 忽略的 `.claude/test.env`                                                                                                                                 |
| D6   | 规范 S5 里 `!important` 的说法怎么改？                                 | 允许用于：压第三方内联样式（Artplayer）、减弱动效（`data-tm-reduced-motion` / `prefers-reduced-motion`）、关闭玻璃效果（`data-tm-no-blur`）、主题切换动画（`data-tm-theme-transition`）。其余登记为旧账 |

## 执行中的自主权

**不用问，直接做：** 本计划里写明的改动、跑检查、修自己刚引入的问题、按 D1 提交、更新 `docs/design/PROGRESS.md`。

**必须停下来问用户（攒在一起问，不要一条一条问）：**

1. 某个任务要改界面或行为才能做下去。
2. 检查发现本计划没预料到的旧问题，修它会改界面或行为。
3. 要新增依赖。
4. 要改对外名字：接口路径、Socket 事件、存储键、数据库、路由。
5. 推送、部署，或者开始第二阶段。

## Global Constraints

- 界面和行为一律不变。只改脚本、配置、文档和测试脚本的位置。
- 不新增依赖（`package.json` 的 dependencies / devDependencies 不增加任何一项）。
- 对外名字不改：接口路径、Socket 事件名、存储键（含 `moontv_*` 和 IndexedDB `MoonTVPlus`）、数据库路径和字段、路由（`docs/PROJECT_IDENTITY.md`、`docs/BRAND_COMPATIBILITY.md`）。
- 只有 `main` 分支。不建分支、不开 PR、不推送，除非用户说。
- 所有检查用 Node 24 跑：
  - Git Bash：`export PATH="/c/Users/XYL/tools/node:$PATH"`
  - PowerShell：`$env:Path = "$env:USERPROFILE\tools\node;" + $env:Path`
  - 先 `node -v` 确认是 `v24.x`。
- Windows 上 Node 会随机原生崩溃（退出码 3221225477 之类、没有 TS 报错）：先关掉本项目的预览服务再重跑。不许改 `tsconfig`、跳过检查、排除测试或用 `--no-verify`。
- 同一时间只有一个工具在改这个项目。
- 名单（`scripts/structure-allowlist.json`）里已有的类别只许变短。新类别只能在本计划规定的任务里，用 `--baseline` 第一次生成。
- 文件路径一律用正斜杠、相对仓库根目录（例：`src/features/room/view/RoomView.tsx`）。
- 测试账号密码绝不写进仓库、文档、提交信息或聊天。
- 回复用户用中文。代码标识符用英文，注释用中文（`docs/STANDARD.md` S7）。
- 起点（提交 `c11617b`，Node 24）：类型检查、代码检查（0 错误）、结构检查（名单 0 条）、格式检查、单元测试（185 组 / 1201 个）、房间测试（42 个）、运维测试、脚本测试全部通过。

## Review Focus

1. **用 `--baseline` 洗白旧账：** 名单里已经有的类别，`--baseline` 必须拒绝，不能覆盖（Task 3 测试）。
2. **改名或搬家的文件：** 旧路径的数量变 0，新路径冒出同样的数量。检查必须明确提示“像是改名”，让执行者在同一次提交里把名单的键改成新路径，数量不得增加（Task 3 测试）。
3. **Windows 路径和换行：** 名单的键必须是正斜杠路径。CRLF 文件里的计数要和 LF 一致（Task 4 测试）。
4. **ESLint 读共用范围后漏掉或多管了文件：** 核心文件仍按错误报 `any`，上游文件不报（Task 2 用 `--print-config` 抽三个文件核对）。
5. **提交钩子在 Node 26 或崩溃时卡住提交：** 钩子只警告 Node 版本、不拦；只跑快检查（Task 9 手动跑钩子计时，应在 30 秒内）。

---

### Task 0: 准备（只验证，不提交）

**Files:** 无改动

- [ ] **Step 1: 切到 Node 24**

Run: `export PATH="/c/Users/XYL/tools/node:$PATH" && node -v && pnpm -v`
Expected: `v24.22.3`、`10.14.0`

- [ ] **Step 2: 跑一遍基线**

Run: `pnpm -s typecheck && pnpm -s lint && pnpm -s check:structure && pnpm -s format:check && pnpm -s test --ci && pnpm -s test:rooms && pnpm -s test:ops`
Expected: 全部退出码 0，结构检查输出“待清理名单还剩 0 条”，单元测试 `Tests: 1201 passed`。和 Global Constraints 里的起点不一致时，先停下来报告。

### Task 1: 压缩进度文档

**Files:**

- Modify: `docs/design/PROGRESS.md`（现 1724 行）

- [ ] **Step 1: 改写成“现在的状态”**

保留三段，总长不超过 150 行：

1. **当前状态**：已完成的大块各一句（房间 SyncTV 模型、自己看换内核、代码规范两轮、依赖安全警报）。
2. **没验证 / 没做的**：从旧条目里摘出仍然成立的。真机（手机、平板、iPhone、电视 App）没测过；37 个核心文件超过 400 行；手机端“我的”页面历史卡片是直角，原因未查。
3. **最近的记录**：现在文件最上面的 5 条原样保留，其余删掉。

顶部写一行：更早的记录在 git 历史里（`git log -p -- docs/design/PROGRESS.md`），下一步见 `docs/plan/2026-11-22-rules-first-plan.md`。

- [ ] **Step 2: 验证**

Run: `wc -l docs/design/PROGRESS.md && pnpm -s format:check`
Expected: 行数 ≤ 150；格式通过。

- [ ] **Step 3: 提交**

```bash
git add docs/design/PROGRESS.md
git commit -m "docs: compress PROGRESS.md to current state"
```

### Task 2: 检查范围只有一个来源（三档）

**Files:**

- Create: `scripts/structure-scope.json`
- Modify: `scripts/lib/structure-scope.mjs`、`.eslintrc.js:148-168`
- Test: `scripts/lib/structure-scope.test.mjs`

**Interfaces:**

- Produces（`scripts/lib/structure-scope.mjs`，后续任务都用）：
  - `CORE_CSS: string[]`、`CORE_CODE: string[]`，内容和现在一样。
  - `DAILY_UPSTREAM: string[]`
  - `inScope(file: string, prefixes: string[]): boolean`，行为不变。
  - `tierOf(file: string): 1 | 2 | 3`：1 = 核心（`CORE_CODE` 或 `CORE_CSS`，排除 `excluded`），2 = `DAILY_UPSTREAM`，3 = 其余。
- `scripts/structure-scope.json` 形状：`{ "coreCss": [...], "coreCode": [...], "excluded": [...], "dailyUpstream": [...] }`。以 `/` 结尾表示目录前缀。

`dailyUpstream` 的初始内容（上游来的、但用户天天在用）：

```json
[
  "src/app/my/",
  "src/app/search/",
  "src/app/login/",
  "src/app/register/",
  "src/components/UserMenu.tsx",
  "src/components/user-menu/",
  "src/components/PlayRecordsPanel.tsx",
  "src/components/FavoritesPanel.tsx",
  "src/components/SearchPageClient.tsx",
  "src/components/SearchResultFilter.tsx",
  "src/components/EpisodeSelector.tsx",
  "src/components/DetailPanel.tsx",
  "src/components/CorrectDialog.tsx",
  "src/components/EpisodeTitleCorrectDialog.tsx",
  "src/components/DanmakuFilterSettings.tsx",
  "src/components/EpisodeFilterSettings.tsx",
  "src/components/AIChatPanel.tsx",
  "src/components/PersonalCenterPanel.tsx",
  "src/components/VersionPanel.tsx",
  "src/components/DeviceManagementPanel.tsx",
  "src/components/DownloadManagementPanel.tsx",
  "src/components/DownloadPanel.tsx",
  "src/components/OfflineDownloadPanel.tsx",
  "src/components/Drawer.tsx",
  "src/components/TrailerPickerDialog.tsx",
  "src/components/NotificationPanel.tsx",
  "src/components/DataMigration.tsx",
  "src/components/EmailSettingsPanel.tsx",
  "src/components/PansouSearch.tsx",
  "src/components/AcgSearch.tsx",
  "src/components/AnimeSubscribeModal.tsx",
  "src/components/AnimeSubscriptionComponent.tsx",
  "src/lib/db.client.ts",
  "src/lib/douban.client.ts",
  "src/lib/utils.ts",
  "src/app/api/login/",
  "src/app/api/register/",
  "src/app/api/auth/",
  "src/app/api/change-password/",
  "src/app/api/favorites/",
  "src/app/api/playrecords/",
  "src/app/api/searchhistory/",
  "src/app/api/skipconfigs/",
  "src/app/api/danmaku-filter/"
]
```

- [ ] **Step 1: 写失败的测试** `scripts/lib/structure-scope.test.mjs`（`node:test` + `node:assert/strict`）

```js
test('tierOf sorts files into three tiers', () => {
  assert.equal(tierOf('src/features/room/view/RoomView.tsx'), 1);
  assert.equal(tierOf('src/components/VideoCard.tsx'), 1);
  assert.equal(tierOf('src/components/UserMenu.tsx'), 2);
  assert.equal(tierOf('src/app/api/favorites/route.ts'), 2);
  assert.equal(tierOf('src/app/admin/page.tsx'), 3);
  assert.equal(tierOf('src/features/room/MusicPage.tsx'), 3); // excluded
});
test('core lists are unchanged', () => {
  assert.ok(CORE_CODE.includes('src/app/watch-room/'));
  assert.ok(CORE_CSS.includes('src/components/VideoCard.css'));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/lib/structure-scope.test.mjs`
Expected: FAIL（`tierOf` 未定义）

- [ ] **Step 3: 实现**

把列表搬进 `scripts/structure-scope.json`；`structure-scope.mjs` 读它并导出上面的接口。

`.eslintrc.js` 的 `no-explicit-any` 那段改成从 JSON 生成：

```js
files: scope.coreCode.map((p) => (p.endsWith('/') ? `${p}**` : p));
```

`excludedFiles` 保持测试文件，并加上 `scope.excluded`。删掉手抄的列表和“范围要一致”的注释。

- [ ] **Step 4: 跑测试确认通过，并核对 ESLint**

Run: `node --test scripts/lib/structure-scope.test.mjs`
Expected: PASS

Run:

```bash
for f in src/features/room/view/RoomView.tsx src/components/VideoCard.tsx src/app/admin/page.tsx; do
  pnpm exec eslint --print-config $f | grep -A1 '"@typescript-eslint/no-explicit-any"'
done
```

Expected：前两个是 `"error"`；第三个不是 `"error"`。

Run: `pnpm -s lint && pnpm -s check:structure`
Expected: 0 错误；名单还剩 0 条。

- [ ] **Step 5: 提交**

```bash
git add scripts/structure-scope.json scripts/lib/structure-scope.mjs scripts/lib/structure-scope.test.mjs .eslintrc.js
git commit -m "chore: one scope source with three tiers for checks and eslint"
```

### Task 3: 计数棘轮

**Files:**

- Create: `scripts/lib/ratchet.mjs`
- Test: `scripts/lib/ratchet.test.mjs`

**Interfaces:**

- Produces：
  - `formatEntry(key: string, count: number): string` → `"${key} ×${count}"`
  - `parseEntry(entry: string): { key: string, count: number }`。没有 `×N` 的旧格式按 1 计。
  - `compareCounts(category: string, found: Map<string, number>, allowed: string[], shrink: boolean): { failures: string[], next: string[] }`
    - `next` 是写回名单用的新数组，按键排序。
  - `baseline(category: string, found: Map<string, number>, allowlist: object): string[]`
    - `allowlist[category]` 已存在（哪怕是空数组）就 `throw`。

规则：

| 情况                                                | 结果                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `found` 比名单多，或名单里没有这个键                | 失败：`[cat] key ×a → ×b` / `[cat] 新增 key ×b`                         |
| 比名单少                                            | `shrink` 时写进 `next`；否则失败，提示 `--shrink`                       |
| 变成 0                                              | 同上，键从 `next` 里删掉                                                |
| 同一类别里，某个新键的数量正好等于一个变成 0 的旧键 | 失败信息里加“像是改名：旧键 → 新键，请在名单里把键改过来，数量不能增加” |

- [ ] **Step 1: 写失败的测试** `scripts/lib/ratchet.test.mjs`

```js
test('rejects growth and new keys', () => {
  const { failures } = compareCounts(
    'portal',
    new Map([
      ['a.tsx', 3],
      ['b.tsx', 1],
    ]),
    ['a.tsx ×2'],
    false
  );
  assert.equal(failures.length, 2);
});
test('shrinks only with --shrink', () => {
  assert.equal(
    compareCounts('portal', new Map([['a.tsx', 1]]), ['a.tsx ×2'], false)
      .failures.length,
    1
  );
  assert.deepEqual(
    compareCounts('portal', new Map([['a.tsx', 1]]), ['a.tsx ×2'], true).next,
    ['a.tsx ×1']
  );
});
test('drops fixed keys on shrink', () => {
  assert.deepEqual(
    compareCounts('portal', new Map(), ['a.tsx ×2'], true).next,
    []
  );
});
test('hints at renames', () => {
  const { failures } = compareCounts(
    'portal',
    new Map([['new/a.tsx', 2]]),
    ['old/a.tsx ×2'],
    false
  );
  assert.ok(failures.some((f) => f.includes('像是改名')));
});
test('baseline refuses an existing category', () => {
  assert.throws(() => baseline('portal', new Map(), { portal: [] }));
  assert.deepEqual(baseline('portal', new Map([['a.tsx', 2]]), {}), [
    'a.tsx ×2',
  ]);
});
test('old entries without a count mean 1', () => {
  assert.deepEqual(parseEntry('src/x.tsx'), { key: 'src/x.tsx', count: 1 });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/lib/ratchet.test.mjs`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `scripts/lib/ratchet.mjs`（上面五个导出）**

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/lib/ratchet.test.mjs`
Expected: PASS（6 个）

- [ ] **Step 5: 提交**

```bash
git add scripts/lib/ratchet.mjs scripts/lib/ratchet.test.mjs
git commit -m "chore: count ratchet for the shrink-only allowlist"
```

### Task 4: 公共零件登记表 + 原材料探测器

**Files:**

- Create: `scripts/lib/detectors.mjs`、`scripts/lib/parts-registry.mjs`
- Modify: `scripts/check-structure.mjs`、`docs/STANDARD.md`（新增“## 公共零件登记表”一节，放在“块名登记表”之前）、`scripts/structure-allowlist.json`（用 `--baseline` 生成）
- Test: `scripts/lib/detectors.test.mjs`、`scripts/lib/parts-registry.test.mjs`

**Interfaces:**

- Consumes：Task 2 的 `tierOf`、`inScope`；Task 3 的 `compareCounts`、`baseline`、`formatEntry`。
- Produces：
  - `DETECTORS: Record<string, { pattern: RegExp, label: string }>`，id 和正则见下表。
  - `countMatches(text: string, id: string): number`：统计前把 `\r\n` 换成 `\n`；注释里的匹配也算。
  - `readPartsRegistry(markdown: string): { rows: { part: string, owners: string[], usage: string, detector: string | null }[], problems: string[] }`
    - 表头必须是 `| 零件 | 主人 | 用法 | 检查 |`。
    - `主人` 列里可以写多个反引号路径，或写 `—` 表示没有主人。
    - `检查` 列写探测器 id，或 `—`（不自动检查、靠审查）。
    - 未知探测器 id、重复零件名，都进 `problems`。
  - `check-structure.mjs` 新参数：`--baseline <类别>`，只对名单里还不存在的类别生效（调 `baseline()`），否则退出码 1。

探测器（统计范围：`src/**/*.{ts,tsx}`，不含测试；主人路径下的文件不统计）。表格里的 `\|` 是 Markdown 转义，写进代码时是 `|`：

| id           | `pattern`                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------- |
| `portal`     | `/\bcreatePortal\s*\(/g`                                                                    |
| `storage`    | `/\b(?:localStorage\|sessionStorage)\s*\.\s*(?:getItem\|setItem\|removeItem\|clear)\s*\(/g` |
| `screen`     | `/\bmatchMedia\s*\(\|\binnerWidth\b\|\binnerHeight\b\|\bscreen\.(?:width\|height)\b/g`      |
| `player`     | `/\bnew\s+(?:Artplayer\|Hls)\s*\(\|\bflvjs\.createPlayer\s*\(/g`                            |
| `timeFormat` | `/\b(?:function\|const)\s+format\w*(?:Time\|Duration\|Clock\|Seconds)\b/g`                  |
| `toast`      | `/<Toast\b/g`                                                                               |
| `spinner`    | `/\banimate-spin\b\|\bLoader2\b/g`                                                          |
| `emoji`      | `/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu`                                                |

登记表初始内容（写进 `docs/STANDARD.md`）：

| 零件       | 主人                                                                | 用法                                                                              | 检查         |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| 弹窗层     | `src/components/feedback/` `src/components/ui/Select.tsx`           | `ModalLayer`、`ConfirmDialog`、`MobileActionSheet`、`askConfirm()`                | `portal`     |
| 浏览器存储 | `src/lib/`                                                          | 只在 lib 里读写，组件和功能调用 lib 的函数；键名不改                              | `storage`    |
| 设备档位   | `src/lib/device-tier.ts`                                            | `html[data-tm-device]` 和 device-tier 的导出                                      | `screen`     |
| 播放器     | `src/features/player/core/`                                         | `WatchPlayer`                                                                     | `player`     |
| 时间格式   | `src/lib/time.ts`                                                   | 第二阶段在这里补 `formatDuration`（必须在 lib，S1 不许 components 引用 features） | `timeFormat` |
| 提示       | `src/components/feedback/`                                          | `notify()`、`notifyError()`                                                       | `toast`      |
| 加载       | `src/components/feedback/LoadingStyle.tsx` `src/styles/loading.css` | `LoadingStyle`                                                                    | `spinner`    |
| 海报卡片   | `src/components/VideoCard.tsx` `src/components/video-card/`         | `VideoCard`                                                                       | —            |
| 图标       | —                                                                   | 只用 lucide-react，不用 emoji                                                     | `emoji`      |

`主人` 列写 `—` 表示没有主人：`owners` 为空数组，探测器不豁免任何文件。

`check-structure.mjs` 新增三项：

1. 对每个有探测器的零件，统计主人以外的文件，用 `compareCounts('parts:<id>', …)` 和名单比。
2. 主人路径不存在 → 失败。
3. `src/components/feedback/`、`src/components/ui/` 下的非测试 `.ts/.tsx` 文件，必须落在某一行的主人路径里，否则失败“公共零件未登记”。

通过时多打印一行进度，按三档分开，例如：`portal 剩 37（核心 8 / 常用上游 22 / 上游 7）`。

- [ ] **Step 1: 写失败的测试**

`detectors.test.mjs`：

```js
test('counts each ingredient', () => {
  assert.equal(
    countMatches('createPortal(a, b); createPortal(c, d)', 'portal'),
    2
  );
  assert.equal(
    countMatches(
      "localStorage.getItem('k'); sessionStorage.setItem('k', v)",
      'storage'
    ),
    2
  );
  assert.equal(
    countMatches("window.innerWidth > 3 && matchMedia('(x)')", 'screen'),
    2
  );
  assert.equal(
    countMatches(
      'new Artplayer({}); new Hls(); flvjs.createPlayer({})',
      'player'
    ),
    3
  );
  assert.equal(countMatches('const formatTime = (s) => s', 'timeFormat'), 1);
  assert.equal(countMatches("<Toast message='x' />", 'toast'), 1);
  assert.equal(countMatches("className='animate-spin'", 'spinner'), 1);
  assert.equal(countMatches("label: '🎬 电影'", 'emoji'), 1);
});
test('CRLF and LF count the same', () => {
  assert.equal(countMatches('createPortal(a)\r\ncreatePortal(b)', 'portal'), 2);
});
```

`parts-registry.test.mjs`：

```js
test('reads rows with several owners and a dash', () => {
  const md =
    '## 公共零件登记表\n\n| 零件 | 主人 | 用法 | 检查 |\n| --- | --- | --- | --- |\n| 弹窗层 | `src/components/feedback/` `src/components/ui/Select.tsx` | x | `portal` |\n| 海报卡片 | `src/components/VideoCard.tsx` | x | — |\n';
  const { rows, problems } = readPartsRegistry(md);
  assert.deepEqual(rows[0].owners, [
    'src/components/feedback/',
    'src/components/ui/Select.tsx',
  ]);
  assert.equal(rows[0].detector, 'portal');
  assert.equal(rows[1].detector, null);
  assert.deepEqual(problems, []);
});
test('a dash owner means no owner', () => {
  const md =
    '## 公共零件登记表\n\n| 零件 | 主人 | 用法 | 检查 |\n| --- | --- | --- | --- |\n| 图标 | — | x | `emoji` |\n';
  assert.deepEqual(readPartsRegistry(md).rows[0].owners, []);
});
test('flags unknown detectors and duplicate parts', () => {
  const md =
    '## 公共零件登记表\n\n| 零件 | 主人 | 用法 | 检查 |\n| --- | --- | --- | --- |\n| a | `src/x.ts` | x | `nope` |\n| a | `src/y.ts` | x | — |\n';
  assert.equal(readPartsRegistry(md).problems.length, 2);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/lib/detectors.test.mjs scripts/lib/parts-registry.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现两个模块，接进 `check-structure.mjs`，在 STANDARD.md 写好登记表**

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/lib/*.test.mjs`
Expected: PASS

- [ ] **Step 5: 生成旧账基线（每个类别只能做这一次）**

Run: `for id in portal storage screen player timeFormat toast spinner emoji; do node scripts/check-structure.mjs --baseline parts:$id || break; done; node scripts/check-structure.mjs`
Expected: 最后一次检查通过，并打印每个零件的三档进度。数量应接近清点报告（例：`portal` 约 30–40、`emoji` 约 19 个文件）。差得太多时先查探测器再继续。

Run: `node scripts/check-structure.mjs --baseline parts:portal`
Expected: 退出码 1（已存在的类别拒绝重新生成）。

- [ ] **Step 6: 提交**

```bash
git add scripts/lib/detectors.mjs scripts/lib/detectors.test.mjs scripts/lib/parts-registry.mjs scripts/lib/parts-registry.test.mjs scripts/check-structure.mjs scripts/structure-allowlist.json docs/STANDARD.md
git commit -m "chore: parts registry with ingredient detectors; grandfather existing copies"
```

### Task 5: 行内跳过检查注释和 `!important` 进名单

**Files:**

- Modify: `scripts/check-structure.mjs`、`scripts/lib/detectors.mjs`、`scripts/structure-allowlist.json`、`docs/STANDARD.md`（S5、S8）
- Test: `scripts/lib/detectors.test.mjs`（追加）

**Interfaces:**

- Consumes：Task 3、Task 4。
- Produces：
  - 探测器 `eslintDisableInline`：`/eslint-disable-(?:next-)?line\b/g`，统计全部 `src`，没有主人。
  - `isAllowedImportant(selector: string, atRules: string[]): boolean`，放在 `scripts/lib/detectors.mjs`。
    - 只要选择器或任一 @ 规则匹配 `/data-tm-reduced-motion|prefers-reduced-motion|data-tm-no-blur|data-tm-theme-transition|\.art-|artplayer/` 就为 `true`。

`check-structure.mjs`：

- 类别 `eslintDisableInline`：每个文件计数，走棘轮。
- 类别 `important`：只查 `CORE_CSS`。声明值以 `!important` 结尾、且 `isAllowedImportant` 为假时，计入 `"<file>"`（按文件计数），走棘轮。

- [ ] **Step 1: 写失败的测试（追加）**

```js
test('counts inline eslint disables', () => {
  assert.equal(
    countMatches(
      '// eslint-disable-next-line no-console\n// eslint-disable-line x',
      'eslintDisableInline'
    ),
    2
  );
});
test('allows !important only in the agreed contexts', () => {
  assert.equal(
    isAllowedImportant("html[data-tm-reduced-motion='true'] .a", []),
    true
  );
  assert.equal(
    isAllowedImportant('.a', ['@media (prefers-reduced-motion: reduce)']),
    true
  );
  assert.equal(isAllowedImportant('.tm-player .art-video-player', []), true);
  assert.equal(isAllowedImportant('.tm-btn', []), false);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/lib/detectors.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现，并把 STANDARD.md 的 S5 改成 D6 的说法；S8 写明行内跳过注释只许减少**

- [ ] **Step 4: 测试通过，生成两个类别的基线**

Run: `node --test scripts/lib/*.test.mjs && node scripts/check-structure.mjs --baseline eslintDisableInline && node scripts/check-structure.mjs --baseline important && node scripts/check-structure.mjs`
Expected: 全部通过。`important` 的数量明显少于 154（减弱动效那些不算）。

- [ ] **Step 5: 提交**

```bash
git add scripts docs/STANDARD.md
git commit -m "chore: ratchet inline eslint disables and non-exempt !important"
```

### Task 6: 代码警告基线

**Files:**

- Create: `scripts/check-lint-baseline.mjs`
- Modify: `package.json`（`scripts` 加 `"check:lint": "node scripts/check-lint-baseline.mjs"`）、`scripts/structure-allowlist.json`

**Interfaces:**

- Consumes：Task 3 的 `compareCounts`、`baseline`。
- Produces：

  - 命令 `pnpm check:lint [--shrink] [--baseline]`。
  - 用 `eslint` 包自带的 `ESLint` 类：`new ESLint({ cwd })`，`lintFiles(['src'])`。
  - 只统计 `severity === 1` 的警告，键为 `"<file> :: <ruleId>"`，类别 `lintWarnings`。
  - 有错误（severity 2）也失败。

- [ ] **Step 1: 实现**

计数和比较全部复用 `ratchet.mjs`，本文件只负责跑 ESLint 和收集结果，所以不另写单元测试。

- [ ] **Step 2: 生成基线并验证**

Run: `node scripts/check-lint-baseline.mjs --baseline && pnpm -s check:lint`
Expected: 基线记下约 1153 条（按 文件 × 规则 汇总后条目更少）；随后检查通过。

- [ ] **Step 3: 证明它能拦住新警告**

在 `src/lib/time.ts` 末尾临时加一行 `console.log('x')`，然后：

Run: `pnpm -s check:lint; echo exit=$?`
Expected: `exit=1`，并点名 `src/lib/time.ts :: no-console`。

Run: `git checkout -- src/lib/time.ts && pnpm -s check:lint`
Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add scripts/check-lint-baseline.mjs package.json scripts/structure-allowlist.json
git commit -m "chore: lint warning baseline that can only shrink"
```

### Task 7: 设计检查修正 + 能检查整个核心

**Files:**

- Modify: `scripts/check-design.mjs`、`package.json`（`"check:design": "node scripts/check-design.mjs --core"`）
- Test: `scripts/check-design.test.mjs`

**Interfaces:**

- Consumes：Task 2 的 `CORE_CSS`、`CORE_CODE`、`inScope`。
- Produces：
  - `scanText(source, file)` 不再判断 `em`：`em` 相对父元素，静态算不出。`px` 和 `rem`（按 16px）照旧。
  - `--core`：枚举核心范围里的 `.css/.ts/.tsx`（不含测试）逐个扫描。不带参数时的用法不变。

现状：唯一一条“违规”是 `src/styles/shell.css:1374` 的 `font-size: 0.68em`。父元素 `.tm-launch-wordmark` 是 24px，实际约 16px，属于误报。

- [ ] **Step 1: 写失败的测试** `scripts/check-design.test.mjs`

```js
test('em is relative and not judged', () => {
  assert.equal(scanText('.a { font-size: 0.68em; }').length, 0);
});
test('px and rem below 12px are violations', () => {
  assert.equal(scanText('.a { font-size: 0.7rem; }').length, 1);
  assert.equal(scanText("<p className='text-[11px]'>").length, 1);
});
test('hex outside token definitions is a violation', () => {
  assert.equal(scanText('.a { color: #fff; }').length, 1);
  assert.equal(scanText(':root { --tm-x: #fff; }').length, 0);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/check-design.test.mjs`
Expected: FAIL（第一个测试）

- [ ] **Step 3: 实现**

- [ ] **Step 4: 验证**

Run: `node --test scripts/check-design.test.mjs && pnpm -s check:design`
Expected: PASS；输出 `违规 0`。

- [ ] **Step 5: 提交**

```bash
git add scripts/check-design.mjs scripts/check-design.test.mjs package.json
git commit -m "chore: design check covers the whole core; em sizes are relative"
```

### Task 8: 规范和纸面对齐、术语表、入口文档

**Files:**

- Modify: `docs/STANDARD.md`、`AGENTS.md`、`docs/README.md`、`docs/playback-rebuild.md`、`scripts/check-structure.mjs`
- Test: `scripts/lib/parts-registry.test.mjs`（追加 `findMissingPaths`）

**Interfaces:**

- Produces：`findMissingPaths(markdown: string, exists: (p: string) => boolean): string[]`，放在 `scripts/lib/parts-registry.mjs`。
  - 找出反引号里以 `src/`、`scripts/`、`docs/`、`server/` 开头的路径中不存在的那些。
  - `check-structure.mjs` 对 `AGENTS.md`、`docs/README.md`、`docs/STANDARD.md` 三份“法律文件”调用它，有缺失就失败。历史记录类文档不查。

文档改动：

- **STANDARD.md**
  - S2 改成：“一件事一个来源，见公共零件登记表；登记表里每个零件只有它的主人能直接用原材料，旧账在待清理名单里只许减少。”
  - 删掉“本地存储读写、点外面关闭各只有一个工具”这类与事实不符的说法（点外面关闭目前没有公共工具，写进登记表待办）。
  - 新增“## 三档范围”：说明 `scripts/structure-scope.json` 的三档。
  - 新增“## 术语表”：按 D2，列“说法 / 代码名 / 不再用的说法”。
  - S10 补上：新类别、`--baseline` 只能用一次、代码警告基线、设计检查、提交钩子、规则改动报告。
- **AGENTS.md**（只加，不删）
  - 开工前必读里加一行：公共零件登记表和三档范围在 `docs/STANDARD.md`。
  - 规矩里加一行：改 `scripts/structure-allowlist.json`、`scripts/check-*.mjs`、`scripts/lib/`、`.eslintrc.js`、测试，要先问用户。
  - 验证段落加 `pnpm check:lint`、`pnpm check:design` 和 Node 24 的说明。
  - 加一行：第一次检出后执行 `git config core.hooksPath scripts/git-hooks`。
- **docs/README.md**：加本计划的链接。
- **docs/playback-rebuild.md**：开头加“已完成（2026-11-21），留作记录”。

- [ ] **Step 1: 写失败的测试（追加）**

```js
test('finds missing backticked paths', () => {
  const md = 'see `src/a.ts` and `docs/b.md` and `npm run x`';
  assert.deepEqual(
    findMissingPaths(md, (p) => p === 'src/a.ts'),
    ['docs/b.md']
  );
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/lib/parts-registry.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现，接进检查，改文档**

- [ ] **Step 4: 验证**

Run: `node --test scripts/lib/*.test.mjs && pnpm -s check:structure && pnpm -s format:check`
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add docs AGENTS.md scripts
git commit -m "docs: align STANDARD with reality; parts registry, tiers, glossary"
```

### Task 9: 执法：提交钩子 + GitHub 自动检查 + 规则改动报告

**Files:**

- Create: `scripts/git-hooks/pre-commit`（POSIX sh，可执行）
- Modify: `.github/workflows/checks.yml`

**Interfaces:**

- Consumes：`pnpm check:structure`、`pnpm check:design`、`pnpm check:lint`、`node --test scripts/lib/*.test.mjs scripts/check-design.test.mjs`。

`pre-commit` 做的事：

1. `node -v` 的主版本不是 24 时，只打印警告，不拦。
2. 跑 `pnpm -s check:structure && pnpm -s check:design`。
3. 对暂存的 `.ts/.tsx/.css/.md/.json/.mjs/.cjs` 文件跑 `pnpm exec prettier --check`。

不跑类型检查和单元测试，那些交给 GitHub。不加 `prepare` 脚本：Docker 构建时 `.git` 被排除（`.dockerignore` 第 8 行），自动配置会让构建失败。

`checks.yml`：

- checkout 加 `fetch-depth: 0`。
- 在 `Lint` 后加步骤：`pnpm check:lint`、`pnpm check:design`、`node --test scripts/lib/*.test.mjs scripts/check-design.test.mjs`。
- 加一个不拦截的步骤“规则改动报告”：

  - 条件：`github.event_name == 'push'` 且 `github.event.before` 不是全 0。
  - 用 `git diff --name-only ${{ github.event.before }} ${{ github.sha }}`，筛出下列文件，写进 `$GITHUB_STEP_SUMMARY`：`scripts/structure-allowlist.json`、`scripts/structure-scope.json`、`scripts/check-*.mjs`、`scripts/lib/**`、`.eslintrc.js`、`docs/STANDARD.md`、`**/*.test.*`。
  - 这个工作流是被 `docker-image.yml` 调用的，`github.event` 就是那次推送。

- [ ] **Step 1: 写钩子，配置并计时**

Run: `git config core.hooksPath scripts/git-hooks && time sh scripts/git-hooks/pre-commit`
Expected: 退出码 0，用时 30 秒以内。

- [ ] **Step 2: 证明钩子能拦**

在 `src/features/room/view/RoomView.css` 末尾临时加 `.x { color: #123456; }`，然后：

Run: `git add src/features/room/view/RoomView.css && sh scripts/git-hooks/pre-commit; echo exit=$?`
Expected: `exit=1`，并报 `写死 hex`。

Run: `git restore --staged src/features/room/view/RoomView.css && git checkout -- src/features/room/view/RoomView.css`

- [ ] **Step 3: 改 `checks.yml`，本地核对能解析**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/checks.yml','utf8'); if(!/check:lint/.test(y)||!/fetch-depth: 0/.test(y)) process.exit(1)"`
Expected: 退出码 0。

YAML 在 GitHub 上实际能不能跑，要等推送后才知道，在第一阶段报告里写明“未验证”。

- [ ] **Step 4: 提交**

```bash
git add scripts/git-hooks/pre-commit .github/workflows/checks.yml
git commit -m "ci: run lint/design ratchets; pre-commit hook; report rule changes"
```

### Task 10: 端到端测试脚本进仓库

**Files:**

- Create（从 `.claude/` 搬过来）：`scripts/e2e/playback-check.mjs`、`scripts/e2e/sync-test.mjs`、`scripts/e2e/style-snapshot.mjs`、`scripts/e2e/snap-all.sh`、`scripts/e2e/test-supervisor.cjs`、`scripts/e2e/test-server.cjs`、`scripts/e2e/seed-test.mjs`、`scripts/e2e/README.md`、`scripts/e2e/test.env.example`
- Modify（本机、被 git 忽略）：`.claude/launch.json` 里 `tongmu-test` 的启动参数，改成 `scripts/e2e/test-supervisor.cjs`

**Interfaces:**

- 环境文件路径：`process.env.TM_TEST_ENV ?? '.claude/test.env'`。
- Chrome 路径：`process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'`。
- 测试站地址：保持 `http://localhost:3100`。
- `test.env.example` 只写变量名和占位值：`USERNAME=`、`PASSWORD=`、`AUTH_SECRET=`、`SQLITE_DB_PATH=`、`TEST_MEMBER_USERNAME=`、`TEST_MEMBER_PASSWORD=`。

- [ ] **Step 1: 搬家**

用 `git mv` 不行（源文件没被跟踪），复制后删掉 `.claude/` 里的旧文件。把脚本里的路径改成上面的接口。README 写清怎么启动测试站、怎么跑三个脚本。

- [ ] **Step 2: 确认没有带进密码**

用一段脚本读 `.claude/test.env` 里每个变量的值，检查它们有没有出现在 `scripts/e2e/` 的任何文件里。脚本只打印变量名，不打印值：

Run: `node -e "const fs=require('fs'),p=require('path');const env=require('util').parseEnv(fs.readFileSync('.claude/test.env','utf8'));const files=fs.readdirSync('scripts/e2e').map(f=>p.join('scripts/e2e',f));let bad=0;for(const [k,v] of Object.entries(env)){if(v&&v.length>3&&files.some(f=>fs.readFileSync(f,'utf8').includes(v))){console.log('泄露:',k);bad=1}}process.exit(bad)"`
Expected: 退出码 0，没有输出。

- [ ] **Step 3: 实际跑一遍**

1. 用预览工具启动 `tongmu-test`（端口 3100）。
2. 依次运行：

```bash
node scripts/e2e/playback-check.mjs
node scripts/e2e/sync-test.mjs
```

Expected: 两个都报告通过（单人播放：进小窗、回来接着播；双账号：播放、暂停、拖进度同步）。

3. 跑完关掉预览服务。

- [ ] **Step 4: 格式和结构**

Run: `pnpm -s format:check && pnpm -s check:structure`
Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add scripts/e2e
git commit -m "chore: keep e2e scripts in the repo; credentials stay in .claude/test.env"
```

### Task 11: 第一阶段收尾和报告

**Files:**

- Modify: `docs/design/PROGRESS.md`（加一条）

- [ ] **Step 1: 最后一次修改之后，用 Node 24 完整跑一遍**

Run:

```bash
pnpm -s typecheck && pnpm -s lint && pnpm -s check:lint && pnpm -s check:structure && pnpm -s check:design \
  && pnpm -s format:check && pnpm -s test --ci && pnpm -s test:rooms && pnpm -s test:ops \
  && node --test scripts/lib/*.test.mjs scripts/check-design.test.mjs scripts/pwa-options.test.cjs scripts/docker-image-tags.test.cjs
```

Expected: 全部通过；单元测试数 ≥ 1201。

- [ ] **Step 2: 确认界面和行为没变**

Run: `git diff c11617b --stat -- src`
Expected: `src/` 没有任何改动（这一阶段只动脚本、配置、文档）。有改动就逐条解释，或者撤掉。

- [ ] **Step 3: 写进度记录并提交**

记录写清楚：

- 新增了哪些检查。
- 每个零件的三档进度（从 `check:structure` 的输出抄）。
- 没验证的：GitHub 上的新步骤要等推送才知道能不能跑；真机没测。

```bash
git add docs/design/PROGRESS.md
git commit -m "docs: rules-first phase 1 done"
```

- [ ] **Step 4: 一次性向用户报告并等决定**

报告内容：改了哪些文件、对应规范哪一条、验证结果、没验证的、各零件旧账数量。

请用户决定三件事：

1. 推送吗？
2. 推送后要部署吗？（部署命令见长期记忆 `vps-deploy-command`）
3. 开始写第二阶段计划吗？

---

## 第二、第三阶段（这里只定关卡，详细计划在第一阶段结束后写）

到时候按检查输出的准确清单写，不按现在的估计数字。已经定下的设计约束：

- **服务器权限函数**：`src/lib/` 里一个函数，例：`requireRole(request, level: 'owner' | 'admin' | 'user')`。
  - 返回身份信息，或一个和原来完全相同状态码的响应。
  - 先给 55 个接口补“现有行为”测试再替换。
  - 报错文字要不要统一，届时问用户（管理后台会显示它）。
- **公共弹窗层**：补齐居中弹窗、底部菜单、抽屉、确认框、看图五种款式，统一返回键和滚动锁。迁移前出设计稿给用户确认。
- **设置读写**：在 `src/lib/` 做统一入口，键名一个都不改。
- **时间格式**：`formatDuration` 放 `src/lib/time.ts`，播放器内核从 lib 引用。
- **第三阶段试点**：弹窗。设计稿 → 用户确认 → 改 → 检查 → 涉及房间的用 `scripts/e2e/sync-test.mjs` 测 → 用户真机试。
- **之后**：逐项推进。上游独立功能区（管理后台、音乐、书、漫画、直播、电视）用到再改，服务器权限除外。
