# P3 分类、详情与入口修订验收 — 2026-10-11

## 修改范围与规范对应

| 文件                                        | 修改                                                                                                            | 对应规范                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| src/styles/home.css                         | 分类选中态与手机 18px / 44px 排列；详情按钮等宽等高、一起看文字使用 --tm-text、边框使用该 token 的 40% 透明度   | DESIGN.md §2.1、§2.2、§4、§5.1，以及本次明确修订要求 |
| src/app/page.tsx                            | 移除首页打开直链与源站寻片两个小按钮；电影标记 aria-current；用一次性页面展示参数打开原直链弹窗，消费后移除参数 | §5.1、§7 入口整合                                    |
| src/components/TongMuNavigation.tsx         | 更多新增打开直链；保留原源站寻片入口、地址和开关；选择入口后通知头像菜单关闭                                    | §7 入口整合                                          |
| src/components/UserMenu.tsx                 | 只给 MoreMenu 传递关闭菜单回调，避免原头像遮罩挡住直链弹窗                                                      | 本次入口迁移所需展示修正                             |
| src/components/DetailPanel.tsx              | 两处 episodesCount 使用明确 >0 三元判断，0 / undefined 返回 null                                                | §5.3，只修详情展示                                   |
| src/components/DetailPanel.actions.test.tsx | 两种展示模式分别验证零集数隐藏、正常集数仍显示；原播放和一起看回调测试保留                                      | 行为回归验证                                         |
| docs/design/PROGRESS.md、本报告             | 记录修订、结果和未验证项                                                                                        | AGENTS.md 进度要求                                   |

检查 DetailPanel 全文件的数字条件：发现的两处直接数字 && JSX 均为 episodesCount，已修。其余集数、人数及数组长度条件已使用 >0 / ===0 等布尔判断；image.width && image.height 位于计算逻辑中，不是 JSX 条件，保留。未修改数据获取、API 或字段含义。

## 入口迁移对照

| 原位置               | 新位置                             | 行为                                                                                                                                              |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页“打开直链”小按钮 | 头像 → 更多 → 打开直链             | 回首页并打开原“直链播放”弹窗；提交、链接编码、网盘识别和播放跳转原逻辑不变。仅新增 /?open=directplay 展示参数，打开后消费并移除；保留其他页面参数 |
| 首页“源站寻片”小按钮 | 头像 → 更多 → 源站寻片（已有入口） | 保留 /source-search 和 ENABLE_SOURCE_SEARCH 原开关；不增加重复入口                                                                                |

首页 AI 问片按钮保持原状，没有扩大修改。没有删除路由，没有修改 Socket、接口、存储键、数据库、播放器会话或其他禁区，未新增依赖、提交、推送或部署。

## 验证结果

| 命令                                                  | 结果                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| pnpm typecheck                                        | 最终原命令退出 0，通过                                                                                  |
| pnpm test -- --runInBand                              | 退出 1；200 项通过、28 套件通过；原 scripts/migrate-branding.test.js 因 node:test 与 Jest 27 冲突仍失败 |
| pnpm test:rooms                                       | 退出 0；19/19 通过                                                                                      |
| pnpm lint                                             | 退出 1；原有 81 错误，未扩大修复                                                                        |
| pnpm format:check                                     | 退出 2；580 个文件有格式问题，未全局格式化                                                              |
| 本轮五个 TS/TSX 展示文件及测试 ESLint                 | 退出 0；0 错误、44 个旧警告                                                                             |
| 已格式化的 page、TongMuNavigation、home.css、详情测试 | Prettier 检查退出 0；DetailPanel 和 UserMenu 保留原格式                                                 |

最后重跑期间，Node 24 曾让 typecheck / Jest 进程异常退出；相关日志已保留。辅助 --no-opt 类型检查也遭遇 TypeScript 运行时异常，不作为通过依据。最终 pnpm typecheck 原命令退出 0；最终 Jest 重新得到上述 200 项通过和旧套件失败结果。未修改 Node、TypeScript 或验证工具配置。

完整日志、退出码和浏览器测量在 output/playwright/p3-four-fixes/。

## 浏览器验证

- Chromium 本地真实登录首页，360 / 390 / 820 / 1280 均检查深浅主题。分类行五项全部可见，行宽等于 scrollWidth，页面没有横向溢出。360、390 字号 18px，点按高度 44px；820、1280 字号 24px。
- 选中电影在深色为 rgb(250,250,250)，浅色为 rgb(10,10,10)，使用 --tm-text，其他分类使用 --tm-muted。
- 390 深浅详情：播放与一起看均为 157×48px。一起看文字分别为 rgb(250,250,250) / rgb(10,10,10)，边框 alpha 均为 0.4，截图已核对。
- 真实影片详情没有孤立“0”文本节点。测试另覆盖 0 集和 2 集、抽屉与弹窗两种模式。
- 在头像 → 更多连续两次打开直链、输入链接并取消；再从片库页打开直链，成功回首页打开原弹窗。原头像遮罩会挡住新弹窗，已用选择入口后关闭头像菜单的回调解决。
- 更多中的源站寻片只有一项，href 仍为 /source-search。没有为验收提交视频或改动账号观看记录。
- color-mix 与透明色混合用于 40% token 边框，保留实心 token 边框作为不支持时的回退；语法核对 [MDN color-mix 文档](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix)。

未验证 Safari、Firefox、物理手机；触摸详情使用 Chromium 派发的 TouchEvent。旧详情彩色资料区、字号、其他页面样式保持原状，未扩大修改。

## 截图

| 分类行宽度 | 深色                                                                   | 浅色                                                                    |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 360        | [查看](../../output/playwright/p3-four-fixes/categories-360-dark.png)  | [查看](../../output/playwright/p3-four-fixes/categories-360-light.png)  |
| 390        | [查看](../../output/playwright/p3-four-fixes/categories-390-dark.png)  | [查看](../../output/playwright/p3-four-fixes/categories-390-light.png)  |
| 820        | [查看](../../output/playwright/p3-four-fixes/categories-820-dark.png)  | [查看](../../output/playwright/p3-four-fixes/categories-820-light.png)  |
| 1280       | [查看](../../output/playwright/p3-four-fixes/categories-1280-dark.png) | [查看](../../output/playwright/p3-four-fixes/categories-1280-light.png) |

- [390 深色详情](../../output/playwright/p3-four-fixes/detail-390-dark.png)
- [390 浅色详情](../../output/playwright/p3-four-fixes/detail-390-light.png)
