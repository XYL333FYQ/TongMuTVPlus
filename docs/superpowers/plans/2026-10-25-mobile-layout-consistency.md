# 手机顶栏与全站同类布局修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收紧手机首页及全站共用顶栏，修复分类胶囊底框与选项错位，并处理已确认的重复页头和空控件占位。

**Architecture:** 沿用 PageLayout、MobileHeader、MediaShell 和既有 token，从共享样式修复，再核对具体调用页面。直接包含按钮的胶囊与内部自行滚动的 CapsuleSwitch 分别保留原来的滚动归属。音乐只收紧现有工具栏的样式，不移动播放器或状态所属组件。

**Tech Stack:** Next.js 14、React 18、TypeScript、现有 CSS/token 与 framer-motion。

**Spec:** `AGENTS.md`、`docs/design/DESIGN.md`、`docs/requirements.md`、`docs/architecture.md`，以及用户 2026-10-25 的两张手机截图和“全站检查同类问题然后修改”的要求。

## 授权与全局约束

- 用户已于 2026-10-25 确认“按方案直接修改”；按当前清单实施并记录验证边界。
- 由 Codex 在当前会话逐项实施，同一时间一个工具修改项目。
- 保持现有黑白灰设计和 --tm-\* token，手机点按目标至少 44px，文字至少 12px。
- 保留深浅主题、键盘焦点、减少动态、无模糊和真实安全区支持。
- 不改接口、存储键、Socket 事件、播放会话、数据库、权限或依赖。
- 不改 AGENTS.md 所列禁区文件；房间共享顶栏受到样式影响时执行房间专项回归。
- 不提交、推送或部署。本次推送授权属于已完成的上一项任务。
- 启动预览前先完成类型检查与测试；下一批检查前关闭本项目预览并确认退出。

## 已确认的证据

1. 内置浏览器实际 CSS 视口 390×844，visualViewport.scale=1；当前手机顶栏 64px，主内容顶部预留 76px。手机截图要求更紧凑，这是明确的视觉需求；真机截图中的额外安全区数值未直接取得，不把真机全部留白都归因于 64px 顶栏。
2. 电影分类底框 358px，鼠标布局下选项滚动宽约 451px；触屏布局下约 431px。点击末尾“冷门佳片”后，选中按钮落在底框右端之外，可稳定复现。
3. 动漫星期栏底框 358px、选项滚动宽约 435px，存在同一问题；DoubanCustomSelector 直接包含按钮，使用同一受限宽度样式。
4. 音乐模块在通用顶栏下另有约 69px 的工具栏；漫画和电子书模块另有约 57px 的标题/说明栏及二级导航。电子书搜索页还存在“电子书 / 电子书搜索 / 搜索电子书”重复页名。
5. 私人影库未配置可选来源时仍渲染一个约 6px 的空胶囊及包装间距。

截图和尺寸记录：`output/mobile-layout-audit-20261025/`。初步记录包含加载中状态，不能把所有快照当成完整页面验收。

## Review Focus

- 320px 窄屏、长页面名和滚动后的居中标题：标题不得覆盖主题/账号按钮；检查标题与操作区边界。
- 刘海安全区、手机浏览器与独立阅读器：安全区只由对应外壳负责，不叠加两遍；阅读器原有定位不套用普通模块样式。
- 滑到胶囊末尾并选中最后一项：底框仍包住按钮，焦点可见，滚动与选中回调不变。
- 普通 MediaShell 的详情返回按钮与音乐菜单：压缩重复文字后，原有返回/菜单入口仍可操作。
- 空来源转为有来源：不通过在 CapsuleSwitch 的 hooks 后简单 return null 来破坏首次挂载的拖动监听；在调用页面决定是否挂载完整控件。

## Task 1: 统一手机顶栏高度与内容起点

**Files:**

- Modify: `src/styles/tokens.css`
- Modify: `src/styles/shell.css`
- Modify: `src/components/MobileHeader.tsx`

**Interfaces:** 沿用现有 MobileHeader props、PageLayout 的 `mobileTitle` 和 `--tm-header-height`，不新增持久状态。

- [ ] 手机断点小于 768px 时，将顶栏从 64px 收紧到 52px；普通主内容从 76px 改为顶栏高度加 8px，即无安全区时 60px。桌面/平板的现有 64px / 68px 和宽屏比例保持各自原值。
- [ ] 普通标题按当前 DESIGN.md 的手机 24px；滚动后保持 17px，并同步 framer-motion 的缩放基数及减少动态分支。限制长标题宽度，避免与右侧按钮重叠。
- [ ] 让账号菜单、二级导航等位置使用同一高度来源；保留 env 安全区，不根据截图猜测并硬减刘海数值。
- [ ] 在 320 / 390 的顶部与滚动状态测量高度、标题和按钮边界；验证 44px 点按、菜单定位、Tab 焦点和减少动态。820 / 1280 复核未被手机断点误改。

## Task 2: 修复直接包含按钮的胶囊轨道

**Files:**

- Modify: `src/styles/controls.css`
- Modify: `src/components/DoubanSelector.tsx`
- Modify: `src/components/DoubanCustomSelector.tsx`
- Modify: `src/components/WeekdaySelector.tsx`

**Interfaces:** 各选择器的 options、activeValue、onChange、layoutId、wheel 和日期选择逻辑全部沿用。

- [ ] 给这三处“外层负责滚动、胶囊直接包含按钮”的结构添加专用样式类；胶囊按 max-content 铺满全部按钮，不再被 max-width:100% 截成短底框。
- [ ] 保持外层滚动视窗受页面宽度约束；不改变内部含 `.tm-capsule-scroll` 的 CapsuleSwitch，也不通过隐藏页面溢出来遮掩问题。
- [ ] 在电影分类、剧集地区、动漫星期和可用的自定义分类中，滚到两端、点击末项、用键盘切换焦点，核对底框始终包住按钮。无真实自定义分类数据时报告该项的源码检查边界。
- [ ] 390 触屏模式 / 820 / 1280，深浅各一组；确认页面宽度不变，选择内容与回调维持原值。

## Task 3: 收紧模块重复标题与空来源占位

**Files:**

- Modify: `src/components/media/MediaShell.tsx`
- Modify: `src/app/music/MusicClient.tsx`（只改本轮工具栏的 className / 局部安全区样式）
- Modify: `src/app/books/search/page.tsx`（只改重复标题的展示类）
- Modify: `src/app/private-library/page.tsx`（只改来源切换控件的展示条件与现有选项整理）
- Modify: `src/styles/shell.css`

**Interfaces:** 复用 `PageLayout.mobileTitle`；MediaShell.reader 的分支、reader.mainClassName、返回 href、音乐菜单 onClick 和所有播放状态不变。

- [ ] 非阅读页把准确的子页名称交给已有 `mobileTitle`；手机端去掉局部页头里重复的页名，保留说明、详情返回和二级导航，消除重复的顶部安全区预留。独立阅读器保持原有头部和定位。
- [ ] 音乐现有工具栏收紧为至少 44px 的操作行，减少上下 padding 和重复空白，菜单按钮实际宽高至少 44px；不移动 MusicClient 或播放器。
- [ ] 电子书搜索的正文重复页名在手机端隐藏，说明与搜索表单保留，桌面原有标题保留。
- [ ] 私人影库从现有三项启用标记生成同一组选项；没有选项时不挂载来源控件和外层间距。保持有选项时的顺序、选中值和回调不变。
- [ ] 检查电子书/漫画发现、搜索、书架、历史、目录以及详情返回入口；无真实书籍/漫画时不把空状态检查写成阅读验收。检查音乐菜单开关和各子页导航，避免触发播放或写入真实记录。

## Task 4: 全站复查与交付

**Files:**

- Modify: `docs/design/DESIGN.md`（记录用户批准的手机尺寸修订）
- Modify: `docs/design/PROGRESS.md`
- Evidence: `output/mobile-layout-audit-20261025/`（代码快照只用 .txt / .bak）

- [ ] 逐项记录 58 个页面入口的覆盖方式：实际页面、共享外壳检查、缺少配置/参数、未验证；不能写成 58 个页面均已真实通过。
- [ ] 检查其余搜索/反馈/求片/关于/我的/房间/直播/管理入口的同类拥挤、错位和溢出；只修复有明确源码与浏览器证据且在本轮边界内的问题。独立电视界面按 1280 / 1440 检查，不强行套手机导航。
- [ ] 关闭本项目预览，确认 3000 监听进程已退出，再串行运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm format:check`、`pnpm test:rooms` 和现有设计检查。保留原始失败日志，遵循 AGENTS.md 的源码错误回滚与原生崩溃重试规则。
- [ ] 检查通过后再恢复预览，在内置浏览器完成 390 / 820 / 1280 深浅截图与本轮交互检查，记录实际 CSS 视口、缩放和控制台新增错误。补 320 窄屏和 1440×900 桌面检查；结束时把内置预览恢复到 1440×900。
- [ ] 输出修改文件、设计依据、验证结果、没做/未验证项。扫码登录已有 hydration 报错及开发预览脚本加载错误单独记录，不并入本轮视觉修复或假称已经解决。

## 当前检查边界

已读取设计、需求、架构和进度，并枚举 58 个 page.tsx 入口，扫描相关外壳、标题、筛选和宽度规则。浏览器覆盖常用页面、媒体子页、登录/提示入口及电视入口；部分仅加载中或空状态，有的模块首页因配置返回首页。真实数据详情、阅读、影片播放和多账号同步未做完整验收。尚未运行项目测试，因为应用源码尚未修改。
