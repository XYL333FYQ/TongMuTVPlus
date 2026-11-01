# 三端体验执行账本（2026-10-31）

用户已确认完整方案并要求按计划执行，允许提交、GitHub 构建、VPS 部署和客户端测试。手机不能 USB 连接，真机最终验收采用诊断导出和录屏。中间件仅公开 Worker 静态脚本的精确例外已确认。

## 固定边界

- 保留既定玻璃、模糊、主题扩散、导航及页面动效与时长；整条底栏入场与滑块分开取证。
- 保留播放单例、房间协议、数据路径、既有存储键及鉴权。仅增量壳能力与必要 Windows 平台绑定；不重写播放器、原生底栏、PDF 引擎或自动更新框架。
- 同时只有一个写入者。逐批检查并更新本账本与 PROGRESS；不回滚此前验收的批次。

## 执行批次

- [ ] 1. 构建身份、生产制品对照、Worker 单一注册与缓存修复；保留原始诊断证据。
- [ ] 2. 线上整条底栏诊断、尺寸缓存、按帧拖动与切页调度，保留全部效果。
- [ ] 3. 返回登记、层级导航、五个一级页运行内记忆、键盘与局部刷新。
- [ ] 4. Android 本地启动与故障恢复、系统媒体/PiP 及下载更新授权续下。
- [ ] 5. Windows 宿主进程故障恢复、窗口兜底、本地界面及链接下载处理。
- [ ] 6. 跨端动作/文案、表单反馈、安装教学与能力降级扫尾。
- [ ] 7. 全套检查、GitHub APK/EXE 与 ARM64 镜像、隔离验证、VPS 发布与回退、真机验收。

## 部署基线（只读核对）

- VPS：azureuser@52.253.104.47，ARM64；Compose 目录 /home/azureuser/services/TongMuTVPlus，服务 tongmutvplus，127.0.0.1:3000，Nginx tv.eren.cc.cd。
- 原运行镜像：ghcr.io/xyl333fyq/tongmutvplus@sha256:ba65d6891e942d794f1b0e26ca61fc0005f5b0d7f19749c54ce36c6b0448895b，OCI revision 132ca5f1fefe25256d0272c7907f9ca7007d4290。
- 原 Next BUILD_ID：\_7OyQy1eNq_NFelhcc2Oo。健康接口 buildSha=08c4f83，不能据该陈旧变量判定真实运行版本。
- 原镜像相关导航文件与本地一致；首页 9 个 CSS 内容哈希一致。未确认手机实际 Worker 与缓存状态，不能将 SW 问题称为掉帧根因。
- GitHub 三条构建工作流可用；release 环境有人工审核，不移除门槛。原生编译在 GitHub 完成，本机不安装 Rust。
- 发布前在线备份 SQLite，保留旧镜像/配置/静态资源；代码回退不覆盖发布后的用户数据。

## 当前进度

最新交接：正式网页仍 c28ab11；Windows cbee5dd 完整非发布流程全绿。Android 0f9623e 的 APK/API23/24/34 与完整 Checks 全绿，系统媒体会话/通知/后台暂停恢复已实测；旧 TLS 间歇等待未再现但根因不明。当前 PiP 比例/能力/配置精化候选尚待真实影片与系统窗口验证。8fef3d1 响应式网页候选已在 VPS 隔离实例通过真实触摸和三宽深浅，未切正式服务。客户端均未发布；真机底栏根因仍未知。

- 1ee0196 的 Linux Checks 41217779457 全部通过，Android APK/Java 门禁编译通过；API24 的输入法、坏海报不接管、浅色 HTTP503 原生界面/重试、深色 TLS 拒绝/设置恢复通过。API34 同样完成上述流程及 renderer KILL/SEGV 后宿主 PID 不变、本地重试通过，但旧脚本因外部 UiAutomation 的 Bad file descriptor/FATAL 判整支失败，不能把整支标绿；已补应用 PID 前后核对与按进程识别的崩溃门禁，4 个 Java/native 宿主/工具/renderer 日志用例验证过滤不放过本应用崩溃。
- API23 的启动/桥/IME/HTTP 原生恢复通过，主 TLS 阶段停留加载而未得到预期错误文案；其系统 Provider 是 Chrome44，补充 deprecated 主文档错误回调及无 URL 日志码，待再跑确认，不提前称原因已完全定位。API23 壳冒烟不证明旧 Chrome44 能渲染 Next 站点，真实网站还依赖可运行本站的系统 WebView。

- 第四批 A 验证门禁：前台 pnpm typecheck/lint 退出 0；标准 Jest/format 再次原生退出 3221225477，备用 Node 24.22.1 --jitless 在执行用例前 V8 unreachable code 原生退出 2147483651，未出现源码断言，日志保留，不计通过。本批未改任何共享 TS/播放器/房间源码，其基线 2bc2ba2 的 Linux 完整检查已通过；新提交仍须等待 Linux 完整检查及 Android 编译/模拟器。四个可格式化文件逐文件同版本 Prettier 均 0，Java release17 状态测试、Python/XML/bash 解析及假 HTTP503→200 重试服务验证均通过。

- 第四批 A 实施中，尚未编译/模拟器验收：MainActivity 接入 AppStateView 与纯 Java LoadState，本地品牌、连接、HTTP/TLS/超时和显示进程退出恢复；地址/错误码收进详情。主文档失败才接管，坏海报不接管整页，证书始终取消。下层网页不接收触摸/无障碍访问；正常 SPA 保留原 WebView。
- Ruling：错误文档的同 URL 遗留回调无法只靠 URL 判别，用户重试时重建失败的 WebView；Cookie/原服务器设置不变，代价是故障后的网页历史、未保存状态可能丢失，不能承诺无损恢复播放。此选择不应用于正常切页。
- 最低系统事实更正：源码 minSdk=23，之前“实际 24”的记录有误。新冒烟增至 23/24/34，API26 renderer 客户端独立按版本加载；API23–25、整个宿主被 OS 结束时不承诺活体恢复。[Android 回调依据](https://developer.android.com/reference/android/webkit/WebViewClient)。
- 纯 Java 文档状态测试先因缺类失败，补实现后 javac/java release17 通过；Python AST/XML/bash -n 通过。模拟器 HTTP503、主 TLS、坏海报不接管、设置恢复及 26+显示进程退出/重试场景均待运行，不称通过。写进度并启动后台验证的组合命令被自动审批拒绝，仅返回 blocked by policy、无具体原因，未执行；改用前台串行检查。
- 上批补强证据：b60eeea 的受控 Worker 浏览器退出 0，active/controller 都是 activated /sw.js，456 项预缓存全为 /\_next/static/，离线私有 API 不可读、切页与重连不 reload。真实数据备份副本在 internal Docker 网络，内部健康及 my/search/douban/记录/收藏/我的房间接口均 200，SQLite integrity=ok；宿主 3010 不可达是该隔离网络边界，不能称启动失败。生产仍未切换。

- 第三批键盘小批实施中：App 下输入法打开时隐藏同一底栏节点，不切 display、不重建导航；普通 web/Windows 不启用。新 Android 壳由 API30+ WindowInsets 的 IME 可见性提供真实标记，旧系统保留现有算法；PWA/旧壳在聚焦编辑器且无缩放、有明显可视高度缩小时才回退判断。原生标记优先，不写播放器 Provider 已有的 `--tm-visual-height`，不触碰会话逻辑。定向 5 项先红后绿；整批与 APK/真实软键盘验证待做。
- 键盘边界：视口变小不必然是输入法（工具栏、缩放也会影响），故回退判断只在 App 生效；新壳采用真实 IME 状态。[VisualViewport 依据](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)、[Android WindowInsets 依据](<https://developer.android.com/reference/android/view/WindowInsets#isVisible(int)>)。此时尚未用真机证明 OriginOS 的键盘表现。
- 取证镜像构建 41206909486 已触发，固定源提交 0e1434b、请求标签 client-audit-0e1434b；标签门禁与复用完整检查已通过，两种架构构建中。发布前 latest/v0.1.1 与运行镜像均核对为原 digest ba65d689...，完整记录 output/client-experience/registry-before-image.log；正式服务未切换。

- 第二批补证：诊断 schema 2 增加 document timeOrigin、Navigation Timing 类型、BFCache 恢复标记，pagehide 时只在本次会话保存最近 3 个文档的白名单摘要（安全路由、构建号、计数/最后 top），不存整份报告、查询参数或账号/房间标识。`?perf=0` 清理摘要，停止记录器后移除监听；默认关闭时不挂采样。新跨文档/隐私/有界历史回归先红后绿，BFCache 补充覆盖，定向 14 项通过；完整 Jest 169 套/1095 项、lint 退出 0；typecheck 初次无 TS 诊断原生崩溃，确认预览关闭后串行重跑退出 0，日志分别保留。
- 补证验证限制：本机完整格式检查原生退出 3221225477，6 个改动文件以同版本 Prettier/Node 24 的逐文件 `--jitless` 检查均为 0，完整检查交 CI 接续。本地“启动预览并打开浏览器”组合命令被自动审批拒绝，仅返回 blocked by policy，无具体理由，未执行/未重试等同命令；浏览器验证待原计划 Linux 隔离生产实例，不声称新 schema 的实际整页跳转已验。
- Ruling：保留文档边界摘要以判别整页重开和同文档切页；它不能证明触发重开的原因，也不等于 GPU 呈现帧。不能因为用户看到进场或一份 Timing 就将根因写成 VPS/缓存已定位。

- 发布隔离补丁：发现原工作流的矩阵构建会直接覆盖版本标签，且构建后删除无标签镜像与工作流记录，会影响正式别名和回退证据。改为矩阵只按 digest 推送，合并阶段统一校验标签；分支只使用 `client-audit-*`，默认分支增加不可变 `sha-*`。标签函数先红后绿，与 Worker 策略共 7 项通过；未据局部测试声称生产镜像已验证。
- 发布隔离 1509af1 的 Checks 41204918187、3B 的 Checks 41204509135 已通过，含 Linux 生产构建及房间/运维/生成 SW 检查。尚未执行新镜像发布，后续还要对照正式别名前后 digest，不能仅看函数单测便称发布隔离已被实际验证。
- Ruling：从构建流程移除全量无标签镜像清理及工作流历史清理，保留原生 release 审核门槛；代价是仓库/制品存储增加，之后须按实际在用 digest 制定保留策略，不能在每次构建时盲删。
- 下一步优先取得已验收改动的 Linux/ARM64 隔离生产实例，补五栏与真实构建/Worker 取证，再实施后续原生批次。生产切换仍须完成镜像与数据备份、隔离测试和回退准备，不因提前取证省略发布门禁。

- 第三批 B 已实现：客户端运行内记忆按平台和账号隔离，64 个条目上限，不写新持久键；普通网页不启用。搜索恢复草稿/筛选/高级筛选开合，片库按类型恢复分类/多级筛选/星期/视图。底栏（含拖动）与桌面一级入口返回上次栏目 URL；URL 只保留已知一级路径和搜索/分类参数。
- 片库每种类型只记最近一份已完成的元数据列表，最多 300 条、绝对 5 分钟失效，不保留页面树、播放器或媒体。返回时保留已加载页数，再加载从下一页继续；处理中切走不能把未完成页数保存为成功。旧请求/换账号/换 key 不覆盖新状态。上述回归与网页同页换查询仍保留原筛选行为均先红后绿。
- 滚动恢复等待内容高度足够，最长 8 秒；用户滚动/触摸主动取消恢复，避免拉回。登录/注册清运行期记忆。最终 typecheck/lint/test/format 串行退出均 0，169 套/1091 项；状态文件 output/client-experience-memory-verification.json。新测试夹具一次 scrollTo 重载类型标注错误已修正；两次中断/损坏输出未计通过，不改 tsconfig/依赖绕过。
- 浏览器：App 标记与普通 web 对照各 390/820/1280 深浅 6 组，草稿/片库类型/日本筛选与 600px 恢复及网页原重置行为通过，均 pageerror 0、无横向溢出，截图与结果在 output/client-experience/memory-\*。目录资料为测试夹具、登录及路由/表单为实际代码，壳标记模拟，不等同真机或真实上游播放。
- 首次脚本未等待电影 → 剧集切页，误操作同名按钮；记录确认点击链接后仍在 movie，增加目标 URL 和活动栏目等待后通过，未因此改业务代码。补充五入口：首页阶段预览 Node 进程编译时退出，无 JS 根因日志，未计通过；我的/房间访问不代表五栏验收完成。后续 Linux 隔离生产实例补验。预览进程已不存在，不将未知退出归因于产品或 VPS。
- Ruling：用少量状态和有上限的目录资料恢复栏目，不同时挂载多个隐藏页面；超过列表上限或过期走正常加载，成本是很深的分页可能需要重新加载后才能到原位置。
- 补充 `pnpm test:rooms` 27/27 通过。浏览器关闭后整理文档时，普通 Node 的 Prettier 一次 V8 descriptor 检查原生崩溃，根因未知；源码最终完整格式检查此前为 0，文档单独以 `--jitless` 再检查，不修改项目运行参数。

- 第三批 A：增加可清理的返回层登记与 hook，接入详情、通用弹层、确认框及手机操作面板；原生 dialog 接收 cancel 请求，退出动画期间不交给页面历史。聚焦菜单先按既有 Escape 约定收起。确认任务 pending 时系统取消、关闭按钮和背景关闭一致拦截。
- 第三批 A 验证：回归先红后绿，最终完整 Jest 166 套/1078 项、typecheck/lint/format 均通过。一次全量两套依赖初始化异常（undefined.defineProperty/isArray），14 项单独重跑及最终全量通过；日志保留，不据此修改依赖或声称根因已定。重跑过程一次输出损坏且进程句柄失效，未计为结果。
- 详情及“更多”菜单 390/820/1280 深浅 6 组实际验证通过：先收菜单、详情保留、退出动画连续返回不误退、移除后返回清理、无横向溢出，pageerror 0，截图 back-detail-\*、结果 back-browser-result.log 位于 output/client-experience/。部分初次脚本依赖未显示的 Hero/用了游客或播放入口而超时，未算通过；最终从真实卡片的键盘详情入口验证。壳桥由测试脚本模拟，只证明网页回调行为，不是真机系统返回验证。
- 返回层后续：一级页记忆、层级回退、键盘与局部刷新未做，不将第三批标记完成。

- 第一批 CI 已通过：Checks 41185029429（提交 1ebe4e4），含 Linux 生产构建、真实 SW 生成边界、房间/运维及全部检查。
- 第二批诊断入口已实现：?perf=1 默认关闭/显式开启，采集整条 nav 身份/位置/显隐/动画、安全区和视口、编译标识与 Worker/构建资源；最多 12 段、每段 1.5 秒，支持本地复制/下载。报告说明 DOM/rAF 不代表 GPU 呈现帧，不含查询参数、媒体签名 URL 或私密房间标识。
- 本批验证：完整 Jest 164 套/1069 项通过；修正后定向 13 项通过；最新 typecheck 与 lint 退出 0。390/820/1280 深浅 6 张截图无横向溢出；真实浏览器下载 JSON 成功，含 3 段 646 个采样帧。证据 output/client-experience/，预览仅隔离数据库副本，已关闭。
- 本批只建立真实问题取证能力，未证明手机整条入场原因、未修改导航动效、未部署生产；后续返回、记忆、键盘、原生壳等仍全部待做。

- Ruling：沿用户批准的任务分支方式在当前干净检出执行，不另复制工作区；基线为已上线主线 132ca5f，避免对旧特性分支继续堆叠。
- 第一批：公开脚本精确放行、独立单注册入口、停止重连自动 reload 及动态页面缓存、旧动态响应定向清理、构建提交号写入 Docker 和页面已实现；生产未修改。
- 验证：完整 Jest 串行 161 套/1062 项通过；新增注册/激活/中间件 8 项及 Node 缓存迁移 3 项通过；typecheck/lint/format 退出 0（既有 warning）。
- 本机生产编译、类型和 230 路由生成完成；standalone 复制因 Windows symlink EPERM 失败，原日志在 output/client-experience-build.log。不改配置绕过，转 GitHub Linux 验证。
- 生成 Worker 检查发现全 public 预缓存会抓取可选字体/媒体和受保护文件，已关闭全 public 预缓存，保留 Next 构建资产。CI 将检查真实生成产物；当前旧产物的预期失败不算通过。
- 下一步：第一批提交任务分支后由 CI 验证，同时开始整条底栏诊断。其他批次未完成。
- 尚未验证：用户手机的整条底栏进场、GPU 呈现、原生返回/输入法、故障恢复与 Windows 真实客户端。

- 键盘小批静态验证完成：完整 Jest 170 套 / 1100 项、lint、format:check 均退出 0；首次 typecheck 在 TypeScript 内部 instantiateSymbol 抛异常，无源码 TS 诊断，保留原日志后串行重跑退出 0（output/client-experience-keyboard-typecheck-retry.json）。未改依赖/tsconfig；APK 编译、API24/34 与实际软键盘仍待后续验证，不能将单测当真机通过。
- 测试镜像实证：GitHub 41206909486 成功，client-audit-0e1434b 多架构 digest 为 sha256:1cbd05922ba1ed9268d826f1945bbf2908507ea0097935b45f30fa418d347d88；构建后 latest / v0.1.1 均仍为 ba65d689…，正式别名隔离已实际验证，尚未替换生产容器。
- Ruling：首先用独立空数据库和随机测试账号验生产路由/诊断，不复制正式通知及后台任务配置到在线测试服务，以免隔离副本向真实外部服务发送任务。真实数据迁移与备份另在发布门禁验证，成本是该轮不能证明正式用户数据兼容。

- Linux 隔离实例发现发布门禁问题：0e1434b 真实 SW 包含 /\_next/app-build-manifest.json；匿名实际请求 404，浏览器注册后 worker 无 active/waiting/installing，ready 不完成。该文件是 App Router 内部编译清单，开发环境关闭 PWA 所以不出现。原生成器校验只允许 /\_next/ 太宽，未阻止此坏清单；本轮精确 buildExcludes 排除，并把产物断言收紧至 /\_next/static/。新增回归先红后绿，Node 策略 8 项通过，修正镜像与真实安装验证仍待做；不称为手机整条入场根因。
- 7e847cf 的 Checks 41208969404 通过；Android 41208971370 APK 编译及 API24/34 冒烟全部通过，Publish to Releases 按 publish=false 跳过。没有据启动冒烟声称软键盘/真机通过。
- 清单修复验证：新增策略回归由 false !== true 失败转为通过；收紧的真实产物检查在旧 public/sw.js 上按预期拒绝 /\_next/app-build-manifest.json，日志 output/client-experience-pwa-generated-red.log。修复批 typecheck/lint/test/format 四项串行全部 0，完整 170 套 / 1100 项（output/client-experience-pwa-manifest-verification.json）；新构建产物及浏览器激活须继续由 CI / 新镜像证明，不用旧产物检查失败冒充修复通过。

- 隔离生产浏览器补验：390/820/1280 深浅六组均完成 schema2 的真实 reload 边界和 SPA 同文档断言，图片及诊断 JSON 在 output/client-experience/vps-0e1434b；后续等待 Worker.ready 超时，整支脚本退出 124，故不称整支通过。底层 CDP 明确报告 bad-precaching-response，URL 为 /\_next/app-build-manifest.json、status 404，确认 Worker 安装失败原因。
- 五入口独立脚本最终退出 0：搜索草稿 → 片库剧集/日本/600px → 我的 → 房间 → 发现 → 搜索/片库，草稿、分类筛选和片库滚动恢复通过，pageerror 空。最初等待 load 被未完成资源拖住而超时，改为 DOMContentLoaded 后另等真实活动栏目/卡片，不修改产品代码；保留首次日志。资料为测试夹具，独立空库，未证明真实媒体、房间同步或用户手机。
- 生产 DOM 取证中 390 深浅切页的整条底栏一直为同一节点，top=824、transform=none；这只是当前 Linux Chromium 的结果，仍不能反驳用户 OriginOS 实际看到的进场。Worker 缺陷与该体验的因果关系尚未建立。
- Android 冒烟新增真实 IME 验收：假页面可访问输入框，通过 UIAutomator 定位后点击，等 native open 上报，再系统返回等 closed，并保存两张截图。Python AST 与 bash -n 通过；API24/34 执行待 GitHub 验证。此批仅测试脚本，不改 App 或网页业务。

- API24 的真实 IME 开关在 41210025661 通过，已检查键盘截图与 native open/closed 上报。API34 失败的 XML 显示通知授权对话框遮住网页，并非输入法判断已证实有错；测试改为识别 permission_deny_button 明确拒绝后再找输入框。用首次失败 API34 XML 回放输出 permission 160 420，用 API24 XML 输出 input 139 132；bash -n 通过。未改 App 逻辑。
- 备份已完成：VPS backups/client-experience-20261031T142823Z，SQLite 在线 backup 后 integrity_check=ok，保留 auth-secret、Compose/.env、nginx 与旧 static，共 16M；旧镜像另有本地 client-rollback-132ca5f 标签。生产仍是 ba65d689…；发布时仍须复核健康、静态兼容和代码回退，备份不等于已部署。
- Ruling：本次输入法测试修正先推临时 codex/client-ime-verification 引用进行非发布构建；主任务远端保持 b60eeea，避免同 ref 的自动 Checks 取消正在运行的 41210096560 镜像门禁。镜像门禁结束后再把同一提交推回任务分支，不分叉应用实现、不发布测试 APK。

- 取证制品闭环：41210096560（b60eeea）双架构成功，digest sha256:46e5ac38f5af14232c18b308363c045be92ffd9943fb7abea09fdd3cf00afae8；latest/v0.1.1 仍是 ba65d689…；VPS ARM64 的 OCI revision 与 b60eeea 完整提交匹配。新隔离实例 127.0.0.1:3009 健康，浏览器容器 tm-client-audit-browser-b60eeea 退出 0，六组 390/820/1280 深浅真实 reload/SPA、Worker /sw.js 激活、脚本匿名可读、清除诊断及五栏恢复均通过，pageerror 空。证据服务器 services/client-experience-audit/b60eeea/artifacts，尚未切正式服务，非 OriginOS GPU 帧验证。
- Android 输入法闭环：41210597220（e068670）APK 与 API24/34 真 IME 开关通过，release 跳过。已下载两组截图与日志，API34 有 native closed → open → closed；原“通知权限遮住输入框”失败证据保留。e068670 已推回主任务分支，临时验证引用仅用于测试。
- 第三批 C 实施中：新增有界页面刷新登记/usePageRefresh，20 秒超时、重复合并、卸载取消和失败传播；MobileGestures 不再整页 reload，修复 touchcancel 触发刷新及横向/键盘/native dialog 抢手势。原 MobileGestures 五项平台边界测试恢复原样，新用例独立文件，未删除既有覆盖。
- 片库接入绕过栏目缓存的局部刷新，失败/超时保留旧列表，初始与分页请求使用代次挡住旧结果；首载/回栏/分页既有回归仍通过。首页首载与手动刷新共用加载器，手动只取可见推荐模块，保留原缓存键/TTL/排序/可选空结果保留规则。搜索等实际 HTTP/SSE 完成才结束刷新，不改变流事件名或结果过滤；修复布尔刷新回置导致二次 Effect 请求，离开后旧流不重建缓存。我的/首页播放记录走既有鉴权 GET 和规范事件，取消/换账号不发布迟到数据，不改 db.client 私有缓存或持久键。
- Ruling：播放记录只更新当前页与规范订阅者，不操作受保护的私有混合缓存；后续重新挂载仍沿用已有缓存先显/后台同步策略，不声称已重构全部账户缓存一致性。首页轮播/房间摘要、网盘/磁力子工具尚未接入本批下拉刷新，不将第三批打勾。
- 第三批 C 定向 7 套/36 项通过（随后新增 SSE 完成/卸载回归，搜索单套 8 项通过）；当前源码 typecheck 退出 0，完整 lint/Jest/format 与浏览器/媒体单例验证待接续。所有证据在 output/client-experience-\*，不得把定向测试代替最终效果。

- 第三批 C 静态检查收尾：typecheck 0、完整 lint 0；标准 pnpm Jest/format 各遇无 TS/断言诊断的原生退出 3221225477，原日志保留。备用 Node 24.22.1 --jitless 首次全量在 public-runtime-config 的依赖初始化报 undefined.isArray，173 套/1119 项已通过；该套单独 4 项通过，最终全量 174 套/1123 项全部通过（local-refresh-final.json）。所有 18 个改动/新增可格式化文件同版本 Prettier 逐文件退出 0；完整 format:check 仍由 Linux CI 补证，不标成本机完整通过。
- 下一门禁：本批提交固定到 codex/client-refresh-verification 构建验证，后续原生改动不移动该引用，避免取消镜像门禁；新局部刷新仍未做实际浏览器/媒体单例验收，不能据静态检查称交付。b60eeea 的浏览器结果只证明上一批 Worker/栏目记忆，不覆盖当前未构建源码。

- Android 第四批 A 接续：41218903663 的 API23 已走通 HTTP/TLS/输入法与原生恢复，最终失败是旧系统 pidof 返回多进程列表；改为解析 ps 的 PID 列并精确匹配主进程名。API34 在 HTTP503 后回到加载中，补充无 URL 的回调日志与失败状态保护，尚待下一轮实际证明，不能称已修复。
- LoadState 新增“失败后引擎回调不得自行重开”回归，显式重试才解除；JDK17 测试通过，Python AST、shell 语法、旧新 ps 格式夹具、diff 检查通过。失败界面的系统返回直接走原生历史，不等失效页面 JS，并新增实际 UI 回归；共享 TV 冒烟不注入手机专属故障资源。
- 本批不改网页、房间和播放会话逻辑；完整四项检查继续由提交后的 Linux Checks 验证，API23/24/34 和新返回流程尚未通过。发布仍为 publish=false，正式 VPS 未切换。

- 第四批 A 闭环：73fb734 的 Checks 41221713535 全部通过；Android 41221716012 的 APK、API23/24/34 实际 IME、主 HTTP/TLS、原生重试/设置/返回全部通过，API34 额外 KILL/SEGV 显示进程后宿主 PID 不变并恢复。release 跳过。已下载 23/34 制品，实看深色 SEGV 原生恢复截图，正常网页不显示浏览器错误文案；不是 OriginOS 真机结论。
- 第四批 B 更新续下实施中：UpdateRequest 保留用户已请求的 URL，授权设置返回后只续一次；拒绝清除，重复点击/无关广播不重复下载或安装。Activity 保存状态携带待授权请求和下载 ID，不新增 SharedPreferences 键；重新进入前台查询 DownloadManager 实际状态，后台完成等前台再调用系统安装器。目标文件按请求区分，避免同名旧文件阻止下一次更新；错误用原生提示反馈。
- Ruling：保留系统 DownloadManager 与安装器，不引入更新框架；Activity 状态可恢复不等于用户强停后永久记住任务。下载完成必须由系统查询确认，不信任完成广播携带的 ID。JDK17 新状态测试先因缺类失败后通过；实际授权拒绝/同意返回测试已加入 API26+，尚未运行，不称安装成功或下载失败 UI 已实测。系统安装最终确认仍交用户，不自动安装。

- 第二批拖动性能小批：源码确认 pointermove 每次混合读取 5 项矩形/偏移和导航位置、同时 React 写滑块。改为布局/尺寸变化及按下时成组量取，移动只读缓存；一次绘制帧只应用最后一个位置，松手仍同步读目标，不等绘制。取消、换路由及卸载清除未执行帧；保留原阈值、回弹、颜色/玻璃/时长和点击即时高亮。
- 新增布局读取次数、单帧合并、切页取消三项回归，均先红后绿；原拖动/慢渲染松手/点击/超时/移动模型在内 3 套 22 项通过。修正两处把“每次切页重建底栏”“过渡必然不卡”写成事实的旧注释。完整检查和新生产镜像实际拖动尚待做；本优化不等于已定位 OriginOS 整条向上进场根因。
- 依据现代 Web 指引 performance 的“Batch DOM reads, then batch DOM writes.”保持布局测量与写入分开；motion 的 transform/reduced-motion 规则沿用现有 CSS，未添加全局 will-change 或削弱动效。

- 第三批 C 浏览器闭环：2bc2ba2 独立生产镜像，最终 refresh-acceptance2 容器退出 0；真实 CDP 触摸在首页/片库/搜索/我的均触发资料请求，片库 503 后旧列表保留，真实测试视频同一 DOM/当前源/暂停状态/文档 timeOrigin 不变；390/820/1280 深浅四页 24 张截图，无横向溢出，pageerror 空。视频为官方 MDN flower.webm（SHA256 c6f8a348953395598a9a73b9bab1676436410797bce9f398f4be1531d6e76dda），仅放隔离容器；元数据夹具、模拟壳标记、Worker blocked，非真机/真实影片/Worker 证明。
- 首次脚本遇公告/版本/直链弹窗及 1440 变 390 后手势监听未重建，后续按手机 390 首次加载并实际关闭提示；另一次因未等请求计数更新误判，最终有界等待请求通过。大屏“我的”截图经 390 底栏实际切入再调目标宽度；不称验过不存在的桌面入口。响应式改变后的手势监听边界仍待修正。
- 第四批 B：ec107d4 的 Checks 41222648794 与 Android 41222650377 全绿。API34 实际打开设置，拒绝后无 queued，同意返回后原请求 queued，故意不存在的 HTTPS APK 随后进入下载失败。实看 12-update-resumed 原生下载提示截图，未安装；release 跳过。媒体通知/PiP 仍未完成。
- 导航小批完整 typecheck/lint/Jest174 套 1126 项均 0。格式预处理原生崩溃后完整检查仅报两份新文档排版；修正文档后只补跑格式。一次写记录命令在 PowerShell CLR 启动时原生崩溃，确认未写入后重试，根因未知，非应用断言失败。
- 导航小批最终格式检查退出 0（nav-format-check-final.log），此前 typecheck/lint/Jest 均 0；生产浏览器拖动尚待新镜像，不把 2bc 旧镜像截图作为新导航改动验收。

- 第三批 C 验收更正：实看 refresh-片库-390-light.png 发现仍是深色，acceptance2 仅改主题标记被 next-themes 状态覆盖，不能把此前 24 图算作已通过深浅验收；四页真实刷新/失败保留/媒体单例结果仍有效。acceptance3 改为实际点击“我的”深/浅按钮，每次路由后再断言真实根主题，正在重跑，不提前标绿。
- 第四批 B 媒体生命周期补丁实施中：原桥 lastPlaying=false 且只等事件，漏掉挂载前已经播放、空页首报和播放元素直接移除。补首次实际快照与仅针对媒体子树增删的观察，不改播放器、房间逻辑或桥签名；多媒体中暂停一项不误停另一项。4 项回归先红后绿，连原主题通知共 2 套 9 项通过；原生系统媒体/PiP 尚未完成。

- 媒体状态首报小批：typecheck/lint 均 0，完整 Jest175 套 1130 项 0；标准完整格式检查原生 2147483651，备用 Node 完整格式亦原生 3221225477，均无格式文件诊断，根因未知。4 个本批文件已逐一同版本 Prettier 处理成功，完整门禁交 Linux Checks，不能把本机全量格式标绿。新系统 MediaSession/PiP 仍待实现。
- Ruling：先将已通过完整门禁的网页诊断/导航批部署取证，再继续原生壳剩余能力，避免把用户手机因果判断一直拖到 Windows 工作结束。沿用已批准 VPS 部署范围；仍先做不可变镜像、真实数据副本、旧 static 保留、备份和回退验证，不跳发布门禁。代价是本次优化分批上线，不能称所有批次完成。

- 导航真实拖动补充：9d7ee96 的按住拖动本身成功切到搜索、同一底栏/文档/位置保持不变并完成深色三宽截图，但随后首个“我的”点击超时，整支不算通过。源码旧 suppressClick 只等兼容 click 清理，某些捕获拖动没有该 click，标记会泄漏到下一次独立点按；不是 VPS 掉帧证明。新增鼠标/触摸/键盘三项先红，修正新 pointerdown 清旧标记、detail=0 激活正常放行；保留拖后即时兼容 click 拦截，3 套 26 项绿。新镜像待重建/实际复验，正式服务未切。
- 第三批 C 深浅验收最终补证：acceptance4 用真实 radiogroup/radio 切外观并逐页断言根主题，实际 CDP 四页刷新、失败保留、同媒体单例、三宽深浅 24 图全部通过，实看 390 浅色片库确为浅色。acceptance3 误用 button 角色未找到 radio，未计通过；最终制品已重新下载中。
- 新 9d 镜像双架构 41223370973 成功，digest59eed567…，ARM64 标签 revision 精确匹配，latest/v0.1.1 仍 ba65d689…。保留旧 457 项 static，新 35 项/相同 422 项合并无冲突，逐一旧文件 hash 仍匹配。Nginx 候选及独立 127.0.0.1:3013 真实文件/MIME/immutable/缺失 404 不缓存测试通过，临时 nginx 已退出，主 nginx 配置没动。
- 最新在线 DB 备份为 backups/client-experience-20261031T172741Z，integrity=ok、目录 700/关键文件 600；保留 Compose/env/auth-secret/nginx 和旧镜像引用。首次非 sudo 创建/私有目录通配 chmod 被权限拒绝，确认已复制后逐个文件完成权限；未改正式数据。真实库副本与新镜像回退演练仍待运行，不能把备份等同已发布。
- 导航后续点按小批最终验证：首次 typecheck 仅原生 3221225477、无 TS 诊断，确认本项目本机预览端口未监听后串行重跑退出 0；lint0、完整 Jest175 套 1134 项 0、完整 format0。原始与重跑日志独立保留；新真实浏览器/镜像仍待验证。9d 受控 Worker 实际通过 active/controller=/sw.js、456 项仅 static、私有 API 离线不可读、SPA/重连不 reload，尚未计作新点按修正验收。
- 回退演练通过：9d 新镜像在 internal 网络的最新真实数据库副本上健康、登录、我的/搜索/片库/播放记录/收藏/我的房间均 200；只对隔离测试账号新增一条记录。随后旧 132ca5f 镜像读取同一副本，记录仍存在、鉴权页面正常、integrity 仍 ok；两测试容器均停止，无正式写入。
- 第五批 Windows 开始：按官方 WebView2 ProcessFailed/BrowserProcessExited 分类；GPU/子框架可自行恢复不替换整应用，主 renderer 才弹原生恢复，browser 退出要求重启。先增加纯 Rust 门禁用例和 Windows 工作流前置测试；本机按批准范围不装 Rust，首次红测放到 GitHub 非发布验证引用，失败会阻止 EXE 构建/发布，不将占位测试视为实现完成。实际旧 Windows 成功构建 40989619519 使用 tauri2.12.5，后续平台绑定以该版本为准。

- Windows 红测 41225926301 按预期因缺 RecoveryGate/Failure 失败（runner rustc1.99.1 已运行），两架构构建/安装/发布均被前置门禁跳过。现补纯 Rust 去重/升级状态，并接 Win32 宿主 TaskDialog、恢复系统标题栏、WebView2 主 HTTP/网络/renderer/browser 事件；GPU/子框架保留引擎自行恢复，证书不放行。对 COM 回调先返回再投递原生弹窗，单个 watchdog 监视 40 秒连接，不逐导航创建等待线程。
- Ruling：直接绑定现有成功构建的 tauri2.12.5 与 webview2-com0.39.1/windows0.62；只增加用户已批准的 Windows 平台绑定。Tauri 默认 manifest 已有 Common Controls v6。故障仅 renderer 时原生 Reload，browser 退出时走宿主 request_restart，服务器设置用一次性进程环境标志回到现有本地地址页，不新建持久存储键。关闭/退出是显式用户动作。
- Windows 当前仅候选，未编译/未实测，初始化失败兜底、合法下载/外链分流和完整原生故障冒烟仍待做；不声称 STATUS_ACCESS_VIOLATION 根因已修复。CI 临时输出 rustfmt 候选和 Cargo.lock 供审阅，取回后须将格式步骤改成 check、固定真实依赖锁，不能留下自动格式冒充源码格式已过。

- 网页第一增量已上线：c28ab11 双架构镜像、实际拖动后的下一次点按、同底栏/文档位置、三宽深浅、受控 Worker 均通过后，真实库副本再次验证新旧版本共享数据且 integrity=ok。正式服务固定 digest d91848e7…，health/OCI/编译 revision 均为 c28ab11；旧 132ca5f 与新两代 static 按 hash 保留，Nginx 仅静态资源 immutable。完整备份 backups/client-experience-20261031T180620Z，回退保留新 static、不覆盖后续用户数据库。正式服务已切换，不再沿用此前“尚未部署”状态；未发布新 APK/EXE。
- 用户选择稍后进行 OriginOS 真机诊断；不反复催测，继续独立原生工作。网页导航工作量与吞点按问题已修，但整条底栏卡着上移的手机根因仍未证明，不标为已解决。
- Windows 92f2aac 的 41226704056 通过纯 Rust 4 项、x64/ARM64 构建、安装及便携启动，release 跳过。取回两架构完全一致的 Cargo.lock（SHA256 217188da882f4c2942be85dd20953e4bc5843ed27743d4068e508755115a4fd3）纳入源码并启用 --locked；取回实际 rustfmt 输出，新增无 WebView 的启动失败原生兜底。该新增兜底尚未编译/实测，不把旧候选绿灯算作新补丁验收。
- 第五批实际故障门禁实施：CI 专用 loopback HTTP 503→ 重试、CDP 实际 Page.crash→ 同宿主 PID 恢复、连接失败 → 原生按钮打开本地设置；以 Windows UIAutomation 操作真实宿主按钮、保存截图，不能用页面 JS 弹窗代替原生恢复验证。新门禁加入 release 的 needs，尚待 Windows runner 结果。无本地 Rust 安装、无应用依赖新增、无正式数据写入；浏览器主进程退出、启动失败真实冒烟、合法下载与外链分流仍待完成。

- Windows 新故障门禁候选 a847ad9：本机 typecheck/lint/完整 Jest175 套 1134 项/完整 format 均退出 0；Node 脚本语法及 PowerShell AST 通过。CI 41272382962 在 Rust 解析阶段抓到新启动兜底的非 Windows return 语句误用逗号，已改分号（d6ea701），不归类环境崩溃；41272436931 纯 Rust 门禁已绿、两架构编译进行中，未声称实际恢复通过。
- 已取回 d6ea701 的实际 rustfmt 输出并确认与源码无差异，后续工作流改为 rustfmt --check，移除临时自动改源码/输出格式候选步骤。增加测试脚本中的浏览器主进程精准终止与重启到设置、独立缺失 runtime 环境覆盖启动兜底场景；仅作用于隔离 runner 自己启动的进程，不卸载系统组件。扩展脚本和新 check 门禁还未在 runner 执行。
- c28ab11 的导航六图、实际拖动图及 Worker 结果已完整取回 output/client-experience/vps-c28ab11，实看 390 浅色与 1280 深色；同一节点/timeOrigin/top、haptics8、pageerror 空。当前公开 /health 再核对 status=ok、buildSha=c28ab11；不将受控浏览器等同 OriginOS 帧呈现。

- Windows d6ea701 的 41272436931 双架构编译、安装/便携启动全部成功；实际恢复门禁在第一次“client DevTools reachable”35 秒超时，截图为正常本地地址页，因此尚未触发 HTTP/renderer 故障，不能归因为恢复失败。微软官方 WebView2Feedback#5645 说明 150+高权限宿主忽略环境变量/HKCU 调试覆盖；CI 改用仅本测试 EXE 的 HKLM 策略，限定 GITHUB_ACTIONS 环境，拒绝覆盖已有值并 finally 删除自建值，记录实际 runtime 版本/权限。生产客户端无调试参数改动，不降级运行时，不移除失败门禁。新脚本待再跑。

- Windows 实际恢复结果：41273004104 运行在高权限/WebView2 155.0.4283.62，HKLM 仅测试 EXE 配置成功打开 CDP；HTTP503 原生界面/重试、实际 Page.crash 后同宿主 PID 恢复、网络故障进设置、只终止本应用 browser 后的原生提示和重启至设置均通过，截图/UIA 已取回 windows-recovery-d2feacf。整支仍失败：缺 runtime 时 Tauri 运行层先弹英文 Error，build()尚未返回，旧 startup_failure 无法抢先处理。
- 已核对精确 tauri2.12.5 运行层源码：创建 WebView 前按 wry::webview_version 缓存状态并同步弹英文错误；补 main 创建 Tauri 前使用其公开同一 webview_version 检查，原生 Retry 重新检查、Cancel 直接返回，不补丁上游/不添依赖。保留 build 错误兜底；缺 runtime 真实重试/取消待新 runner 验证。实际截图还抓到详情默认折叠时按钮误写“收起详情”，按微软 TASKDIALOGCONFIG 语义交换两状态文案，并加实际展开/收起断言，待复验。
- Windows 启动前检查小批：本机 typecheck/lint/完整 Jest175 套 1134 项/完整 format 均退出 0（windows-startup-checks.json）；Node 语法与 PowerShell AST 通过。新增 CDP 监听端口属主检查，避免重启后旧 WebView 短暂存活造成假验收；不触碰受保护播放器、房间、API 与数据代码。新的缺 runtime 重试/取消、详情展开折叠仍待 GitHub 实际验证，不把 d2feacf 已过的其他场景扩大为整批通过。

- 第五批 A 实际闭环：36daf80/41273596558 全绿，纯 Rust4 项、x64/ARM64 锁定构建、安装/便携启动、真实 HTTP503 重试、Page.crash 后同宿主 PID 恢复、网络失败进设置、browser 精准终止后重启设置、缺 runtime 原生 Retry 修复续启及 Cancel 退出均通过。截图/UIA 已取回 windows-recovery-36daf80，实看 09 中文原生提示及 01 展开 HTTP503，按钮状态正确；系统按钮文字随 runner 英文 OS，不把它称为网页英文错误。release 跳过，未发布 EXE；TLS/超时、下载/外链与实际用户系统仍有验证边界。
- 第五批 B 开始：新增 loopback 纯文本 attachment，通过真实 WebView 导航触发下载，CDP 只固定测试文件目的地，核对字节、无整应用原生报错、当前 document/timeOrigin 不变。此测试不证明原生另存为 UI，未修改下载生产行为，也不提前把 ConnectionAborted 分类认定为现有 bug。精确 wry0.57.1 源码确认无新窗口处理器时会拒绝新窗口；外链处理仍待实施。
- 附件验证小批静态门禁：lint0、完整 Jest175 套 1134 项 0；typecheck 初次 V8 原生 2147483651、format 初次原生退出均保留日志，确认无本项目本机预览后串行重跑两者均 0（windows-attachment-retry.json）。未修改源码类型/tsconfig/依赖规避检查。Node 语法、PowerShell AST、独立 HTTP 夹具的 attachment 响应/文件名/字节均通过；真实 WebView 下载及误报检查待 CI，不称已验证下载 UI。

- 附件实测 e48e1c9/41274082871 失败：正常 loopback attachment 导航后未收到目标文件，实际截图/UIA 出现整应用“暂时无法连接内容”原生恢复。尚未取得展开后的 WebError 码与下载事件，不能先认定缺文件完全是恢复逻辑导致；补有界 CDP 事件、保持调试会话 2 秒、故障时展开详情，下一步核对事件顺序再改生产分类。
- Ruling（测试效率，不改发布资格）：工作流新增 publish=false 专用 audit_package_run 入口，只接受本仓库同一 desktop 工作流已整体成功的 run；核对原生目录、本地 UI、package.json 及图标源 Git 对象一致，保留包 SHA/测试 SHA 证明，原生输入变化必须完整重建。该入口明确禁止发布、不生成新包、不替代最终完整双架构/安装/便携/故障发布门禁。ID 非法、错误仓库/工作流、失败构建、原生/UI/package/图标不一致的 8 个拒绝与相同输入仅非发布通过均已本地验证，实际 GitHub 入口尚待运行；不把 CI 脚本测试等同客户端功能通过。
- 故障复验入口小批：typecheck/lint/完整 Jest175 套 1134 项/完整 format 均 0（windows-package-audit-checks.json），PowerShell 拒绝/通过用例与 AST、Node 语法通过。只读抽取近 7 天最多 200 条 Application 崩溃事件中另见 2 条 pwsh/coreclr 的 c0000005，记录仅进 output；它证明开发主机还有其他原生异常，不能据此认定 TongMu、VPS 或硬件根因。当前先用同源码 36daf80 成功包核对附件事件与错误码，不发布。

- 附件因果补证：43f41dd/41274590158 以 36daf80 成功包通过真实 Git 对象核对后复验，发布/重建门禁按设计跳过；测试仍失败。CDP 明示 isDownload=true、ERR_ABORTED，下载进度已收 30/30 字节；原生展开详情为连接错误 9。代码将所有非取消连接错误立即弹整应用恢复，发生在下载回调处理前；保留原证据，不把收到数据等同文件已保存。
- 修复候选：新增当前导航/URI 的有界内存关联（只一条、不落盘、忽略 fragment 且 8192 字符上限），匹配原生 DownloadStarting 才认定附件；ConnectionAborted 经现有单 watchdog 等待至少 1 秒再判定，普通中断仍报错，不创建逐次等待线程，不全局吞 9。新导航/重定向清旧归属，不支持 Core4 的旧 runtime 不导致整个恢复绑定失败。8 个纯 Rust 用例覆盖双回调顺序、真中断、无关下载、同 URL 新导航、旧失败、重定向、未知 ID/过长 URI；实际新编译与附件保存/页面保留待门禁，未标通过。
- 下载误报修复候选本机四项检查均 0：typecheck/lint/完整 Jest175 套 1134 项/完整 format（windows-download-fix-checks.json）。本机未装 Rust，共 8 项 Rust 门禁（本批新增 4 项下载关联测试）及 COM 绑定编译、真实附件保存/页面不重载须由完整 Windows CI 证明。原生源已变化，禁止用先前 36 包的复验入口冒充新编译；本次走完整双架构非发布流程。

- f5812c5/41275153565 的 Rust8 项、来源保护用例、双架构编译、安装/便携启动均通过；受控 CDP 下载已出现 completed/30 字节，但仍报连接错误 9，整支失败。不能将纯状态测试或编译绿灯当成下载修好。下一步去掉目录覆盖的 CDP 命令，改为实际鼠标点附件链接、操作本应用进程家族的 Windows 另存为（或核对默认下载文件）；确认测试手段是否改变原生事件流程，未证实前不进一步放宽生产错误分类。
- 复验资格 Ruling 更新：允许调查“原生门禁和双架构构建均成功、但运行冒烟失败”的同源码包，明确记录原 run 结论 failure、三项成功构建 job、源码对象与 releaseEligible=false。原先要求整支 success 无法调查正在失败的运行包。失败编译/原生门禁、错误仓库/工作流、不同源码仍拒绝；正式发布门禁不变。新增拒绝失败 policy、允许仅运行冒烟失败的非发布调查用例已本地通过；新实际入口待验证。
- Windows 原生保存流程测试小批：本机 typecheck/lint/完整 Jest175 套 1134 项/完整 format 均 0（windows-native-save-checks.json），Node 语法、PowerShell AST 及来源保护正反用例通过。原生生产源码仍为 f5812c5，不因受控 CDP 失败而扩大吞错条件；下一步用同源码、三项构建 job 成功的 41275153565 包实测默认保存 UI，复验不发布。

- 默认保存实际闭环：6ee457a/41275953624 使用 f5812c5 包，以真实鼠标点附件且不覆盖下载行为，在 WebView2 156.0.4314.50 中保存 30 字节文本，SHA256=4B312379DFC5464C7FD401C007681FFD68BEBA59DD04AF7A82EA57DB3B762ADE，document/timeOrigin 保留、无原生错误；HTTP/renderer/browser/缺 runtime 全回归通过。文件走默认目录自动保存，未出现另存为窗口，不能把已准备的 UIA 另存为分支算作实测。该次仅复验、releaseEligible=false，不替代正式构建。
- 随后完整重建 41276238839（6ee457a）全绿：Rust8 项及来源保护用例、x64/ARM64 安装包与便携包、x64 安装/便携启动、同一默认保存及全部现有恢复流程通过，release 跳过。日志 windows-6ee457a-full-native.log，原生包源码与复验核对一致；未发布 EXE。该次也是 156.0.4314.50，旧受控失败是 155.0.4283.62，运行时与交互方式均不同，不能断言 CDP 目录覆盖就是唯一原因，也不能把 155 默认流程写成已验。
- 下一步按原计划补 TLS 拒绝、40 秒等待/普通断连控制与持久服务器/登录资料验证，再完成外链/窗口动作及 Android 媒体/PiP、共享导航/刷新扫尾。另存为 UI、ARM64 实际运行、用户 Windows 与 OriginOS 真机都保留为明确验证边界，任务尚未完成。

- Windows 恢复补证小批开始：仅扩展 CI 夹具与断言，不改原生/网页生产源码。新增不受信 TLS 端点（现有 CI Git/OpenSSL 临时生成证书，不装入信任库、不上传密钥）、真实中途断连、永不响应端点。证书失败须为证书类错误且服务端未收到 HTTP；断连仍须显示原生故障；40 秒 watchdog 须在至少 39 秒后给出专属文案并能回设置。TLS 临时文件仅逐个删除、无递归清理；单次故障等待上限 55 秒，工作流总上限 8 分钟。Node 语法、PS AST、断连/挂起/计数独立 HTTP 验证通过，实际 Windows 补证待运行。

- Windows 恢复补证 41277732257（af9419d，仅复验 6ee457a 同原生源码包）全绿，WebView2 156.0.4314.50：证书类错误 5 且 TLS 端点 HTTP 计数 0、真实中途断连仍报故障、发起挂起导航后约 41 秒出现“连接时间较长”并可回设置；下载、HTTP 重试、renderer 同 PID 恢复、browser 重启、缺 runtime 重试/取消全部回归通过。证据 windows-af9419d-network.log 及 windows-network-af9419d 截图/UIA/result，实看 TLS 与超时界面，制品无 pem/key/pfx。
- 当前生产源码未改，保护既有鉴权/证书验证与下载行为；本机四项检查均 0（windows-network-faults-checks.json），测试 fixture 语法/AST 及 HTTP 独立验证通过。该次不生成新包、不发布，不代替最终全量门禁。下一步补真实配置/持久 cookie 跨进程恢复，再推进外链/窗口与 Android 媒体/PiP 及共享导航/刷新；真机底栏仍待用户诊断，不能将本轮 Windows 证据扩展为手机根因已修复。

- Windows 持久资料小批开始（只改 CI）：通过现有地址表单真实点连接保存服务器，不直接写应用存储键；测试端点只在/seed 设置一次带 Max-Age 的 HttpOnly 哨兵 Cookie，普通页面不补发。先正常关闭客户端及 browser、重新打开确认自动连接与 Cookie 持久化，再检查 renderer 恢复、browser 进程重启后的地址预填/Cookie，以及缺 runtime 重试返回已配置服务器。仅证明已保存的持久 Cookie 与地址，不等同真实账号验证、过期 token 或未保存草稿无损恢复。
- Node 语法、PS AST、独立 HTTP 的无 Cookie 拒绝/有 Cookie 识别/HttpOnly 及持久属性/普通页面不重设均通过；新实际 Windows 流程待复验。原生生产源码仍 f5812c5，与 6ee457a 成功包相同，不触碰生产登录接口、账户或浏览器用户资料。
- 持久资料小批静态门禁：lint0、完整 Jest175 套 1134 项 0、完整 format0；typecheck 初次仅原生 3221225477 无 TS 诊断，原日志保留，确认本项目无预览后串行重跑 0（windows-profile-retry.json）。Node 语法/PS AST/独立 cookie 夹具通过，真实配置预填、正常重开、崩溃恢复后的持久性仍待 Windows 复验，不把哨兵 Cookie 扩大为真实账号验证。

- 持久资料 41278440780（f049cac，复验 6ee457a 包）全绿，WebView2 156.0.4314.50：实际地址表单连接、窗口关闭后 browser 退出、重新打开自动连接、一次 HTTP 设置的持久 HttpOnly Cookie 在正常重开/renderer 恢复/browser 进程重启/缺 runtime 重试后均存在，重启设置页预填地址正确。下载/TLS/断连/40 秒超时等全回归通过；不使用真实账号，不将哨兵 Cookie 验证等同 token 永不过期。
- 视觉证据更正：实看 08-browser-restarted-settings.png 为宿主终端遮挡，不能把 DOM/地址值通过当成该截图已验。仅调整 CI Capture：截图前用 UIA 激活本应用 PID 的可见可用窗口，明示这是测试交互、不证明自动前台策略；PS AST 通过，重新进行实际截图/回归。原生/网页源码、证书与登录策略未改；本批既有四项检查结果保留，截图辅助改动用实际重跑补证。

- 持久资料视觉补证 41278859582（8c4d4d3）全绿：UIA 实际激活本应用窗口后 08 设置图可见，实看确认http://127.0.0.1:8085预填；正常重开/renderer/browser/启动恢复后的持久HttpOnly Cookie 及全部现有下载/网络/超时故障回归仍通过。截图激活是测试动作，未将其当作自动前台行为已验。
- Windows 外链小批先做行为门禁：真实点 target=\_blank 链接，目标页面主动报告是否仍处于 WebView2/桌面桥，要求独立系统浏览器且当前 document/timeOrigin 不变；不仅检查请求计数，防止把内嵌弹窗算成外部浏览器。现有精确 wry0.57.1 源码的默认新窗口分支会拒绝请求，实际结果待复验后再实现宿主转交。Node 语法/PS AST、独立 HTTP 的目标探针、非法报告拒绝与计数通过；尚未新增外链原生能力。

- Windows 外链红测 41279303786（bf26460）在 WebView2 155.0.4283.62 失败：实际点 target=\_blank 后 35 秒未收到目标页报告；正常连接、持久 Cookie 与重开已通过。精确 wry 默认分支拒绝新窗口，补 Windows 宿主转交候选：只接受原生 IsUserInitiated 为真、长度有界/无控制字符/无账号密码的 HTTP(S) URL，经现有 tauri::Url 解析后调用 Windows ShellExecuteW；不拼 shell 命令、不新开未受管 WebView、不新增 IPC 权限。先退出 COM 回调再投递宿主 UI 线程，失败原生提示不销毁当前页。
- 仅增加已授权 Windows 平台绑定的 Win32_UI_Shell 特性，不新增应用库；原生源已改，须完整双架构重建而非复用旧包。追加自动 window.open 拒绝控制，真实目标还须报告非 WebView2 且无桌面桥、主文档不变。未知协议/磁力/Blob 等仍未接入本批，跨端文案及能力降级按后续批次，不将 HTTP(S)转交扩为全部动作完成。
- 外链修复候选本机门禁：lint0、完整 Jest175 套 1134 项 0；typecheck 初次 V8 原生 2147483651 无 TS 诊断，确认无本项目预览后串行重跑 0；完整 format 两次原生 3221225477 均无文件诊断，五个改动的可格式化文件逐一/定向检查 0，完整格式交自动 Linux Checks 补证（windows-external-fix-\*.log 及 retry.json）。NativeSDK/新 Windows Shell 绑定未在本机编译，不提前标原生通过；本次走完整双架构非发布构建，后续共享标签与协议降级仍未完成。

- Windows HTTP(S) 外链闭环：cbee5dd 的完整非发布流程 41280022405 全绿，x64/ARM64 构建、x64 安装/便携启动、真实点击目标报告非 WebView2 且无桌面桥、原 document/timeOrigin 不变、自动弹窗零请求均通过；现有 Cookie/下载/TLS/断连/40 秒超时/renderer/browser/缺 runtime 回归通过。Checks 41280021242 全绿，补足本机原生崩溃未完成的完整格式检查。日志与制品 windows-cbee5dd-external.log、windows-external-cbee5dd 已取回，实看外链返回图为原客户端页；未发布 EXE，不将 HTTP(S) 转交扩大为磁力/Blob/全部动作已验。
- Android 媒体前置小批：发现既有 MediaSessionBridge 与原生通知暂停直接操作 DOM，可能绕开房间跟随者的页面控制锁。先在不改保护文件的前提下，将桥移入现有播放 Provider 内，读取既有控制器/房间权限；系统动作共用控制器，补挂载已播/媒体移除/多媒体选择、元数据不随浏览页面标题改变、失败 Promise 消化、能力独立降级。新 \_\_tmShellMediaAction 仅增量网页回调，原生通知尚未接入，不宣称全部系统按钮已修好。
- 本批新 6 项生命周期/权限测试在旧代码实际失败后通过，补暂停后元数据变更及单动作不支持两项，共 2 套 10 项通过。首次标准与备用 Node 测试均原生崩溃、无 Jest 断言；保留日志后直接运行同版本 Jest 成功得到真实红测。当前 typecheck/lint 0，全量测试及格式、生产浏览器/Android 媒体会话/PiP 仍待验证；不把模拟 DOM 当真机锁屏证明。
- Ruling：先复用 WebView 已有的 Web MediaSession，并用模拟器 dumpsys/实际系统按钮确认其可用性，再判断是否需要原生会话；避免未经证实新增后形成两套通知/控制器。保护播放器与房间 hook 的内部逻辑不变，网页和 Windows 继续使用既有 Web 媒体能力。
- 媒体前置本机门禁：typecheck/lint 退出 0，完整 Jest176 套 1142 项与房间 27 项通过。完整 format:check 原生 3221225477、无文件格式诊断，日志保留；定向格式与 Linux 全量门禁补证。Android CI 新增本地 PCM 音频及实际通知按钮权限夹具：要求第一次拒绝保持播放、第二次允许才暂停，另取 dumpsys media_session。原生暂停实现尚未改，此为待运行红测，不把夹具内权限标志当真实房间权限证明。
- a6d9b7b 的 Checks41281046590 全绿（含全量格式/构建/房间等）；Android41281047653 的 APK/API23/24 通过，API34 新通知权限红测如预期失败。实看截图与事件：点击真实中文“暂停”后音频 paused=true、calls=0，证明旧宿主直接暂停 DOM，没有转交网页回调。不是按钮未找到。修复候选改为先调用 \_\_tmShellMediaAction，只有旧网页完全缺少方法才用原兼容暂停，回调拒绝/异常都不绕开权限；主文档故障时不再向失效网页发命令。
- API34/Chrome113 此 HTTP 音频夹具的 dumpsys media_session 只列出本应用音频 UID，没有 TongMu 媒体会话；仅证明本次环境未自动形成会话，不能扩展为所有 WebView/HTTPS 都不支持。按原计划需继续补框架原生媒体会话与锁屏实测，不能因网页代码注册过 MediaSession 就宣称锁屏已完成。
- 下拉刷新响应式扫尾：原先只在 Effect 首次挂载判断手机宽度，1440 变 390 不会启用。两项新测试在旧代码断言失败后，改为监听 resize 和 coarse/宽度媒体查询，只有符合条件的 App 才安装触摸监听；变宽时清理正在下拉的指示器，普通网页/Windows/非触屏既有边界不变。最初常驻触摸监听方案被原有边界测试否决，已改为动态安装，原测试未削弱；2 套 11 项全绿。其完整门禁与真实响应式浏览器仍待新提交，不拿 a6 检查代替未提交改动。
- 通知转交与响应式刷新扫尾本机：typecheck/lint 0，完整 Jest176 套 1144 项 0；既有房间 27 项已在本批媒体桥变更后通过。完整格式正常运行但报两份新文档，其中 VERIFIED 已格式化；另一份未跟踪 CLIENT-EXPERIENCE-STATUS.md 检查为 5724 字节且全为 NUL，来源未确认，保留原文件、不提交、不以清空/删除消除报错。当前将有内容的新增报告另存 CLIENT-EXPERIENCE-VERIFIED.md，含当前/目标/后续路线图。提交内容的完整格式由 Linux 干净检出补证；本机全量格式不标通过。
- 本轮原生只修通知暂停转交，不将网页回调的模拟权限等同真实服务器授权；真实房间权限仍由已有网页控制器/服务端决定。API34 原生媒体会话与 PiP、共享返回/附属刷新/跨端文案等仍欠缺，全部目标不打勾，不发布新客户端。
- 8fef3d1 的 Linux Checks41292596752 全绿（typecheck/lint/format/Jest/房间/构建等），网页响应式与通知转交源码已固定。Android41292598035 第 1 次：APK/API24 通过；API34 在首次打开即无服务器请求、无 page-start 并 40 秒原生超时，未执行到通知；API23 在 TLS 等待约 28 秒被现有 UI 轮询提前判失败，尚无 SSL 回调。保留两端制品/日志；不将其直接归因于新通知代码，也不把它定性为纯环境。原样启动失败任务第 2 次（同 run、同 8fef3d1、publish=false），继续核查，禁止未看结果就再重跑。
- 真实网页后续验收镜像 41292892315 正在运行，QA 引用 codex/client-media-verification 固定 8fef3d1、标签 client-audit-8fef3d1；镜像工作流含独立完整门禁，尚未生成 digest。期间不推该引用，以免取消门禁；正式 c28ab11 和客户端 Release 均未改。
- 下一原生媒体批的接口预案：新增可选 setMediaState(JSON)报告 active/playing/canControl/title；新版宿主由单个框架 MediaSession 与 MediaStyle 通知拥有系统控制，网页检测到该能力则不另注册 Web MediaSession；旧壳仍保留现有 Web 能力。原生回调统一转交\_\_tmShellMediaAction，不直接 play/pause 绕权限；暂停可保留可恢复的系统控制，媒体移除/文档故障/宿主退出必须清会话。先写纯状态红测及实际系统媒体按钮/会话断言，再实现；不得把此预案当代码已经完成。Java 本机可用 C:/Program Files/Microsoft/jdk-21.0.9.10-hotspot/bin/javac.exe，按项目--release17 编译测试，无需安装。

- 8fef3d1 Android41292598035 第 2 次：API34 与 API24 通过，实际通知 blocked/allowed/paused 的 calls 依次 1/2/2，实看通知截图，确认通知转交修复有效；API23 再次在主 TLS 等待约 28 秒失败，停止原样重跑。新调查找到 TLS 测试服务器把 SSL 握手放在单线程 accept，未完成握手可堵住后续 TLS；独立真实 socket 测试在旧夹具发生握手超时，改为每连接线程握手及 5 秒期限后 0.6 秒通过。这证明夹具有该阻塞缺陷，可解释 API23 现象，但仍须新模拟器验证，不直接宣布用户网络/生产 TLS 根因。应用证书校验与信任设置未变。
- 本机首次独立 TLS 测试未进入握手阶段，子进程 trace 定位在 HTTPServer.server_bind 的 socket.getfqdn 反查；仅测试启动器固定无关的 loopback 服务名后才得到真实握手红测。保留 readiness trace、red-handshake、green 日志，不把准备失败冒充功能红测。新测试只信任自身临时证书，不写系统信任库、不留密钥；CI 已接入。
- 原生媒体会话候选：纯 Java MediaState 先缺类红测后通过，覆盖无媒体、暂停可恢复、无控制权、动作白名单和 Unicode 标题上限。Web 新增两个快照/所有权/权限变化/卸载用例先失败后通过，共 2 套 12 项绿。采用单个框架 MediaSession 与 MediaStyle、已有音频保活服务，新增可选 setMediaState，旧 setPlaying 保留；暂停不销毁会话也不继续冒充前台播放，系统回调仍走网页控制器。源码尚未完整 APK 编译/真实系统会话验证，不提前标绿。
- Android 夹具新增真实本地 PCM、cmd media_session 系统播放暂停、后台恢复、单应用会话/实际标题与播放状态、锁定 actions=0、移除清理的门禁；原通知按钮仍实际点击，兼容系统自带中英文播放暂停标签。夹具权限标志不是正式房间，正式权限另由网页控制器回归证明。尚未做真实锁屏/新 PiP 验收。
- 8fef3d1 网页候选镜像 41292892315 完整双架构成功，digest c4d3b3b215ca8c731e3433946ff7153f7e7c0fe8122eca654b426caeef3bcc4a；正式服务未切。正以 3015 端口/独立数据库与容器取证响应式刷新，不使用该旧镜像证明本批未提交的媒体快照。
- 系统媒体会话候选本机完整门禁：typecheck/lint 0、Jest176 套 1146 项 0、房间 27 项 0；Java --release17 状态测试与真实 TLS 并发测试 0，Python AST/冒烟 shell 语法/媒体会话解析正反夹具通过。完整格式正常运行，仅报先前保留的未跟踪全 NUL STATUS 文档，不是本批提交文件；其余文件检查通过，Linux 干净检出仍须完整门禁。当前尚未 Android 编译/系统按钮实测，不把纯 Java 或 Jest 当原生验收。
- ca4b0fa 的 Checks41294340821 完整通过；Android41294341819 的 APK/Java/TLS 并发夹具门禁、API24/API34 通过。API34 实际 MediaSession 唯一应用会话、影片标题、后台暂停后恢复、权限锁 actions=0 与无多余回调、媒体移除后无活跃会话均通过；实看 15-session-paused-notification.png 为系统媒体卡片、有片名和播放按钮。旧通知两次真实点击回归及 HTTP/TLS/显示进程/更新授权流程也通过。尚未实际锁屏或新 PiP，不将系统卡片当 OriginOS 真机结论。
- API23 仍停在主 TLS，没有到本批媒体流程；并发服务器修复后仍失败，证伪“夹具串行阻塞是充分解释”。停止原样重跑；现只加无 URL/描述的网络/SSL 回调 current、matches、hasUrl 与 page-start scheme 顺序日志，并将严格 TLS 断言观察延长到本地 40 秒 watchdog 以后，失败自动保存截图。证书取消及错误判定未放宽，结果仍待新候选。
- 8fef3d1 浏览器闭环：3015 独立生产候选+真实 CDP 触摸，从 1440 首次挂载变 390 可刷新、变宽取消未释放手势、再缩回可重新刷新；主动 503 保留列表，同 timeOrigin/同底栏 DOM，390/820/1280 深浅六图无溢出，pageerror 空。浏览器容器退出 0，全部图已取回并实看；测试资料/模拟 TMShell/Worker blocked，非真机。失败夹具下旧全局错误与局部刷新提示先后出现，记为后续 C11 反馈去重待处理，不能把截图称无错误提示。
- 当前隔离网页容器 tm-client-audit-8fef3d1 仍运行 3015，浏览器 tm-client-browser-resize-8fef3d1 已退出 0；证据 output/client-experience/vps-8fef3d1。正式 VPS 仍 c28ab11，未发布任何新客户端。
- 0f9623e 的 Android41294944738 APK/API23/24/34 全部通过，release 跳过；Checks41294943081 也通过。API23 主 HTTPS 开始后约 1ms 即 TLS rejected 且 matches=true，子图片 TLS matches=false，没有放宽证书规则；本次未再现等待，不能据此认定此前间歇延迟根因已解决。最新日志/制品 android-media-0f9623e-api23 保留。
- PiP 新候选：PipPolicy 能力/全屏/暂停/故障/重复进入及实际宽高系统边界纯 Java 红 → 绿；网页实际视频维度与 resize 更新回归红 → 绿，2 套 13 项绿。新增可选视频宽高字段，旧 v1 快照缺字段继续兼容；PiP 配置变化不触发既有竖屏退出全屏逻辑。尚未 Android 编译/实际 PiP，不提前标已完成。
- PiP 实际门禁已加入：仅 API34 下载官方 MDN CC0 flower.webm 并核对已验证 SHA256，不提交或打包此测试视频；真实点全屏按钮、系统 Home、检查应用 task 为 pinned、系统媒体暂停/恢复、同视频/同文档且时间继续、回前台仍全屏。比较考虑循环片段时间回绕；解析器正反用例/AST/shell 语法通过。临时片/证书按文件清理，未新增应用依赖。
- PiP 候选本机完整 typecheck/lint/Jest176 套 1147 项/房间 27 项均 0，Java 策略与网页维度回归通过。完整格式仅报保留的未跟踪全 NUL STATUS 文档；本批源码/文档已同版本格式化，干净检出完整格式门禁待提交后的 Linux Checks。Android 真实全屏解码/进入 pinned/同实例暂停恢复与返回仍未运行，不把 API34 上一批系统音频通过当成 PiP 通过。
- PiP 候选 6904a7e 已推 codex/client-pip-verification；Android41295832709 的 APK 已成功，API23/24/34 当前仍运行；Linux Checks41295830551 当前在 Build。须继续轮询同两个 run，不能因等待或日志不可用重新触发。尚未取得真实 PiP 结果，不发布。
- 8fef3d1 网页验收已结束，按不可变镜像身份核对后停止 tm-client-audit-8fef3d1；浏览器容器先前退出 0。VPS 当前仅正式 tongmutvplus 与原有 3xui 运行，正式 health=ok/buildSha=c28ab11；截图/日志/镜像保留，未切线上。清理证据 resize-audit-cleanup.log。
- 6904a7e 的 Android41295832709 APK/API23/24/34 与 Checks41295830551 全绿：真实 MDN 视频解码、task 进入 pinned、同视频同文档暂停恢复/时间继续、回前台仍全屏均通过。视觉复核纠正：16-pip-playing.png 仍是 640×320 全屏视频，dump 的 CurrentConfiguration 也仍为 fullscreen；只能证明已进入 pinned 任务状态，不能证明缩小后的视觉完成。新增 check_pip_window 实际窗口配置/面积断言，旧真实 dump 明确失败、160×90/320×640 夹具通过；测试等真正小于半屏后再截图。原生生产代码未因截图时机猜测而改动，需新实际闭环。
- 刷新扫尾：已复现并修正手动刷新双重全局/局部反馈，分类/推荐/自定义请求只由刷新拥有者提示；默认错误广播保留。新增信号传递至直接请求与代理 JSON 读取，取消后不再切备用源；首页与片库手动日历绕过既有客户端缓存与 HTTP 缓存，普通访问缓存键/TTL 及既有服务端策略保留。日历请求代次阻止迟到旧请求改写新缓存，未修改保护 API/会话/数据库代码。
- 4 套 24 项定向测试通过，11 项最初真实失败（其余旧规则先通过）；HTTP 缓存两项补充亦红 → 绿。本机完整 typecheck/lint/Jest178 套 1160 项 0。完整 format 初报保留的未跟踪 NUL 文档及新测试文件排版；新测试已修，最后完整格式仍待补证。房间逻辑未改，本批不新增房间测试。真实新网页单一 Toast/日历请求及 PiP 缩小视觉仍待 CI/生产候选验证，不提前声称用户真机已修好。
- 刷新扫尾最终完整格式复查只剩保留的未跟踪全 NUL STATUS 文档；本批新测试排版已修，其他提交文件无格式诊断。日志 catalogue-refresh-format-final.log。完整源码格式以接下来 Linux 干净检出门禁为准，本机全量不标通过。
- 刷新扫尾 909e427 的 Checks41297277379 完整通过，含源码格式、构建及全部既有门禁。Android41297279181 首次 API23/24 通过，API34 又在首次打开阶段无 page-start/无服务器请求而 40 秒超时，未到 PiP；保留 android-pip-window-909e427-api34 与日志，只原样重跑失败任务一次（同 run 第 2 次当前运行），不归因 VPS 或新窗口尺寸断言。若再次相同则补诊断，不继续盲重跑。
- 网页候选镜像 41297825887 已启动，固定 codex/client-refresh-completion=909e427/tag client-audit-909e427；不得移动该引用取消门禁，正式服务仍未切。新单一 Toast/强制日历/真实取消仍需此候选浏览器取证。
- Windows 第 5 批补运行证据（仅 CI）：在已验证的 cbee5dd 原生包上，真实点注入控件最大化/还原/最小化，用 User32 读取实际 OS 状态；最小化后由测试调用系统 ShowWindow 恢复，不冒充自动前台策略。真实 F11 须同时进入文档全屏和原生窗口覆盖显示器，再退出；所有动作保持同 document/timeOrigin。Node 语法/PS AST 通过，尚未实际 Windows 运行。本批不改原生生产源或新增依赖，后续用严格 Git 对象匹配的非发布 audit 入口，不以复验资格代替最终完整发布门禁。

- 909e427 最终补证：Checks41297277379 与镜像 41297825887 全绿，镜像固定 f6a1a24b9f5079397971ca481b1e031a9c7b7dcbc2350fa9f9dd2443fb0581bd。隔离候选真实 CDP 下拉：失败单一提示、旧列表保留、切页实际 ERR_ABORTED 且同文档、普通日历命中缓存而手动刷新重新请求并更新缓存，深浅均通过；390/820/1280 共 12 图已取回实看、无溢出、pageerror 空。夹具元数据/模拟 TMShell/Worker blocked，不等同真机或真实来源可用。tm-client-audit-909e427 已按镜像核对停止，正式 health=ok/c28ab11，仅正式与既有 3xui 运行。
- Android41297279181 第 2 次 API23/24/34 全绿；PiP 实际窗口 192×108、屏幕 320×640，截图已实看为桌面上缩小视频，同实例暂停/恢复/回全屏通过。第一次 API34 首次加载超时证据保留；未证明该间歇问题根因，未证明 OriginOS、关闭 PiP 或真实锁屏表现。新 APK 未发布。
- b1bfef8 Windows audit41298500045 与 Checks41298498565 全绿；严格匹配 cbee5dd/41280022405 包输入，真实最大化/还原/最小化及 F11 文档和系统全屏通过，保持原文档。恢复最小化由测试显式 ShowWindow，不是自动前台策略；ARM64 仅构建。未发布 EXE。接下来完成 Android 外链/下载与共享返回、跨端文案及能力降级，不将总体任务标完成。

- Android 外链实际红测 e13f389/41301570229：API34 真实点击 target=\_blank 后目标在 WebView 内上报 bridge=true，原页面被替换，截图和服务端事件均取回，确认不是 VPS。自动弹窗未交接。API24 通过原有流程；API23 再次主 TLS 等待未达预期，仍根因未明，不拿它当外链失败。新增外链宿主候选只接用户手势 HTTP(S)，临时无脚本/无桥容器捕获后交系统并清理，附带纯 Java 白名单与过期文档保护；尚未编译/实测修复，不标绿。
- 跨端外链第一小批：关于/版本/页头仓库入口保留原样式，网页原新标签页，声明能力的新客户端显示外部打开，旧壳复制绝对链接；复制失败保留可选地址。新增能力检查与版本面板动态焦点回归共 6 项，先红后绿；完整 179 套 1166 项、lint 均 0。typecheck 首次为 SSR 快照字符串推断源码错误，已显式收窄并重跑 0，不归类环境。完整格式首跑在未改历史文档解析异常；该文件单检 0，完整重跑只剩既有未跟踪全 NUL STATUS，保留它不提交，CI 干净检出仍需完整门禁。
- 外链冒烟解析器还复现对真实 dumpsys topResumedActivity= 分隔符识别错误，修正后 3 种格式与自身页面/错误目标拒绝用例通过；此为测试修正，不当原生功能已通过。新宿主 API34 实测、共享外链其余动作入口、窗口能力声明、浏览器三宽深浅及最终发布仍待续。

- Windows 外链能力声明增量：既有已实测的 HTTP(S)宿主处理现在由 TMDesktop.externalLinks 显式声明，配合共享入口识别新旧壳；VM 启动声明先红后绿，实际 CDP 启动断言加入。未改 Rust/协议/本地设置，但 inject.js 属于原生打包输入，因此不能复用旧包 audit 冒充通过，下一次必须完整双架构构建及实际窗口/外链回归，publish=false。
