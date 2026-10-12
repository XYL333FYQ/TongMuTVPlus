# P1 基础层验收记录

日期：2026-10-11。范围：DESIGN.md §2.1、§2.2、§2.4、§3.1、§3.2、§3.3 的 1 / 11 / 16。未调整页面布局。

## 修改文件

| 文件                                                          | 内容与规范                                                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/globals.css`                                         | §2.1 深浅 token、全部 ★ 变量、accent=text；旧 accent-soft 保留为中性别名。§2.2 回退字体、数字等宽。删除旧主题上下滑动动画和旧玻璃定义；html/body 使用 token，避免淡出时露出浏览器白底。 |
| `src/app/layout.tsx`                                          | 引入 motion.css；去掉 body 旧黑白颜色类，避免覆盖 token。Provider 顺序及播放器位置保持原样。                                                                                            |
| `src/components/ThemeProvider.tsx`                            | 默认 dark，保留 next-themes / enableSystem；恢复原有视觉偏好；根据实际根主题更新 theme-color。                                                                                          |
| `src/components/ThemeToggle.tsx`                              | §3.3.11 圆形主题过渡、中文标签、中性图标、44px 点按目标和聚焦环。                                                                                                                       |
| `src/app/my/page.tsx`                                         | 现有外观选择项改为深色 / 浅色 / 跟随系统，调用同一过渡函数；不改结构。                                                                                                                  |
| `src/styles/motion.css`                                       | §3.1 easing / duration token；§3.3.1 tm-press；§2.4 tm-glass；§3.3.16 延迟 400ms 骨架与 1.6s 扫光；减少动态及关闭模糊适配。                                                             |
| `src/lib/motion.ts`                                           | fadeUp、stagger、useReducedMotionSetting。使用时把 hook 结果传给 motion 的 custom；位移关闭，淡入最长 120ms，错峰关闭。                                                                 |
| `src/lib/theme-transition.ts`                                 | 原生 View Transitions + clip-path circle 500ms；没有 API 时 opacity 淡出 125ms + 淡入 125ms。等待 next-themes 实际更新 class；减少动态、快速切换及动画失败均可取消动画。                |
| `src/types/view-transitions.d.ts`                             | TS 4.9 的可选 startViewTransition 声明，包含三个 Promise 与 skipTransition；不使用 any。                                                                                                |
| `src/lib/motion.test.tsx`、`src/lib/theme-transition.test.ts` | 六个新增测试，覆盖偏好实时变化、两种减少动态、降级、圆心/等待 class、快照失败。                                                                                                         |
| `docs/design/PROGRESS.md`                                     | 交接进度。                                                                                                                                                                              |

没有新增依赖，没有改接口、Socket、存储键、数据库路径、后端或播放会话逻辑。manifest 和 next-env.d.ts 与开工备份一致。

## 命令验证

| 命令                                           | 结果                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                               | 通过，退出码 0。                                                                                                                                              |
| `pnpm lint`                                    | 未通过，退出码 1；错误来自未改文件，如 API、MusicClient、db、vendor、node-web-environment。完整日志见 output/playwright/p1/lint.log。                         |
| `pnpm test`                                    | 未通过，退出码 1；24 个测试套件、185 个测试通过，1 个旧套件无法加载：scripts/migrate-branding.test.js 的 node:test 被 Jest 27 解析成 test。新增六个测试通过。 |
| `node --test scripts/migrate-branding.test.js` | 补充验证：旧迁移套件使用自己的 Node 测试运行器，5 个测试全部通过；不等于修复了 pnpm test 的运行器冲突。                                                       |
| `pnpm format:check`                            | 未通过，退出码 1；原有 565 个文件不符合格式。未批量格式化它们。                                                                                               |
| 仅本次修改文件的 ESLint / Prettier             | 通过；ESLint 有 layout.tsx 原有样式链接警告。                                                                                                                 |

未跑 test:rooms：本轮没有修改房间文件、协议或行为；全量 Jest 内的现有房间前端测试已通过。没有用构建代替浏览器验收。

## 浏览器验证

本地 pnpm dev，Chromium，真实首页与现有本地测试账号，未伪造影片数据。

- 主题按钮原生圆形动画实际记录：以按钮中心为圆心，500ms，使用 --tm-ease-out。
- 临时关闭浏览器原生 API，实际点击按钮：125ms 淡出 + 125ms 淡入，主题成功更新。
- 根节点减少动态设为 true、系统 reduced-motion 设为 reduce：两次实际主题点击均未创建动画。
- 玻璃计算样式从 blur(24px) saturate(1.6) 变为 none；减少动态的骨架初始 opacity=0，450ms 时为 1，扫光 animation-name=none。测试探针已移除。
- 新浏览器上下文，系统浅色，分别测试默认 / 已存浅色 / 跟随系统；每种采样首 20 个有 CSS 的绘制帧：默认从首帧就是深色 rgb(10,10,10)，其余从首帧就是浅色，无先白后黑。next-themes 原有前置脚本保留。
- 现有“我的”选择框包含三个选项，实际选择跟随系统成功。
- 六种首页条件没有 document 横向溢出；主题按钮为 44 × 44px，键盘聚焦显示 2px 实线、2px 偏移的聚焦环，见 screenshots-check.log 与 keyboard-focus.log。
- 六张图已逐张检查：是本轮基础层状态，侧栏、Hero 结构、评分仍是旧实现，不能作为后续阶段完成的证据。

| 宽度与高度 | 深色                                                  | 浅色                                                   |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------ |
| 390 × 844  | [截图](../../output/playwright/p1/home-dark-390.png)  | [截图](../../output/playwright/p1/home-light-390.png)  |
| 820 × 1024 | [截图](../../output/playwright/p1/home-dark-820.png)  | [截图](../../output/playwright/p1/home-light-820.png)  |
| 1280 × 900 | [截图](../../output/playwright/p1/home-dark-1280.png) | [截图](../../output/playwright/p1/home-light-1280.png) |

浏览器已有外部资源问题：访客海报请求部分 418；登录首页 bangumi 探测 404、TMDB upcoming 400；Next Image 的旧 onLoadingComplete 警告。未修改这些业务或第三方请求。Safari / Firefox 与真机尚未实测；无原生 API 的降级路径是在 Chromium 中关闭 API 后验证。

## 残留彩色和渐变（本轮未改）

以下行号以当前代码为准；“保留”表示等待后续阶段，不代表符合设计规范。

| 位置                                                                                                           | 残留                                                                         | 后续阶段                    |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------- |
| globals.css:11、34                                                                                             | NProgress 蓝色条与蓝色发光阴影                                               | P2 / P5                     |
| globals.css:70、112、273                                                                                       | 旧 body 彩色渐变（现在被 token 覆盖）、渐变遮罩、旧扫光                      | P5 清理定义和调用           |
| globals.css:336、401、825                                                                                      | 旧加载动画绿/蓝/紫/石灰色、线性/径向/锥形渐变                                | P5                          |
| globals.css:981–1153；VideoCard.tsx:1323、1345                                                                 | 分档评分金橙/粉/蓝灰角标、星星、奖章与渐变                                   | P3                          |
| globals.css:1735、1754、1807、2033                                                                             | Hero 背景硬编码偏蓝黑、双重渐变遮罩、金色评分                                | P3                          |
| VideoCard.tsx:1067、1300、1380、1516、1577、2058、2101                                                         | 蓝链接/来源、粉徽标、多色边框、绿色进度/悬停/提示；1152、1786、1873 渐变遮罩 | P3 / P5                     |
| app/page.tsx:988、1035、1047                                                                                   | 公告按钮、直链输入聚焦、确认按钮的蓝色                                       | P3                          |
| features/rooms/rooms.css:96、128、131、491、503                                                                | 红色硬编码、绿色/棕色连接状态                                                | P4                          |
| features/playback/playback.css:6、74、118、132                                                                 | 偏蓝背景与面板、绿色标签、红色关闭按钮等硬编码                               | P4，仅样式                  |
| app/login/page.tsx:352、353、370、424、443                                                                     | 卡片渐变、绿色标题/聚焦/复选框/按钮                                          | P5                          |
| app/duanju/page.tsx:502、588、641；app/douban/page.tsx:884                                                     | 蓝色分段和加载器、绿色浮动按钮/加载器                                        | P5                          |
| app/movie-request/page.tsx:220、239、244、293；app/about/page.tsx:29；app/advanced-recommendation/page.tsx:143 | 黄色提示、蓝色输入/按钮、绿色状态、琥珀色文案                                | P5                          |
| 其他老页面及组件                                                                                               | 搜索、播放、音乐、漫画、书、影库、电视、设置弹窗等仍有彩色 Tailwind 类及渐变 | P5，按调用路径逐项处理      |
| app/admin/page.tsx                                                                                             | 多色按钮与状态标签                                                           | AGENTS 禁区，只记录，不修改 |

[完整静态候选清单](../../output/playwright/p1/residual-colors-gradients.txt)包含路径、行号和匹配内容。它是检索清单，不是全部都应删除：影片图像颜色、规范许可的骨架扫光、遮罩用黑白及错误态仍须人工区分；保护文件不因此获得修改授权。

## 缺失项与下一步

- 项目没有 Noto Sans SC 字体，未生成指向不存在文件的 next/font/local 配置。当前使用规范回退栈。请提供允许随项目分发的 Noto Sans SC Regular / Medium / Bold（400 / 500 / 700）WOFF2 文件及许可证；也可提供覆盖这些字重的可变 WOFF2。到位后再通过 next/font/local 挂载 --tm-font-sans。
- fadeUp / stagger 作为工具导出，尚未接入页面；Hero 自动轮播、导航 layoutId、海报倾斜等留给对应阶段，不属于本轮“全站动效已整改”。
- 下一步 P2 外壳，需按既定阶段另行授权；本轮没有自动开始。
