# 弹窗试点（第三阶段）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把全站共用的几个弹窗零件和账号菜单的弹出面板，换到第二阶段做好的 `ModalLayer` 五种款式上，按用户同意的设计稿统一样子和行为；顺手修掉第二阶段审查留下的“先读请求再查权限”。

**Architecture:** 先改“主人”，不改调用方：`ConfirmDialog`、`MobileActionSheet`、`ImageViewer`、`HttpWarningDialog`、`Drawer` 这几个公共零件内部改成套 `ModalLayer`（各自的属性接口不变），用它们的地方自动跟着变。房间的 `Dialog` 和两种旧的抽屉层写法并进 `drawer` 款式。账号菜单是上游大文件，只把它弹出的几个面板换成 `ModalLayer`，菜单本身（下拉）不动。

**Tech Stack:** Next.js 15、React 18、TypeScript 5、Jest + Testing Library、原生 `<dialog>`、Node 24。不新增依赖。

**Spec:** 用户 2026-11-23 同意的设计稿 `docs/design/prototypes/modal-layer.html`（五种款式的样子、共用行为、“用在哪”）；`docs/plan/2026-11-23-phase2-shared-parts-plan.md` 末尾“第三阶段”的关卡；长期记忆 `coherence-roadmap`（第二阶段留给第三阶段的事）；`docs/design/ACCEPTANCE.md` 分端验收标准。

## 开工前用户一次性拍板（批准本计划即视为同意下列默认值，有异议在批准时改）

| 编号  | 问题                                     | 默认值                                                                                                                                                                                                                                                                                                    |
| ----- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-D1 | 试点换哪些？                             | 五个公共零件（确认框、长按菜单、看图、HTTP 警告、侧边抽屉）＋房间的弹窗和面板＋下载管理、读书历史的抽屉＋账号菜单弹出的面板（设置、改密码、订阅、生态应用、确认）。影片详情（`DetailShell`）不在设计稿的“用在哪”里，这一阶段不动                                                                          |
| P3-D2 | 房间的片单 / 弹幕 / 菜单面板用哪种款式？ | 用 `drawer`，不用设计稿“用在哪”里写的 `sheet`。理由：现在平板和电脑上这些面板从右侧滑出，看片时画面还露在左边；`sheet` 在大屏上会变成居中面板盖住画面。`drawer` 在手机上同样从底部拉起，和现在一样。等于房间面板的样子基本不变                                                                            |
| P3-D3 | 看得见的变化有哪些？                     | 这些弹窗改成设计稿的尺寸、圆角、按钮排法（例：确认框最宽 400、两个按钮等宽、确认在右；看图铺满、关闭在右上 44×44）。行为上：看图和 HTTP 警告以后也能用返回键 / Esc 关、打开时页面不能滚；看图在触屏上可以下拉关闭（设计稿有、现在没有）；账号菜单的面板统一由原生弹窗层盖住顶栏、底栏和小窗。其余页面不变 |
| P3-D4 | 9 个管理接口先读请求再查权限要修吗？     | 修。没登录又带坏数据时现在返回 500，改成和其他情况一样的 401 / 403（`admin/ai`、`category`、`emby`、`music`、`openlist`、`site`、`source`、`theme`、`user` 的 POST）。只调顺序，不改别的                                                                                                                  |
| P3-D5 | 提交、推送、部署                         | 每个任务全部检查通过后直接提交到 main；全部做完问一次推送和部署。部署后请用户在真机上（手机、平板或电脑各一）点开每种弹窗试一遍，有问题只回退这一次                                                                                                                                                       |
| P3-D6 | 改前改后的对比怎么拍？                   | 吸取第二阶段的教训：改前快照在 Task 0 拍；改后快照在 Task 8 一开始拍，两次之间不跑任何端到端测试（同步测试会改测试站数据），端到端测试放到改后快照之后                                                                                                                                                    |

**批准（2026-11-23）：** 用户批准本计划和 P3-D1–P3-D6 的默认值（原话“Yes, run it all”），并同意：本计划做完后，接着按末尾“之后”清单逐项做下去，**不再为每一项单独写计划、单独请用户批准**。每一项照本计划的做法执行（先写测试、调用方一批批换、`--shrink`、全部检查通过再提交），只在下面列出的停止条件处停下来问。

## 执行中的自主权

**不用问，直接做：** 本计划写明的改动、跑检查、修自己刚引入的问题、按 P3-D5 提交、`--shrink` 让名单变短、更新 `docs/design/PROGRESS.md`。

**必须停下来问用户（攒在一起问）：**

1. 某个弹窗换上款式后，和设计稿对不上又不能按设计稿改（例如内容放不进最宽 400 的确认框）。
2. 页面（不打开弹窗时）的改前改后对比出现差异。
3. 账号菜单里发现必须动到设置读写或菜单本身才能换面板。
4. 要新增依赖、改对外名字（接口路径、Socket 事件、存储键、数据库字段、路由）。
5. 推送、部署、开始下一阶段。

## Global Constraints

- 除了 P3-D3 列出的，界面和行为不变。各公共零件的属性接口（props）不变，调用方不用改。
- 弹窗一律经 `ModalLayer`：焦点、返回键、Esc、点遮罩关闭、滚动锁都只由它负责，零件里删掉自己的那份（`createPortal`、`showModal`、`useBackLayer`、`body.style.overflow`）。
- 颜色只用 `--tm-*` 令牌；最小字号 12px；手机点按目标 ≥ 44px；可点元素有 `:focus-visible`；动效响应 `data-tm-reduced-motion` / `prefers-reduced-motion`，玻璃响应 `data-tm-no-blur`（`AGENTS.md` 视觉硬规则）。
- 样式只写在 `src/styles/modal-layer.css`（`tm-modal-layer` 块）和各零件自己已登记的块里，不跨文件改别人的元素（S4）。
- 不新增依赖；只有 `main` 分支；不推送，除非用户说；不许 `--no-verify`；所有检查用 Node 24。
- 推送前多跑一次 `NEXT_PUBLIC_STORAGE_TYPE=localstorage pnpm -s test --ci`（第二阶段 GitHub 检查失败的教训：GitHub 上没有 `.env`）。
- 起点：提交 `1b93e9b`；单元测试 194 组 / 1317 条；名单 627 条；`portal` 68、`scrollLock` 25；设计检查违规 0。

## Review Focus

1. **弹窗叠弹窗**：长按菜单里点“删除”再弹确认框、账号菜单的订阅面板里点“重置订阅 Token”再弹确认框时，关掉上层后下层还在、页面仍然锁着、焦点回到下层（Task 1、2、6 各加一条测试）。
2. **返回键只关最上层**：两层弹窗时按一次返回键只关上层，再按一次关下层，第三次才离开页面（Task 2 测试，沿用 `BackLayer.integration.test.tsx` 的做法）。
3. **房间小窗和播放器**：房间面板开着时离开房间页，面板要关掉、滚动锁要解开，房间小窗照常出现、画面不重建（Task 4 端到端：`sync-test.mjs`、`solo-test.mjs` 放在 Task 8）。
4. **触屏下拉关闭**：长按菜单（原有手势保留）和看图（新加，设计稿）在手机上下拉能关，用鼠标拖不会误关（Task 2、3 测试用 `pointerType: 'touch'` / `'mouse'` 各一条）。
5. **管理接口的坏请求**：没登录、成员带着不是 JSON 的请求体访问那 9 个接口，得到 401 / 403 而不是 500，且不读写配置（Task 7，并进 `auth-behaviour.test.ts`）。

---

### Task 0：起点

**Files:** 无改动

- [ ] **Step 1:** Node 24 跑 `pnpm -s typecheck && pnpm -s lint && pnpm -s check:lint && pnpm -s check:structure && pnpm -s check:design && pnpm -s format:check && pnpm -s test --ci && pnpm -s test:rooms`。Expected：全部通过，`Tests: 1317 passed`，名单 627 条。不一致先停下来报告。
- [ ] **Step 2:** 启动测试站（`tongmu-test`），`node scripts/e2e/seed-test.mjs`（房间若已归档），然后 `node scripts/e2e/style-snapshot.mjs snap <临时目录>/before` 和 `<临时目录>/noise`。从这里到 Task 8 Step 1 之间不跑端到端测试（P3-D6）。快照不进 git。

### Task 1：确认框（`confirm`）

**Files:**

- Modify: `src/components/feedback/ConfirmDialog.tsx`、`src/styles/feedback.css`（删掉被 `modal-layer.css` 取代的遮罩、定位、层级规则；`tm-confirm-*` 内容样式保留）
- Test: `src/components/feedback/ConfirmDialog.test.tsx`（追加）

**Interfaces:**

- Consumes：`ModalLayer`（`src/components/feedback/ModalLayer.tsx`）`{ label, onClose, children, className?, variant?: ModalVariant }`。
- Produces：`ConfirmDialog` 的属性不变（`isOpen`、`title`、`message`、`confirmText?`、`cancelText?`、`onConfirm`、`onCancel`、`variant?: 'danger' | 'warning' | 'info'`）；`askConfirm()` 不变。

- [ ] **Step 1: 写失败的测试**

```tsx
test('renders inside the shared modal layer as the confirm variant', () => {
  render(
    <ConfirmDialog
      isOpen
      title='删除？'
      message='x'
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />
  );
  const dialog = screen.getByRole('dialog', { name: '删除？' });
  expect(dialog).toHaveClass('tm-modal-layer', 'tm-modal-layer--confirm');
});
test('the confirm button comes after cancel', () => {
  // 两个按钮的 DOM 顺序：取消、确认（设计稿：确认在右）
});
test('closing a confirm opened from a sheet keeps the page locked', () => {
  // 先 lockScroll() 模拟下层，打开再关闭确认框后 document.body.style.position 仍是 'fixed'
});
```

- [ ] **Step 2:** `pnpm -s test --ci src/components/feedback/ConfirmDialog.test.tsx`。Expected：FAIL（没有 `tm-modal-layer--confirm`）。
- [ ] **Step 3:** `ConfirmDialog` 内部改为 `isOpen` 时渲染 `<ModalLayer variant='confirm' label={title} onClose={onCancel}>`，删掉自己的 `createPortal`、`<dialog>`、`useBackLayer`。按钮顺序和宽度按设计稿。
- [ ] **Step 4:** 跑本文件和 `AppDialogs`、`BackLayer.integration.test.tsx`。Expected：PASS。`node scripts/check-design.mjs src/components/feedback/ConfirmDialog.tsx src/styles/feedback.css`：违规 0。
- [ ] **Step 5: 提交** `refactor: ConfirmDialog uses the confirm variant of the modal layer`

### Task 2：长按菜单（`sheet`）

**Files:**

- Modify: `src/components/feedback/MobileActionSheet.tsx`、`src/styles/panels.css`（`tm-action-sheet` 块里删掉被取代的定位、遮罩、层级）
- Test: `src/components/feedback/MobileActionSheet.presentation.test.tsx`（追加）

**Interfaces:**

- Produces：`MobileActionSheet` 默认导出和其他导出的属性不变（调用方 `VideoCard.tsx`、`media/MediaPressCard.tsx` 不改）。

- [ ] **Step 1: 写失败的测试**：渲染在 `tm-modal-layer--sheet` 里；`touch` 指针下拉超过阈值调用关闭、`mouse` 拖动不关闭（Review Focus 4）；菜单里打开 `ConfirmDialog` 后按一次返回键只关确认框、第二次关菜单（Review Focus 1、2）。
- [ ] **Step 2:** 跑它。Expected：FAIL。
- [ ] **Step 3:** 外层换成 `<ModalLayer variant='sheet'>`，删掉自己的 `createPortal`、`<dialog>`、`useBackLayer`、`body.style.overflow`（3 处）；拖动手势和动画保留在零件里。
- [ ] **Step 4:** 跑本文件、`VideoCard` 和 `MediaPressCard` 的测试。Expected：PASS。`node scripts/check-structure.mjs --shrink`：`scrollLock` 25 → 22。
- [ ] **Step 5: 提交** `refactor: MobileActionSheet uses the sheet variant`

### Task 3：看图（`viewer`）

**Files:**

- Modify: `src/components/feedback/ImageViewer.tsx`、`src/styles/panels.css`（`tm-image-viewer` 块）
- Test: `src/components/feedback/ImageViewer.presentation.test.tsx`（追加）

**Interfaces:**

- Produces：`ImageViewer` 属性不变（调用方 `VideoCard.tsx`、`SearchPageClient.tsx`、`media/MediaPressCard.tsx` 不改）。

- [ ] **Step 1: 写失败的测试**：渲染在 `tm-modal-layer--viewer` 里；按返回键（`consumeBackLayer()` 返回 `'handled'`）会关闭（P3-D3 新增行为）；关闭按钮的可点区域 ≥ 44×44（检查类名或行内尺寸）；`touch` 下拉关闭、`mouse` 不关。
- [ ] **Step 2:** 跑它。Expected：FAIL。
- [ ] **Step 3:** 外层换成 `<ModalLayer variant='viewer'>`，删掉自己的门户、`<dialog>`、`body.style.overflow`（3 处）；按设计稿加触屏下拉关闭（只响应 `pointerType === 'touch'`，下拉超过 120px 或速度够快就关，不够就弹回；减弱动效时不做弹回动画）。
- [ ] **Step 4:** 跑本文件和三个调用方的测试；`--shrink`：`scrollLock` 22 → 19。
- [ ] **Step 5: 提交** `refactor: ImageViewer uses the viewer variant`

### Task 4：侧边抽屉（`drawer`）：`Drawer`、房间面板、下载管理、读书历史

**Files:**

- Modify: `src/components/Drawer.tsx`、`src/features/room/view/RoomForm.tsx`（`Dialog` 的 `sheet` 改用 `variant='drawer'`）、`src/components/DownloadManagementPanel.tsx`、`src/app/books/history/page.tsx`
- Modify: `src/styles/modal-layer.css`（删掉 `tm-drawer-layer`、`tm-download-modal-layer` 两种旧写法；`docs/STANDARD.md` 块名登记表同步删掉这两个前缀）、`src/features/room/room.css`（`tm-room-dialog` 里被取代的定位规则）
- Test: `src/components/Drawer.test.tsx`（新建）、`src/features/room/view/RoomForm.test.tsx`（新建或追加）

**Interfaces:**

- Produces：`Drawer` 属性不变；房间 `Dialog({ title, onClose, children, wide?, sheet? })` 不变，`sheet` 现在映射到 `variant='drawer'`（P3-D2），不带 `sheet` 的仍是默认 `dialog`。

- [ ] **Step 1: 写失败的测试**：`Drawer` 渲染在 `tm-modal-layer--drawer` 里；房间 `Dialog sheet` 渲染 `tm-modal-layer--drawer`、不带 `sheet` 的没有任何款式后缀类；`tm-drawer-layer` 这个类在全站不再出现（`grep` 写成测试：读 `src/` 下所有 `.tsx`，断言不含 `tm-drawer-layer`、`tm-download-modal-layer`）。
- [ ] **Step 2:** 跑它。Expected：FAIL。
- [ ] **Step 3:** 实现：四处都换成 `variant='drawer'`；删掉 `Drawer.tsx` 自己的门户；删旧 CSS 和登记表里的两个前缀。
- [ ] **Step 4:** `pnpm -s test --ci src/components src/features/room src/app/books && pnpm -s check:structure && pnpm -s check:design`。Expected：通过。房间的两个账号端到端测试放到 Task 8（P3-D6），这里不跑。
- [ ] **Step 5: 提交** `refactor: drawers use the drawer variant; drop the two legacy drawer layers`

### Task 5：HTTP 警告（`dialog`）

**Files:** Modify: `src/components/feedback/HttpWarningDialog.tsx`、`src/styles/panels.css`（`tm-http-warning` 块）；Test: `src/components/feedback/HttpWarningDialog.presentation.test.tsx`（追加）

- [ ] **Step 1: 写失败的测试**：渲染在 `tm-modal-layer` 里（默认款式，没有后缀类）；Esc 和返回键能关（P3-D3 新增）；“不再提示”仍然写同一个存储键（键名不变，经 `src/lib/settings.ts`）。
- [ ] **Step 2:** 跑它。Expected：FAIL。
- [ ] **Step 3:** 外层换成 `<ModalLayer>`，删掉自己的门户。
- [ ] **Step 4:** 跑本文件。Expected：PASS。
- [ ] **Step 5: 提交** `refactor: HttpWarningDialog uses the modal layer`

### Task 6：账号菜单弹出的面板

**Files:**

- Modify: `src/components/UserMenu.tsx`（只改第 230–240 行的滚动锁和 3438 行之后渲染面板的几处 `createPortal`）、必要时 `src/components/user-menu/UserMenuSettingsPanel.tsx`、`UserMenuSubscribePanel.tsx`、`UserMenuEcoAppsPanel.tsx` 的最外层容器
- Test: `src/components/UserMenu.panels.test.tsx`（新建）

**Interfaces:**

- 面板和款式（设计稿“用在哪”）：设置 → `drawer`；改密码、订阅、生态应用 → 默认 `dialog`；“重置订阅 Token”“撤销设备登录”“登出所有设备”三处确认 → 换成共享的 `ConfirmDialog`（Task 1），删掉 `UserMenu` 自己画的确认框。菜单本身（`menuPanel`，下拉）和同步提示（`<Toast>`）不动。

- [ ] **Step 1: 写失败的测试**：打开设置面板后它在 `tm-modal-layer--drawer` 里、页面被锁；订阅面板里点“重置订阅 Token”弹出的是共享确认框（`tm-modal-layer--confirm`），点“取消”后订阅面板还在、页面仍锁（Review Focus 1）；关掉设置面板后页面解锁。
- [ ] **Step 2:** 跑它。Expected：FAIL。
- [ ] **Step 3:** 把这几个面板的 `createPortal(..., document.body)` 换成 `<ModalLayer>` 包住；删掉 `UserMenu` 自己的 `body.style.overflow`（3 处）。面板内容和设置读写一行不动（P3 停止条件 3）。
- [ ] **Step 4:** 跑本文件和 `src/components` 下的测试；`--shrink`：`scrollLock` 19 → 16，`portal` 减少的数量写进报告。
- [ ] **Step 5: 提交** `refactor: account menu panels open in the shared modal layer`

### Task 7：管理接口先查权限再读请求

**Files:** Modify：`src/app/api/admin/{ai,category,emby,music,openlist,site,source,theme,user}/route.ts` 的 `POST`；Test：`src/app/api/auth-behaviour.test.ts`（追加一类来访：带不是 JSON 的请求体）、`src/app/api/auth-behaviour.json`

- [ ] **Step 1: 写失败的测试**：对这 9 个接口，未登录和成员带 `body: 'not json'` 请求，状态是 401 / 403（和带正常请求体时一样），记录器里没有写操作。
- [ ] **Step 2:** 跑它。Expected：FAIL（现在是 500）。
- [ ] **Step 3:** 每个 `POST` 把 `await requireRole(...)` 挪到 `request.json()` 之前，其余不动。
- [ ] **Step 4:** 跑 `auth-behaviour.test.ts`、`admin/authorization-sweep.test.ts` 和这 9 个接口旁边的测试。Expected：PASS；快照里只多了新的一类来访，原有条目不变。
- [ ] **Step 5: 提交** `fix: admin routes check the role before reading the request body`

### Task 8：收尾

**Files:** `docs/design/PROGRESS.md`

- [ ] **Step 1: 改后快照（第一件事）** `style-snapshot.mjs snap <临时目录>/after`，`diff before after noise`。Expected：差异为空（快照里的页面都没有打开弹窗）；有差异就逐条查，属于本计划的改动就解释，不属于就停下来问（停止条件 2）。
- [ ] **Step 2: 端到端** `solo-test.mjs`（5/5）、`sync-test.mjs`（12/12）；再手动用无头浏览器在房间页打开片单面板后离开房间页，确认面板关掉、页面不再锁、房间小窗出现（Review Focus 3）。
- [ ] **Step 3: 分端截图** 用无头浏览器按 ACCEPTANCE.md 的四种档位 × 深浅两种主题，各打开一次确认框、长按菜单、看图、房间片单面板、账号设置面板、HTTP 警告，和设计稿对照。截图放临时目录、不进 git，报告里列出看过的组合和对不上的地方。
- [ ] **Step 4:** Node 24 完整跑一遍（Task 0 的命令 + `test:ops` + `node --test scripts/lib/*.test.mjs scripts/check-design.test.mjs` + `NEXT_PUBLIC_STORAGE_TYPE=localstorage pnpm -s test --ci`）。Expected：全部通过。
- [ ] **Step 5: 独立审查** 开一个审查代理（最强的模型），审查第三阶段全部提交，重点看 Review Focus 五条；严重和重要的修掉（每条先写失败的测试），小问题列进报告。
- [ ] **Step 6:** PROGRESS.md 记一条（做了什么、`portal` / `scrollLock` 前后数量、没验证的），提交 `docs: phase 3 popup pilot done`。
- [ ] **Step 7:** 一次性向用户报告，请用户决定：推送和部署吗？部署后请用户按 P3-D5 在真机上点开每种弹窗试一遍。

---

## 之后（本计划做完后接着做，按这个顺序逐项；不再单独写计划）

每一项开工前在 `docs/design/PROGRESS.md` 记一句要做什么、看得见的变化有哪些；需要改界面样子的（例如影片详情）先出设计稿等用户同意，其余照本计划的停止条件。推送和部署每做完一两项问一次。上游独立功能区（管理后台、音乐、书、漫画、直播、电视）不主动改。

1. 其余自己做弹窗、自己锁滚动的地方：`VersionPanel`、`DanmakuFilterSettings`、`EpisodeFilterSettings`、`AIChatPanel`、`LyricsPiPWindow`、管理后台（`scrollLock` 剩下的 16 处），以及 `portal` 剩下的旧账。
2. 影片详情（`DetailShell`）：设计稿没覆盖，先出设计稿。
3. 账号菜单、设置面板、云同步拉取改用 `src/lib/settings.ts` / `useSetting`（第二阶段审查留下）。
4. `src/lib/permissions.ts` 里第二套“谁有特权”的规则并进 `requireRole`（第二阶段审查留下）。
5. 设备档位（`screen` 72）、加载转圈（`spinner` 133）、emoji（123）等其余零件，按 `check:structure` 输出的清单逐项。
