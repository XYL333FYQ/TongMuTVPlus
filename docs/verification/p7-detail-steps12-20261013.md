# P7 详情步骤 1、2：保留修改，验收中止

> 历史记录：此后已按用户新规则继续修正与验收。最新结论见 `p7-detail-final-20261013.md` 和 PROGRESS.md 当前 P7 条目；以下内容不代表当前状态。

日期：2026-10-13。仅 Codex，本次 Gemini 调用 0。未提交 Git、未新增依赖、未改变接口/存储键/Socket 事件。

## 当前结论

展示层已提取并接入，但没有完成最终验收，不能标记步骤 1、2 完成。最终串行 typecheck 和唯一一次环境重跑均为 Windows 原生异常退出 3221225477（0xC0000005），没有 TypeScript 源码诊断。按 AGENTS.md 环境重跑仍失败的规则保留修改并停止，不回滚之前已验收的 P5 文件。

两次检查均在本轮隔离预览停止、3215 端口无监听后运行。没有证据把这次失败归因于并行；原生异常的根因未定位。临时验收执行器首次未识别此异常码，输出了 Source typecheck failed；人工依据原始日志纠正为环境失败，没有据此回滚。本次只有一次环境重跑，没有继续第三次或绕过检查。

## 改动范围

- docs/design/DETAIL.md：末尾新增修订，记录用户确认的七项决定及本轮边界。
- docs/design/DESIGN.md：§5.3 去掉“详情尚未设计”，指向 DETAIL.md。
- src/components/DetailPanel.tsx：两套详情 JSX 合并为共享展示组件；原数据请求、状态、来源切换及数据请求触发条件留在本文件。只补现有 TMDB 响应的 backdrop 展示字段，不新增详情 API 请求。
- src/components/detail/DetailShell.tsx：原生 dialog 模态/非模态外壳、关闭、焦点、响应式形态和拖动展示。
- src/components/detail/DetailContent.tsx、DetailActions.tsx、DetailActors.tsx、DetailEpisodes.tsx、DetailAuxiliaryPanels.tsx、types.ts、detail.css：资料、动作、演职员、既有季集资料卡、辅助图片/纠错内容和 token 样式。
- src/components/BannerCarousel.tsx：普通详情改用响应式形态，传已有横图。
- src/components/VideoCard.tsx：传已有收藏回调及状态；纯豆瓣/TMDB 不传收藏回调。原播放/收藏请求函数没有重写。文件同时有局部既有代码的格式整理。
- src/components/PublicCatalogPage.tsx：访客独立详情复用同一展示外壳/内容，保留公开资料和原播放、一起看、搜索入口；不接入认证详情请求。
- src/components/DetailPanel.actions.test.tsx：原断言保留，补 matchMedia 测试环境模拟。
- src/components/DetailPanel.presentation.test.tsx：新增模态语义、侧栏保持、顶层取消、零集数、季集资料顺序、收藏和焦点测试。
- docs/design/PROGRESS.md：记录当前中止状态。

本轮未改 LegacyPlaybackSurface、useWatchRoom、usePlaySync、session.ts、PlaybackSessionProvider、server、API、数据库、middleware、admin。工作区里原有 P5/P4 修改未覆盖。

## 请求记录

环境：本机隔离账号与数据库；浏览器拦截固定资料响应。统计范围为打开详情后的影视资料 API，不包含 Next 开发脚本、图片和其他全站请求。剧集场景包含打开后点“切换到 TMDB”；不是纯打开动作。

### 拆分前

电影：1 次，GET /api/douban/detail?id=901。

剧集：6 次，均为 GET：

1. /api/douban/detail?id=902
2. /api/tmdb/search?query=验收剧集
3. /api/tmdb/detail?id=902&type=tv
4. /api/tmdb/seasons?tvId=902
5. /api/tmdb/credits?id=902&type=tv
6. /api/tmdb/episodes?id=902&season=1

原始记录：output/playwright/p7-detail-20261013/before-network.json。拆分前电影、剧集各留了一张截图，仅供基线比对，不是最终效果截图。

### 拆分后

未验证。因最终类型检查及环境重跑失败，没有重新启动预览；不能声称两次网络清单和次数一致。

静态 AST 对比通过：13 个 fetch/getBangumiSubject 请求表达式、4 组数据 effect 依赖与拆分前一致。此证据不替代浏览器实际请求次数，尤其不能排除重渲染或挂载时序造成的行为差异。

## 验证结果

| 项目 | 结果 |
|---|---|
| 最终 pnpm typecheck | 失败，原生异常退出 3221225477，无源码类型诊断 |
| 唯一一次环境串行重跑 | 同样失败，PowerShell 显示 -1073741819，即同一异常码 |
| 最终 pnpm lint | 未运行，按中止规则停止 |
| 最终 pnpm test | 未运行，按中止规则停止 |
| 最终 pnpm format:check | 未运行，按中止规则停止 |
| 最终 pnpm test:rooms | 未运行，按中止规则停止 |
| 展示文件 check-design | 违规 0、TODO 0；检查范围为 DetailPanel 及新展示组件 |
| 请求 AST 比对 | 通过，13 个请求表达式、4 组数据 effect 依赖一致 |
| 阶段性 actions/presentation 测试 | 当时 2 套件、10 项通过（原 6 项 + 新 4 项）；之后追加 3 项测试，最终未重跑 |
| 阶段性 scoped ESLint | 自动修正后无错误；原请求控制器的 any/console/effect 依赖警告保留，不为清警告修改请求触发条件 |
| 阶段性目标代码格式 | 已执行目标文件 prettier --write；不等于完整 format:check 通过 |

开发中的首次类型检查曾指出 4 个展示类型错误，已修正；这不是最终类型检查通过的证明。新增交互测试先在旧实现上实际失败（3 失败/1 通过），实现后阶段性通过，没有把测试环境缺少 matchMedia 当成功。

## 未完成与风险

- 最终 1280/820/390 深浅截图、电影/剧集、有无横图、访客矩阵均未验证。
- 拆分后请求清单、季集/照片墙/纠错/演员原行为、播放页侧栏实际宽度与交互未做最终浏览器复验。
- 手机固定底栏遮挡、拖动关闭阈值、原生最上层 Esc、焦点返回、减少动态/无模糊均未做最终浏览器复验。
- 静态检查发现手机拖动条交互区域目前 28px，需要后续扩为至少 44px；未把点按目标检查标为通过。
- 退出动效、背景滚动隔离、横图交叉淡入、窄列布局仍需浏览器检查，不能凭代码存在认定效果符合画板。
- 换页、小窗收起/恢复后的同一个 video 节点及时间继续前进未验证。
- Safari、Firefox、真机、真实上游未验证。
- “一起看”仍是原跳转，选房间面板、待加入横幅、新存储键均未实现；没有进入计划步骤 3–5。

## 本机验收文件

根目录：C:/Users/ss/Documents/桌面图标/编程/ai项目/TongMuTVPlus/output/playwright/p7-detail-20261013/。

runtime/credentials.json、runtime/auth-state.json、runtime/qa.db（及存在的 -wal/-shm）、runtime/dev.log、runtime/owned-pid.json 是隔离验收文件，不进入桌面压缩包。没有删除任何临时文件。验收浏览器 tm-p7-detail 已关闭，隔离 server PID 12952 已停止，3215 端口无监听。

下一步先处理类型检查运行环境，然后继续当前步骤 1、2 的修正与完整验收；不开始“一起看”功能。
