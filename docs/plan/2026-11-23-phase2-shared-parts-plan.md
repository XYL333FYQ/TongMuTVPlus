# 公共零件（第二阶段）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第一阶段登记的四样重复做成“只有一个主人”的公共零件：时间格式、设置读写、服务器权限检查、公共弹窗层；旧账按棘轮只减不增。

**Architecture:** 新零件都放在共用层（`src/lib/`、`src/hooks/`、`src/components/feedback/`），各自先有单元测试，再把调用方一批批换过去；每批换完用 `--shrink` 让名单变短。服务器权限先给现有接口拍一份“现在的行为”快照，换完逐条对比。弹窗层先出设计稿，用户同意后才写代码。

**Tech Stack:** Next.js 15（App Router）、React 18、TypeScript 5、Jest（`node-web-environment.cjs` 跑接口）、`node --test`（检查脚本）、Node 24。不新增依赖。

**Spec:** 长期记忆 `coherence-roadmap`（第二阶段：服务器权限、弹窗款式、设置读写，2026-11-22 用户认可）；`docs/plan/2026-11-22-rules-first-plan.md` 末尾“第二、第三阶段”已定的设计约束；`docs/STANDARD.md` 公共零件登记表和 S1–S10。

## 开工前用户一次性拍板（批准本计划即视为同意下列默认值，有异议在批准时改）

| 编号  | 问题                                                       | 默认值                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P2-D1 | 权限被拒时的报错文字要不要统一？（管理后台会把它显示出来） | 状态码一律保持原样。**没登录或登录失效照旧返回 `Unauthorized`**：它是给前端看的暗号，`src/components/TokenRefreshManager.tsx:199`、`src/lib/db.client.ts:674,720` 靠响应里有没有这个词决定要不要自动续登录，换掉会让用户被踢出（2026-11-23 用户同意）。其余三种按原因统一成中文：账号不存在“用户不存在”、被封禁“账号已被封禁”、角色不够“没有权限”。现在混用的 `Forbidden`、`未授权`、`权限不足`、`无权限访问` 等不再出现 |
| P2-D2 | 角色以哪里为准？                                           | 每次都按服务器配置里的用户表判断（站长 = 环境变量 `USERNAME`），不信 Cookie 里写的角色。影响：管理员被降级或封禁后，手里还没过期的登录立刻失去管理权限（现在有约 30 个接口只看 Cookie，要等登录过期）                                                                                                                                                                                                                    |
| P2-D3 | 几种长得不一样的时间格式要不要统一？                       | 统一成 `src/lib/time.ts` 的三种：`formatClock`（`5:09`、`1:05:09`）、`formatPaddedClock`（`05:09`、`01:05:09`）、`formatDuration`（`30秒`、`1分30秒`、`2分钟`）。看得见的变化只有三处：影片卡片“已看 3 分 0 秒” → “已看 3 分钟”；音乐页超过一小时的歌 `61:40` → `1:01:40`；自己看页的跳过设置时间由四舍五入改为舍去（最多差 1 秒）                                                                                       |
| P2-D4 | 设置读写这一阶段换到哪里？                                 | 只换核心范围的 26 个文件（清单见 Task 2）。常用上游、上游里的留给之后逐项做                                                                                                                                                                                                                                                                                                                                              |
| P2-D5 | 弹窗层设计稿什么样？什么时候做？                           | 一个可以直接打开的 HTML 原型（`docs/design/prototypes/modal-layer.html`），五种款式 × 手机竖屏 / 手机横屏 / 平板 / 电脑 × 深浅两种主题；只用 `--tm-*` 令牌。**Task 0 之后先做设计稿交给用户**，用户看稿期间接着做 Task 1–3，弹窗层代码等用户同意再写（2026-11-23 用户同意）。这一阶段只做零件，不改现有弹窗的调用方（那是第三阶段试点）                                                                                  |
| P2-D6 | 提交、推送、部署                                           | 每个任务全部检查通过后直接提交到 main。**分两次部署**（2026-11-23 用户同意）：Task 1–2 做完问一次推送和部署，推送时只推到 Task 2 的最后一个提交（`git push origin <提交>:main`），Task 3 在本地接着做；Task 3 做完再单独问一次。这样权限改动出问题时只回退这一次                                                                                                                                                         |

## 执行中的自主权

**不用问，直接做：** 本计划写明的改动、跑检查、修自己刚引入的问题、按 P2-D6 提交、`--shrink` 让名单变短、更新 `docs/design/PROGRESS.md`。本计划写明要新加的登记表行和探测器（Task 1、3、4）视为用户已批准的规则改动。

**必须停下来问用户（攒在一起问）：**

1. Task 4 的设计稿做好之后交给用户看（不用等回复，接着做 Task 1–3）；**弹窗层代码不经同意不写**。
2. “现在的行为”快照对比出本计划没列到的差异（状态码变了，或 P2-D1 以外的文字变了）。
3. 计算样式对比出现 P2-D3 以外的差异。
4. 要新增依赖、改对外名字（接口路径、Socket 事件、存储键、数据库字段、路由）。
5. 推送、部署（按 P2-D6 分两次问）、开始第三阶段。

## Global Constraints

- 界面和行为不变，P2-D1 / P2-D2 / P2-D3 明确列出的变化除外。
- 不新增依赖。存储键一个都不改名（含 `moontv_*`），值的存法（字符串、`'true'`/`'false'`、JSON）逐个保持原样。
- 依赖方向 S1：`components/`、`hooks/`、`lib/` 不能引 `@/features/*`；新零件放共用层就是为了让两边都能用。
- 待清理名单只许变短；新类别只能在本计划规定的任务里用 `--baseline` 生成一次。
- 所有检查用 Node 24（`AGENTS.md`）。Windows 原生崩溃：关预览服务重跑，不许跳过检查或 `--no-verify`。
- 改房间相关文件（Task 2 有 6 个）后跑 `node scripts/e2e/sync-test.mjs`，自己看相关的跑 `node scripts/e2e/solo-test.mjs`。
- 只有 `main` 分支；不推送，除非用户说。注释中文，标识符和测试名英文（S7）。
- 起点：提交 `a307887`；单元测试 185 组 / 1202 条；名单 638 条；设计检查违规 0、TODO 0。

## Review Focus

1. **被拒绝的请求不能碰数据**：换成 `requireRole` 后，未登录、成员、被封禁的人访问管理接口仍然在读写配置或数据库之前被拦下（Task 3 沿用 `authorization-sweep.test.ts` 的记录器断言“没有写操作”）。
2. **站长在本地存储模式**：`NEXT_PUBLIC_STORAGE_TYPE=localstorage` 时没有用户表，站长仍然要能进管理接口、普通访问照旧（Task 3 单测覆盖）。
3. **同一个设置在两个标签页**：一页改了，另一页用 `useSetting` 的组件要跟着变（`storage` 事件），同一页里的其他组件也要变（自定义事件）（Task 2 单测）。
4. **自动续登录的暗号**：没登录或登录失效的 401 响应体里必须还有 `Unauthorized`，否则前端不会自动续登录、用户会被踢出（Task 3 的 `requireRole` 单测和“现在的行为”快照都锁住这一条；非法时间值的情形由 Task 1 的单测覆盖）。
5. **弹窗叠弹窗**：两层弹窗都锁滚动时，关掉上层页面不能提前恢复滚动（Task 4 的滚动锁按引用计数，单测覆盖）。

---

**执行顺序：** Task 0 → Task 4 的 Step 1–2（设计稿交给用户）→ Task 1 → Task 2 →（问推送、部署）→ Task 3 →（再问一次）→ Task 4 的 Step 3 起（用户同意设计稿之后）→ Task 5。

### Task 0：起点

**Files:** 无改动

- [ ] **Step 1:** 切 Node 24，跑 `pnpm -s typecheck && pnpm -s lint && pnpm -s check:lint && pnpm -s check:structure && pnpm -s check:design && pnpm -s format:check && pnpm -s test --ci && pnpm -s test:rooms`。Expected：全部通过，`Tests: 1202 passed`，名单 638 条。和 Global Constraints 的起点不一致时先停下来报告。
- [ ] **Step 2:** 启动测试站（`tongmu-test`），`node scripts/e2e/style-snapshot.mjs snap <临时目录>/before`，再拍一次 `<临时目录>/noise` 作噪声基准。快照不进 git。

### Task 1：时间格式只有一个主人（`src/lib/time.ts`）

**Files:**

- Modify: `src/lib/time.ts`、`src/features/player/core/plugins/heatmap.ts`、`src/features/player/core/plugins/keyboard.ts`、`src/features/player/core/player-core.test.ts`
- Delete: `src/features/player/core/plugins/format.ts`
- Modify（调用方）：`src/features/playback/player/wire-instance.ts:321`、`src/features/playback/surface/PlaybackSurface.tsx:716,1307`、`src/components/VideoCard.tsx:1173`、`src/app/music/MusicClient.tsx:2510`、`src/features/room/MusicPage.tsx:100`、`src/app/books/read/page.tsx:1980`、`src/components/tv/player/utils.ts:125`、`src/components/music/SongList.tsx:34`
- Test: `src/lib/time.test.ts`
- Modify: `scripts/structure-allowlist.json`（`--shrink`）

**Interfaces:**

- Produces（`src/lib/time.ts`）：

  - `formatClock(seconds: number): string`：向下取整；不满一小时 `m:ss`，否则 `h:mm:ss`；非法值（`NaN`、负数、`Infinity`）按 0。
  - `formatPaddedClock(seconds: number): string`：同上，但分、时补两位：`05:09`、`01:05:09`。
  - `formatDuration(seconds: number): string`：向下取整；`30秒`、`1分30秒`、整分钟 `2分钟`；非法值 `0秒`。

- [ ] **Step 1: 写失败的测试** `src/lib/time.test.ts`

```ts
test('formatClock', () => {
  expect(formatClock(309)).toBe('5:09');
  expect(formatClock(3909)).toBe('1:05:09');
  expect(formatClock(3700)).toBe('1:01:40');
  expect(formatClock(9.9)).toBe('0:09');
  expect(formatClock(NaN)).toBe('0:00');
  expect(formatClock(-5)).toBe('0:00');
  expect(formatClock(Infinity)).toBe('0:00');
});
test('formatPaddedClock', () => {
  expect(formatPaddedClock(309)).toBe('05:09');
  expect(formatPaddedClock(3909)).toBe('01:05:09');
  expect(formatPaddedClock(0)).toBe('00:00');
  expect(formatPaddedClock(NaN)).toBe('00:00');
});
test('formatDuration', () => {
  expect(formatDuration(30)).toBe('30秒');
  expect(formatDuration(90)).toBe('1分30秒');
  expect(formatDuration(120)).toBe('2分钟');
  expect(formatDuration(180.6)).toBe('3分钟');
  expect(formatDuration(NaN)).toBe('0秒');
});
```

- [ ] **Step 2:** `pnpm -s test --ci src/lib/time.test.ts`。Expected：FAIL（函数不存在）。
- [ ] **Step 3:** 在 `src/lib/time.ts` 实现三个函数；`plugins/format.ts` 的两个函数搬过来后删掉该文件，内核插件和 `player-core.test.ts` 改从 `@/lib/time` 引。
- [ ] **Step 4:** 换调用方：`wire-instance`、`MusicClient`、`MusicPage` 用 `formatClock`（`MusicPage` 在调用处保留 `Number.isFinite(t) && t >= 0 ? formatClock(t) : '--:--'`）；`PlaybackSurface:1307`、`books`、`formatTVTime`、`SongList` 的数字部分用 `formatPaddedClock`（`SongList` 先保留它对 `durationText` 的处理，`formatTVTime` 保留函数名、改成一行转调）；`PlaybackSurface:716`、`VideoCard` 用 `formatDuration`。
- [ ] **Step 5:** `pnpm -s test --ci src/lib src/features/player src/features/playback src/components && pnpm -s typecheck && node scripts/check-structure.mjs --shrink && pnpm -s check:structure`。Expected：通过；`timeFormat` 剩下的只有日期 / 时刻类（`formatPublishTime`、`formatDateTime`、`EpgScrollableRow`、`DownloadPanel`、`ai-comment-generator`、`AnimeSubscriptionComponent`），它们不是时长，留作之后逐项。
- [ ] **Step 6: 提交** `refactor: one owner for time formatting in lib/time`

### Task 2：设置读写只有一个入口（`src/lib/settings.ts` + `useSetting`）

**Files:**

- Create: `src/lib/settings.ts`、`src/lib/settings.test.ts`、`src/hooks/useSetting.ts`、`src/hooks/useSetting.test.tsx`
- Modify: `src/lib/local-settings-sync.ts`（`LOCAL_SETTINGS_KEYS` 改成从 `settings.ts` 的登记里筛 `sync: true` 的键，内容不变）
- Modify（核心范围 26 个文件，数字是现在的直接读写次数）：`components/feedback/HttpWarningDialog.tsx`×2、`components/feedback/ReleaseNoticeDialog.tsx`×2、`components/mini-player/useMiniPlayerDrag.ts`×2、`components/shell/MobileGestures.tsx`×2、`features/discover/DiscoverPage.tsx`×9、`features/discover/banner/BannerCarousel.tsx`×5、`features/playback/data/load-source-detail.ts`×2、`features/playback/data/load-tmdb-backdrop.ts`×1、`features/playback/lib/xiaoya-correction.ts`×1、`features/playback/player/settings.ts`×3、`features/playback/player/wire-instance.ts`×2、`features/playback/surface/PlaybackSurface.tsx`×12、`features/playback/surface/usePlayerPreferences.ts`×2、`features/player/core/WatchPlayer.ts`×2、`features/player/core/ad-filter.ts`×7、`features/player/core/hls-engine.ts`×1、`features/player/core/plugins/anime4k.ts`×4、`features/player/core/plugins/basics.ts`×2、`features/player/core/plugins/danmaku.ts`×2、`features/player/core/plugins/heatmap.ts`×3、`features/player/core/plugins/subtitles.ts`×2、`features/room/RoomSession.tsx`×2、`features/room/ScreenSharePage.tsx`×7、`features/room/media/catalog.ts`×3、`features/room/media/playback-url.ts`×2、`features/room/player/chat-danmaku.ts`×2（路径都在 `src/` 下）

**Interfaces:**

- Produces（`src/lib/settings.ts`）：
  - `SETTINGS: Record<string, { area: 'local' | 'session'; sync: boolean }>`：所有本地设置键的唯一登记（键名原样，含 `moontv_*`）。
  - `type SettingKey = keyof typeof SETTINGS`
  - `readSetting(key: SettingKey): string | null`、`writeSetting(key: SettingKey, value: string): void`、`removeSetting(key: SettingKey): void`：存原样字符串，存取失败（隐私模式、配额满）时读返回 `null`、写静默失败，和现在各处的 `try/catch` 一致。
  - `readBool(key, fallback: boolean): boolean`（`'true'` / `'false'`，其他值回落）、`readNumber(key, fallback: number): number`、`readJson<T>(key, fallback: T): T`：只覆盖现在已有的三种存法。
  - `subscribeSetting(key: SettingKey, listener: (value: string | null) => void): () => void`：同页（写入时派发 `tm:setting` 事件）和别的标签页（`storage` 事件）都通知。
- Produces（`src/hooks/useSetting.ts`）：`useSetting(key: SettingKey): [string | null, (value: string | null) => void]`，基于 `useSyncExternalStore` + `subscribeSetting`，服务端渲染时返回 `null`。

- [ ] **Step 1: 写失败的测试** `src/lib/settings.test.ts`、`src/hooks/useSetting.test.tsx`

```ts
test('round-trips raw strings and keeps key names', () => {
  writeSetting('tm_player_volume', '0.3');
  expect(localStorage.getItem('tm_player_volume')).toBe('0.3');
  expect(readNumber('tm_player_volume', 1)).toBe(0.3);
});
test('booleans keep the true/false string format', () => {
  writeSetting('enable_blockad', 'false');
  expect(readBool('enable_blockad', true)).toBe(false);
  expect(readBool('fluidSearch', true)).toBe(true); // 没存过
});
test('a throwing storage reads null and writes nothing', () => {
  /* 用 jest.spyOn 让 getItem/setItem 抛错 */
});
test('listeners hear same-page writes and other-tab storage events', () => {
  const seen: (string | null)[] = [];
  const stop = subscribeSetting('homeBannerEnabled', (v) => seen.push(v));
  writeSetting('homeBannerEnabled', 'false');
  window.dispatchEvent(
    new StorageEvent('storage', { key: 'homeBannerEnabled', newValue: 'true' })
  );
  stop();
  expect(seen).toEqual(['false', 'true']);
});
test('LOCAL_SETTINGS_KEYS is unchanged', () => {
  expect(LOCAL_SETTINGS_KEYS).toEqual(/* 现在的数组，原样抄进测试 */);
});
```

`useSetting.test.tsx`：两个组件用同一个键，一个改值，另一个重新渲染出新值。

- [ ] **Step 2:** 跑这两个测试。Expected：FAIL（模块不存在）。
- [ ] **Step 3:** 实现 `settings.ts`、`useSetting.ts`；`SETTINGS` 收录 91 个键里会被核心和 `local-settings-sync` 用到的全部键（`grep` 出来逐个登记，`area` 和 `sync` 按现在的实际用法填）。
- [ ] **Step 4:** 逐个文件换调用方，每个文件换完跑它旁边的测试。存法不同的（JSON、数字）用对应的 `read*`，写回时用和原来一样的 `String(...)` / `JSON.stringify(...)`。
- [ ] **Step 5:** `pnpm -s test --ci && pnpm -s typecheck && node scripts/check-structure.mjs --shrink && pnpm -s check:structure`。Expected：通过；`parts:storage` 核心档从 84 → 0。
- [ ] **Step 6:** 测试站上跑 `node scripts/e2e/solo-test.mjs` 和 `node scripts/e2e/sync-test.mjs`。Expected：5/5、12/12（同步那项若出现 NET 或偶发失败，重跑一次并如实记录）。
- [ ] **Step 7: 提交** `refactor: one entry for local settings; core files stop touching storage`

### Task 3：服务器权限检查只有一个主人（`src/lib/require-role.ts`）

**Files:**

- Create: `src/lib/require-role.ts`、`src/lib/require-role.test.ts`、`src/app/api/auth-behaviour.test.ts`、`src/app/api/auth-behaviour.json`
- Modify：`src/app/api/` 下做角色或封禁检查的接口（约 44 个做角色检查、约 56 个读用户表；第一步的快照列出准确清单）
- Modify: `docs/STANDARD.md`（登记表加一行）、`scripts/lib/detectors.mjs`（加探测器）、`scripts/structure-allowlist.json`
- Test: `scripts/lib/detectors.test.mjs`（追加）

**Interfaces:**

- Produces（`src/lib/require-role.ts`）：
  - `type RoleLevel = 'owner' | 'admin' | 'user'`
  - `type Caller = { username: string; role: 'owner' | 'admin' | 'user' }`
  - `requireRole(request: NextRequest, level: RoleLevel, options?: { deniedStatus?: 401 | 403 }): Promise<Caller | NextResponse>`
    - 没登录或登录失效：401 `Unauthorized`（原样，见 P2-D1）；用户表里没有：401 `用户不存在`；被封禁：401 `账号已被封禁`；角色不够：`options.deniedStatus ?? 403`，`没有权限`（P2-D1）。
    - 角色按服务器配置判断，站长是环境变量 `USERNAME`（P2-D2）；本地存储模式没有用户表，只认站长。
  - `isCaller(value: Caller | NextResponse): value is Caller`
- 探测器 `roleCheck`：`/\brole\s*[!=]==\s*'(?:owner|admin)'/g`；登记表新行：`| 服务器权限 | \`src/lib/require-role.ts\` | \`requireRole()\` | \`roleCheck\` |`。

- [ ] **Step 1: 拍“现在的行为”快照**

`src/app/api/auth-behaviour.test.ts`（`@jest-environment ./src/test/node-web-environment.cjs`，沿用 `admin/authorization-sweep.test.ts` 的模块桩和记录器）：对每个做角色或封禁检查的接口的每个方法，用五种来访者（未登录、成员、被封禁的成员、管理员、站长）各请求一次，记录 `{ route, method, caller, status, error }`；被拒绝（401 / 403）的那几次，记录器里不许出现任何写操作（Review Focus 1）。第一次运行带 `TM_RECORD_AUTH=1` 写出 `auth-behaviour.json` 并提交；之后运行时和它比较：状态码必须相同，`error` 文字只许按 P2-D1 的三句中文变化（原来是 `Unauthorized` 的必须仍是 `Unauthorized`），其他不同就失败并列出。

- [ ] **Step 2:** `TM_RECORD_AUTH=1 pnpm -s test --ci src/app/api/auth-behaviour.test.ts`，再不带变量跑一次。Expected：第二次通过；JSON 里的接口数和 `grep` 出来的清单一致。提交 `test: record current auth behaviour of api routes`。
- [ ] **Step 3: 写失败的测试** `src/lib/require-role.test.ts`

```ts
test('anonymous gets 401 with the Unauthorized signal the client refreshes on', async () => {
  const res = await requireRole(request(), 'user');
  expect(isCaller(res)).toBe(false);
  expect((res as NextResponse).status).toBe(401);
  expect(await (res as NextResponse).json()).toEqual({ error: 'Unauthorized' });
});
test('banned member gets 401 账号已被封禁' /* … */);
test(
  'member asking for admin gets 403 没有权限, or 401 when deniedStatus is 401' /* … */
);
test(
  'a cookie that still says admin is refused after the user was demoted' /* P2-D2 */
);
test(
  'owner passes every level, also in localstorage mode' /* Review Focus 2 */
);
test('admin passes admin and user, not owner' /* … */);
```

- [ ] **Step 4:** 跑它。Expected：FAIL（模块不存在）。实现 `require-role.ts`，跑到通过。
- [ ] **Step 5:** 分三批把接口换成 `requireRole`，每批跑 `auth-behaviour.test.ts` 和 `admin/authorization-sweep.test.ts` 再提交：① `src/app/api/admin/**`；② `feedback`、`movie-requests`、`openlist`、`offline-download`、`auth/refresh`；③ 只查封禁的普通接口（`favorites`、`playrecords` 等）。原来是 401 的角色拒绝传 `{ deniedStatus: 401 }`，保证状态码不变。快照里 `error` 文字按 P2-D1 改过的条目，在 `auth-behaviour.json` 里同步更新（同一次提交）。
- [ ] **Step 6:** 加探测器和登记表行（先写 `detectors.test.mjs` 的失败用例 `countMatches("authInfo.role !== 'admin'", 'roleCheck') === 1`），然后 `node scripts/check-structure.mjs --baseline parts:roleCheck && pnpm -s check:structure`。Expected：通过；剩下的只有确实不是权限判断的（例如界面上按角色显示菜单），逐条在报告里列出。
- [ ] **Step 7: 提交** `refactor: one requireRole helper for api routes`

### Task 4：公共弹窗层（先设计稿，后代码）

**Files:**

- Create: `docs/design/prototypes/modal-layer.html`（设计稿）
- Create（同意后）：`src/lib/scroll-lock.ts`、`src/lib/scroll-lock.test.ts`、`src/components/feedback/ModalLayer.test.tsx`
- Modify（同意后）：`src/components/feedback/ModalLayer.tsx`、`src/styles/modal-layer.css`、`docs/STANDARD.md`（登记表加“滚动锁”一行）、`scripts/lib/detectors.mjs`、`scripts/structure-allowlist.json`

**Interfaces:**

- Produces（`src/lib/scroll-lock.ts`）：`lockScroll(): () => void`，引用计数：最后一个解锁时才恢复 `body` 原来的 `overflow` 和滚动位置。
- Produces（`ModalLayer`）：新增 `variant?: 'dialog' | 'sheet' | 'drawer' | 'confirm' | 'viewer'`（默认 `'dialog'`，样子和现在完全一样），打开时 `lockScroll()`，返回键沿用 `useBackLayer`。
- 探测器 `scrollLock`：`/\bbody\.style\.overflow\b/g`；登记表新行：`| 滚动锁 | \`src/lib/scroll-lock.ts\` | \`lockScroll()\`（弹窗层自带） | \`scrollLock\` |`。

- [ ] **Step 1: 设计稿** 按 P2-D5 做 `modal-layer.html`：五种款式各自在四种设备档位、深浅两种主题下的样子，标出进出动画（遵守 DESIGN.md 第 3 节、减弱动效）、返回键和点外面关闭的行为、手机上 ≥ 44px 的点按目标。用 `node scripts/check-design.mjs docs/design/prototypes/modal-layer.html` 查一遍颜色和字号。
- [ ] **Step 2: 停下来，把设计稿给用户看，等同意。** 用户要改就改稿，不写代码。
- [ ] **Step 3: 写失败的测试** `scroll-lock.test.ts`（两层锁、关上层不解锁、关下层才恢复）和 `ModalLayer.test.tsx`（默认款式的类名和现在一样；每种 `variant` 带上 `tm-modal-layer--<variant>`；打开时锁滚动、关闭时解锁；返回键关闭）。跑，Expected：FAIL。
- [ ] **Step 4:** 实现 `scroll-lock.ts`、`ModalLayer` 的 `variant`，样式写进 `modal-layer.css`（块名 `tm-modal-layer` 已登记）。跑测试到通过。
- [ ] **Step 5:** 加 `scrollLock` 探测器（先写失败用例），`node scripts/check-structure.mjs --baseline parts:scrollLock`；`pnpm -s check:structure && pnpm -s check:design`。
- [ ] **Step 6: 提交** `feat: modal layer variants and a shared scroll lock`

### Task 5：收尾

**Files:** `docs/design/PROGRESS.md`

- [ ] **Step 1:** 用 Node 24 完整跑一遍（Task 0 的命令 + `test:ops` + `node --test scripts/lib/*.test.mjs scripts/check-design.test.mjs`）。Expected：全部通过，单元测试数 ≥ 1202 加上新增的。
- [ ] **Step 2:** 测试站上 `style-snapshot.mjs snap <临时目录>/after`，`diff before after noise`。Expected：只有 P2-D3 列出的文字变化（影片卡片的“已看”时长）；其他差异逐条解释或撤掉。再跑 `solo-test.mjs`、`sync-test.mjs` 各一次。
- [ ] **Step 3:** 按 ACCEPTANCE.md 分端（手机竖屏、横屏、平板、电脑，深浅两种）看一遍首页、片库、播放页、房间页、管理后台的一个设置页：截图不进 git，报告里写看了哪些。
- [ ] **Step 4:** PROGRESS.md 记一条：做了什么、各零件旧账前后数量（`check:structure` 输出）、没验证的。提交 `docs: phase 2 shared parts done`。
- [ ] **Step 5: 独立审查** 开一个审查代理（用户 2026-11-23 同意），在最强的模型上审查第二阶段全部提交，重点看 Review Focus 五条和 `requireRole` 的每一处替换；严重和重要的问题修掉（每条先写失败的测试），小问题列进报告。
- [ ] **Step 6:** 一次性向用户报告，请用户决定：推送吗？部署吗？开始第三阶段（弹窗试点）计划吗？

---

## 第三阶段（这里只定关卡，详细计划在第二阶段结束后写）

弹窗试点：选 3–5 个用户最常用的弹窗（候选：确认框、影片详情、账号菜单里的设置面板、房间的片单 / 弹幕底部面板），按 Task 4 同意过的设计稿换到 `ModalLayer` 的款式上；改前改后计算样式对比、涉及房间的跑两个账号同步测试、用户真机试。之后逐项推进其余弹窗、常用上游的设置读写、日期 / 时刻类时间格式。
