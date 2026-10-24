# 首页三联海报参考实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户本轮选定的三联海报参考落实到真实首页，完成图像过渡、悬停、键盘/触屏、自动切换暂停与实际浏览器验收。

**Architecture:** 延用 HomeHero 和 BannerCarousel 的现有数据、权限与操作回调。竖版条目使用完整主海报及两张后续推荐，横版/预告片沿用原展示。所有尺寸和颜色在现有首页 CSS 与 --tm-\* token 内实现。

**Tech Stack:** Next.js 14、React 18、TypeScript 4.9、现有 framer-motion / lucide-react；无新依赖。

**Spec:** docs/design/reference/hero-poster-stage-20261021.png、docs/design/DESIGN.md、本轮用户补充：展示栏上缘稍下移，字号与海报协调，按同一视口对照到接近参考。

## Global Constraints

- 不动播放单例、房间同步、服务端、API、数据库、接口、存储键、Socket 事件名和其他页面。
- 不创建分支、提交、推送或部署；当前工作区大量既有改动必须完整保留。
- 本批开始状态与 .bak 备份在 output/hero-reference-20261021/；只由主 Agent 写入。
- 字号最低 12px、触屏目标至少 44px、focus-visible、两种减少动态及无模糊偏好都覆盖。

## Review Focus

- 只有一两部影片时不得出现重复邻卡、错误索引或无效箭头。
- 快速连续切换与异步图片解码不得让迟到图片覆盖当前影片，失败须有真实兜底。
- 鼠标离开但焦点仍在展示栏时，自动轮播保持暂停。
- 手机上纵向滚动不误切片，减少动态时没有倾斜、缩放或自动轮播。
- 竖版主海报完整显示、侧海报不遮字；横版剧照/预告片继续使用原入口及真实操作。

### Task 1: 三联展示与交互

**Files:** src/components/catalog/HomeHero.tsx、HomeHero.test.tsx、src/components/BannerCarousel.tsx、对应轮播交互测试。

- [x] 增加用户行为测试：邻卡索引、箭头首尾循环、键盘、悬停与焦点叠加暂停、两部和单部边界、图像失败。
- [x] 先运行新增测试确认因缺失行为失败，再实现稳定槽位的海报交叉过渡与现有倾斜处理。
- [x] 保留背景解码与旧图保留机制；清晰主图同样响应 ready/失败状态；修正本展示栏的纵向手势误判和过期定时器。
- [x] 运行针对性测试，记录结果。

### Task 2: 参考视觉、全量验证与交付

**Files:** src/styles/home.css、必要的 src/styles/tokens.css、docs/design/DESIGN.md、PROGRESS.md。

- [x] 将三联比例、轻透视、海报高光/投影、较清晰的背景氛围、按钮边框与较大文字落实到现有样式；沿用整站容器与宽屏缩放规则。无需修改 tokens.css。
- [x] 串行运行 pnpm typecheck、pnpm lint、pnpm test、pnpm format:check；按项目要求处理原生崩溃和既有失败，不覆盖此前已验收修改。普通 typecheck 两次原生崩溃待用户手动验证；Node 正则解释模式下同一 tsc / 全部 Jest 通过，不冒充普通命令成功。
- [x] 静态检查设计规则、修改文件格式与禁区/非目标文件哈希。
- [x] 测试完成后恢复现有预览，以真实 1440×900 浏览器截图对照参考；检查 390/820/1280 深浅主题、悬停中间态、切换中间态、真实操作入口和控制台。
- [x] 更新规范与进度，清楚记录尚未验证的播放/多人同步边界；不声称精确像素百分比。

## 执行记录

- 用户已选定参考并要求直接完成相关交互，本轮持续执行，不另设方案确认轮次。
- Ruling: 在当前工作区做可回滚的最小修改 — 新 worktree 不含当前已验收但尚未提交的视觉基线；以批前 .bak 和逐文件哈希保护原状态，不提交 Git。
- 基线与每步验证结果持续写入 output/hero-reference-20261021/ 以及 PROGRESS.md。
- 一次独立只读审查指出切片时动作按钮重建导致焦点丢失与暂停状态问题；主 Agent 以稳定动作节点修复，先红后绿，真实浏览器 ArrowRight 后播放按钮保留焦点。未发现未处理的静态重要项。
- 最终：HomeHero 13 + BannerCarousel 3 项；全量 62 套件 / 358 项与房间 19 项通过。全仓 lint 69 个、格式 230 个既有问题保留；目标文件格式、源码 lint（0 error）与设计扫描通过。
- 390/820/1280 深浅、1440 深浅、2124 与 820 长片名有截图；访客自动切换、悬停 19.6 秒和减少动态 24.7 秒停住有计时证据。系统/站内偏好已恢复，最终首页为 1440×900 浅色页首，Hero y=92。
- 真实播放/连续性/多人同步/屏幕共享未在本批端到端重测；内置浏览器原生触屏 CDP 不可用，触摸以真实组件事件和回归测试验证，未宣称物理设备测试。详细命令、风险和证据见 output/hero-reference-20261021/acceptance.txt。
