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
