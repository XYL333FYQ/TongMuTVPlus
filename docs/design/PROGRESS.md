# 界面改造进度

## 2026-10-26 主题、文字边界与手机房间（本地验收完成）

- 用户先确认计划回复「开始」，源码类型错误回退后明确回复「继续」；追加截图要求所有页面顶栏不重叠。后台 page.tsx 仅放开本任务展示，不改权限、接口、数据库、房间协议和播放会话。用户验收报告后明确要求「提交推送」，授权本批 17 个文件提交到 main 并推送 origin；不手动部署。
- 主题：六组背景预设增加辨识度，后台同时展示深浅两张微型预览。真实页面检查七个主题 × 深浅共 14 组，分别有七种不同底色；72 组正文/次要文字与背景层级对比最小 4.88。
- 后台：长用户名、用户组和多个操作可换行，手机用户列表改为卡片；保留全选与单选，44px 标签边缘实点可切换。代理轨道 40×22、点按区 44×44。使用浏览器 GET 响应夹具，不写用户或真实配置；28 个面板入口共 166 个响应式状态无真实溢出候选、pageerror 0；用户/主题/源配置另测 320/390/820/1280 深浅共 24 状态。
- 顶栏根因：房间旧 CSS 改成两列，却让标题与账号区都在第二列；390px 原标题 x=313–351 与账号 x=282–382 相交。删除房间覆盖，由 shell.css 共用规则分配标题、返回及操作列。已覆盖登录态 768 个组合及访客 96 个组合，包括 320/360/390、长标题、首屏/紧凑态；无标题碰撞。两个书籍路由与独立观影屏的导航中断已单独补验，不将失败连接计通过。
- 手机视频：PlaybackSlot 与独立播放页只读取现有 video 的 metadata / resize / emptied，未知比例回退 16:9；手机按真实尺寸，桌面既有比例不变。LegacyPlaybackSurface 仅增加 tm-playback-video-frame 一处 className。空舞台取消后置 300px 最小高度，房间长标题可换行。
- 全站巡查：枚举 58 路由，57 个前台 × 390/820/1280 × 深浅共 342 条渲染记录，后台单独检查。源站折叠筛选框、屏幕阅读器列标题及明确省略/局部滚动不算错误。未配置外部模块或缺少资源 ID 的路径只验空态/权限态；一次巡查有 3 条水合恢复错误，保留日志，不宣称所有控制台零错误。
- 最终源码验证：pnpm typecheck / lint / test --runInBand / format:check / test:rooms 全部退出 0；114 套、647 项，房间 21/21；lint 有既有 warning。修改范围设计检查无新增违规，后台保留既有 TODO 3；git diff --check 通过。新增 3 项视频展示回归，覆盖比例变化、监听清理和请求不重复。output 没有 .ts/.tsx/.d.ts 备份。
- 过程记录：首个独立播放页清理函数返回 string 导致 TS2345，按规则回退并停下，用户恢复后以 void 清理重做。Node 原生崩溃与重试日志均保留；最终普通 pnpm 检查已通过，预览临时用附带 Node 的 --no-opt --regexp-interpret-all，未写入配置。
- 真实 Edge 从 1440×900 开始，三种可解码 MP4 的独立页与房间均有 390/820/1280 深浅截图；手机宽银幕/16:9/竖屏对应实际比例，房间占位和挂载框一致。播放页到房间、收起恢复均是同一 video。临时 QA 私密房间已按完整名称删除，没有删除既有房间；最后预览、独立浏览器和鉴权状态已清理。
- 边界：未验证真实多人同步、外部媒体可用性及线上部署；编码在视频内部的黑边不会裁掉。证据、文件清单及最终截图见 output/ui-mobile-theme/REPORT.md 和 output/playwright/ui-mobile-theme/。下一步由用户查看本地效果。

## 2026-10-26 恢复侧卡悬停前置（纠正上轮误解）

- 用户明确指出原有交互必须保留：默认中间在前、两侧同层；侧卡悬停或键盘聚焦时临时最高，交互结束后恢复。上一批把「默认」误读为「始终」并移除提层，是实现者造成的回归。
- 源码只在 `src/styles/home.css` 原位置还原 4 行 hover / focus-within 的 z-index: 5 规则，保持上一批默认 2 / 1、位置、尺寸、对称交叠、透视、动画及切片行为不变。DESIGN.md、原计划与内置 0.1.1 发布记录纠正错误表述，不变更版本或发布管理功能，不改已保存的站长自定义记录。
- 验证：pnpm typecheck / lint / test --runInBand / format:check 均退出 0；112 套 / 644 项通过，lint 仍有既有 warning；check-design 违规 0。没有房间改动，不重复 rooms。
- 真实 Edge，1440×900 及 390 / 820 / 1280 深浅主题；左右各覆盖默认、hover、移开、focus、blur，16 组交互全部通过。默认交叠点命中主卡、侧卡层级 1；hover / focus 后命中对应侧卡、层级 5；移开并失焦后恢复主卡在前，未横向溢出，pageerror 0，保存 18 张截图并目视对比。首次预览进程原生崩溃后重试启动成功，未因此改配置，根因未定位。
- 预览和本次独立测试浏览器已关闭。本次沿用原任务提交推送授权，仅提交此回归及对应文档、内置记录纠正，不做部署；线上未验收。证据在 `output/card-hover-correction/` 与 `output/playwright/card-hover-correction/`。

## 2026-10-25 展示卡片与 v0.1.1 发布管理（已完成本地验收）

- 用户授权开始、增加后台发布入口、提交并推送。本批将主海报固定为层级 2，左右固定为 1；移除 hover / focus 提层，左右对称少量交叠，原透视、倾斜和切片行为保留。对应 DESIGN.md「展示卡片层级与发布信息」、§3 / §4。
- 默认版本、VERSION.txt、package.json 与品牌配置统一为 0.1.1。PROJECT_CHANGELOG 根据 0.1.0 之后提交整理安装入口、反馈申请、普通控件、手机布局、主题、通知、房间与播放器修复；不加入后台配置、站长权限和本次发布编辑器。原 0.1.0 历史原样保留，生成模块同步更新。
- 原项目没有后台发布编辑能力，新增站长专属「版本与发布记录」独立栏目，桌面导航 / 手机手风琴均可进入。填写版本、日期与三类记录，每行一条；第一条为当前展示版本，新增保留历史，可明确移除、保存。前后端校验版本、真实日期、重复版本、空记录及长度，按纯文本渲染，失败保留草稿。
- 复用现有数据库通用 KV，新键 `tongmu:release-info:v1`，不改现有键、数据库路径、依赖、播放器或房间协议。只读审阅发现 AdminConfig 整体保存及两个编辑器可能覆盖新记录，改为独立保存；ETag / If-Match 和当前 Node 内串行队列拒绝过期草稿，409 时提供明确重新加载入口。读取通过现有公开 server-config 仅投影合法发布字段，版本弹窗、账号菜单、关于、登录 / 注册共用读取逻辑，离线保留最后有效值或内置记录。新管理 API 受现有认证中间件及站长校验约束。
- 验证：最终 typecheck 退出 0；lint 退出 0，仍有既有警告；完整 Jest 串行重跑 112 套 / 644 项通过、退出 0。早先一次 644 项已全部通过但 Node 退出时原生崩溃 2147483651，该次不计命令成功。普通 pnpm format:check 多次原生崩溃 3221225477，保留日志；等效全仓 `node --regexp-interpret-all node_modules/prettier/bin-prettier.js -c .` 退出 0，未排除文件或改配置，不声称普通运行方式已恢复。未涉及房间行为，不重复 rooms。output 未发现 .ts / .tsx / .d.ts 备份。
- 真实 Edge：1440×900 与 390 / 820 / 1280 深浅主题，主卡层级 2、两侧 1；左右分别 hover + focus 后实测交叠处 elementFromPoint 均命中主卡，无横向溢出。真实海报备用地址成功加载，原豆瓣地址有 418 网络错误，不声称控制台完全无错误；验收过程 pageerror 为 0。
- 后台编辑器 / 版本弹窗完成 390 / 820 / 1280 × 深浅共 12 张截图。真实保存临时 0.1.2、刷新回读、保留历史、关于 / 菜单 / 弹窗同步、旧窗口 409 保留草稿通过；finally 已恢复 0.1.1 并通过公开接口回读确认。另以无 Cookie 浏览器确认登录页 / 公开接口 0.1.1、未登录发布 401，pageerror 为 0。临时浏览器、预览进程及鉴权状态文件已清理。
- 边界：这里维护的是展示版本与发布记录，不会自动更新程序。进程内队列覆盖当前单 Node 服务；多服务实例同时发布的数据库原子冲突保护未实现 / 未验证。第三方媒体可用性、线上部署、真实播放和同步不属于本批验收。用户已授权本次及前四次本地提交推送，未手动部署；下一步由线上维护者更新程序后在后台维护发布内容。
- 证据：`output/release-management/` 的日志与报告、`output/playwright/release-management/` 的真实浏览器流程和截图。

## 2026-10-25 后台加载样式预览与移除评分设置

- 用户确认加载预览，并明确要求「不再出现角标设置」。本批只在后台 page.tsx 移除评分星标设置整块 UI，接入独立 LoadingStylePreview.tsx 与 settings-preview.css；不修改前台角标、接口、存储键和播放会话。
- 加载预览复用真实 LoadingStyle，预览框内局部选择款式，演示步骤走一轮后静止，支持重新播放与减少动态。保留原保存流程，演示不请求影片。旧版选项的 emoji 换为 lucide Tv。
- 已核对真实链路：layout.tsx 读取 ThemeConfig.loadingStyle 写入 html data-loading-style；loading.css 选择对应款式；播放页、直播页均使用 LoadingStyle。评分选项此前未被 VideoCard 使用，所以移除其 UI，保留配置兼容数据。
- 对应 DESIGN.md §9 本日修订，沿用 §2 token、§3.2 减少动态、§4 控件、§6 文案。批前快照与日志：output/settings-preview-20261025（.txt，无 tsc 扫描的备份）。
- 已完成组件定向测试 2/2：演示推进与结束、重播、换款式重置、卸载清理计时器、局部隔离与减少动态。真实浏览器发现并修复局部选择器被全站样式覆盖、300px 整页阵盘在预览中溢出两处问题；仅预览阵盘缩为 140px，前台不变。
- 最新完整测试以 `node --regexp-interpret-all node_modules/jest/bin/jest.js --runInBand --no-cache` 运行，103 套 / 609 项通过。普通 `pnpm test --runInBand` 此前也通过过，后续出现原生退出 3221225477；解释模式曾有一次未修改的 ai-tool-agent.fetch 套件在依赖加载时失败（isArray），单独复查与无缓存完整复查通过。所有异常保留日志，不修改无关测试或依赖。
- lint 和全量 Prettier 通过（lint 保留既有警告，新增组件无警告）；由于本机 Node 原生崩溃，最终用随应用附带的 Node 24.22.1 加 `--regexp-interpret-all` 运行相同 Next lint 和 Prettier 命令。此前的 `pnpm format:check` 也通过过。
- **typecheck 待用户手动验证**：本批前几次 pnpm typecheck 通过；最后仅调整预览阵盘大小后的 pnpm typecheck 连续两次原生退出 3221225477，没有 TS 诊断。两次前均确认预览已退出；补充用 Node 24.22.1 检查仍原生崩溃（unreachable code）。未修改 tsconfig、未跳过类型项，根因未知。请用户在自己的终端运行 `pnpm typecheck` 并贴回结果。日志保存在 output/settings-preview-20261025/typecheck\*.log。
- 真实有头 Chrome 从 1440×900 开始，检查三款预览仅当前款式可见、全站已保存款式不变、重播、演示结束停止、系统与站内减少动态；另用连续两帧旋转矩阵证实动画在变化（motion-frames.log）。390×844 / 820×1180 / 1280×900 深浅主题六张截图均已保存并读取相关截图核对；文档宽分别等于 390 / 820 / 1280，visualViewport.scale=1，设备缩放约 1。当前验收期间 pageerror / console error 均为 0，未发起配置写入请求。
- 浏览器证据与最终截图：output/settings-preview-20261025/browser-check.log、loading-{宽度}-{主题}.png、settings-final.png。后台原有桌面与手机面板分别挂载，浏览器检查按可见面板定位，未改原布局。预览服务也曾原生崩溃，最终以临时 `--no-opt --regexp-interpret-all` 参数完成验收，未把参数写入项目配置。
- 没做：未点击保存修改真实站点配置，未跑真实影片播放或直播；加载设置是否接入前台已通过源码链路核实，未将其描述成保存后端到端播放验收。未改房间，因此未运行 test:rooms；未推送或部署。用户随后明确要求「提交吧」，授权将本批六个文件提交到本地 Git；类型检查待手动验证的限制继续保留。下一步是用户手动类型检查与界面验收。

## 2026-10-25 手机横栏比例调整（用户最新续修，视觉核对完成，完整测试受阻）

- 用户随后明确要求“提交吧”：将本次手机横栏、分类胶囊、重复页头和空控件占位修复及相关文档一并提交到本地 Git；不推送，不部署。下面的测试限制继续保留。
- 用户要求横栏稍宽，字体、头像和主题按钮同步放大。本批仅改 tokens.css、shell.css、MobileHeader.tsx：52px 栏高、19px / 600 居中标题、48px 操作区、36px 头像与 24px 日月图标；保留内容紧接顶栏和此前全站布局修复。DESIGN.md 同步当前数值。
- 对应 DESIGN.md 本日手机布局条目的最新数值，继续遵守 §4 的控件尺寸和全站 token；没有改主题切换、账号或播放行为。批前快照与日志位于 output/mobile-toolbar-balanced-20261025。
- 本批串行检查：pnpm typecheck、pnpm lint 退出 0（lint 保留既有警告）；pnpm format:check 首次原生崩溃，串行重试退出 0；pnpm test:rooms 21 / 21；修改源码的 check-design.mjs 违规 0 / TODO 0；git diff --check 通过。完整 pnpm test --runInBand 未完成：RoomActionMenu.test.tsx 在 aria-query 依赖加载时出现 undefined.isArray，随后进程原生退出 -1073741819，未得到完整测试统计，根因未知，不宣称全部通过，未修改无关测试和依赖。
- 内置浏览器真实核对并截图：首页 390×844、820×900、1280×900 深浅色，片库 390 深浅色，访客 320 滚动前后。390 实测横栏 52px、标题 19px、按钮 48px、头像 36px，Hero 从 y=52 开始；320 访客标题右缘 100px、操作左缘 154px，滚动后 compact=true 仍不重叠。所有已记录视口文档均无横向溢出。片库分类底框 454px 覆盖最右选项 451px，保留横向滚动。已保存 browser-results.json 与 JPG。
- 验证后恢复 3000 预览运行、内置浏览器首页 1440×900 浅色。尚未完成上一批所有模块的逐页深浅响应式验收，也未验收真实多人同步、播放和阅读流程；完整 Jest 的加载异常及原生崩溃仍待定位。未提交、推送、部署。

## 2026-10-25 手机横条继续收紧（用户续修，待验证）

- 用户再次指出 52px 横条仍厚重，左上角“发现”突兀。本批只续修手机工具栏：44px 高、17px / 500 页名从首屏居中，不再先显示 24px 大标题或缩放；主内容顶部预留同步为 44px 加安全区，取消额外 8px 间隔。保留 44px 点按区、访客登录入口、返回和账号；访客操作区按真实宽度布局，标题在剩余空间居中。
- 改动为 MobileHeader.tsx、shell.css、tokens.css 与设计/进度记录；不覆盖上一批选择器、媒体页或私库改动。新批开始快照位于 output/mobile-toolbar-thin-20261025，预览已关闭，正在串行验证。此前测试失败及全站未完成验收仍按下方历史记录保留。

## 2026-10-25 手机顶栏与全站同类布局修复（测试失败后按规则停止，未完成验收）

- 用户确认 `docs/superpowers/plans/2026-10-25-mobile-layout-consistency.md` 后实施。手机共用顶栏 64→52px、标题 28→24px，滚动后仍为 17px；主内容按顶栏加 8px 预留，保留安全区，并约束长标题避免覆盖操作。平板 / 桌面高度和全站宽屏比例未作本轮调整。
- 电影分类与动漫星期栏已在内置浏览器复现底框短于选项：390 宽底框 358px，选项约 431–451px / 星期约 435px。DoubanSelector、DoubanCustomSelector、WeekdaySelector 添加外层滚动专用轨道类；原 CapsuleSwitch 的内部滚动、回调与动效逻辑未改。
- MediaShell 普通子页复用 mobileTitle，手机隐藏局部重复页名，保留说明、返回和二级导航；独立阅读器分支保持原定位。音乐只改工具栏 className / 局部安全区样式，压缩行高和间距、补足 44px 菜单宽度；未移动播放器或状态组件。电子书搜索只调整重复标题展示类；私人影库无来源时不挂载空来源控件及包装间距。
- 已枚举 58 个 page.tsx 入口，保存 41 条浏览器结构记录、涉及 34 个实际路径；其中有加载中、重定向与空状态，不能算全站真实功能验收。证据、.bak 和覆盖表在 `output/mobile-layout-audit-20261025/`。原 3000 服务检查中断开，确认无监听后按项目 `pnpm dev` 恢复；修改前已确认并关闭本项目预览。
- 第一批检查：typecheck / lint / format:check 退出 0，完整 Jest 101 套 / 592 项通过（有退出延迟提示），rooms 21 / 21，设计检查违规 0 / TODO 0。随后启动内置预览，实测 390×844、100% 缩放时顶栏 52px、主内容顶部预留 60px；其余完整深浅响应式截图尚未完成。
- 独立只读复核发现访客多出登录按钮，320px 滚动后的标题仍覆盖主题按钮；已在 127.0.0.1 的独立访客来源中复现并记录 RED。第二批尝试仅修该项，typecheck / lint 退出 0；附加 --detectOpenHandles 的 Jest 出现 Node CleanupQueue 原生断言崩溃（退出 134），根因未知。常规串行重跑随后出现实际失败：password-hash.test.ts 的 Node pbkdf2Sync 兼容断言 expected ok=true / received false；middleware.test.ts 加载 aria-query rolesMap 时 undefined.prototype。99 套通过、2 套失败，590 项通过、1 项失败。两处源码本轮未修改，但不能据此认定只是环境问题。
- 按 AGENTS.md 的测试失败停止规则，第二批 shell.css 已从 before-guest-fix/shell.css.bak 原样恢复并核对 SHA-256；保留第一批最后完整检查通过的状态，不覆盖该批其他修改。访客 320px 紧凑标题重叠仍未解决，全站视觉验收未完成；不继续尝试修复无关认证或测试设施。
- 后续需先确认上述测试失败原因，再继续访客标题和响应式验收。无真实数据的详情、阅读、播放与多人同步未验收；已有脚本加载及扫码登录 hydration 报错保留基线，未归因或修复。全部日志、覆盖表与回退记录在本批 output 目录。不提交、推送、部署。

## 2026-10-25 原生控件清零、客户端安装入口、功能权限、反馈箱、内置主题预设

- 用户发现五个问题并明确授权改 `src/app/admin/page.tsx` 与 `src/app/api/**`（本项目禁区的例外），顺序为原生控件 → 客户端安装 → 权限 → 反馈箱 → 管理面板。
- **原生控件**：新增 `components/ui/Select.tsx`（用法同 `<select>`，自绘触发器和 listbox 弹层，键盘 / 类型跳转 / 手机点按 44px，列表挂在最近的原生 dialog 里避免被模态遮挡），替换 11 个文件共 30 处 `<select>`；`styles/form-controls.css` 统一复选 / 单选 / 滑块 / 文件选择 / 数字 / 日期；`components/feedback/AppDialogs.tsx` 提供 `notify` / `notifyError` / `askConfirm`，替换 5 个文件里 24 处浏览器自带 alert / confirm。
- **客户端安装**：面板顶部新增「原生客户端」，列出 Releases `clients` 版本的 7 个固定文件名安装包，按 UA 标出「你的设备」；iOS / macOS 保留浏览器安装说明。`CLIENT_DOWNLOAD_BASE_URL` 可改成自己服务器的下载前缀（`.env.example`、compose、运行时配置已接）。
- **功能权限**：每个功能三种开放范围（所有人 / 按用户组 / 仅指定用户）+ 单个用户的单独授权，存在 AdminConfig 的 `FeaturePolicies` / `FeatureGrants`（不改数据库表）。新增 `movie_request`、`advanced_recommendation` 两项，默认「所有人」，升级后行为不变。`/api/admin/feature-access` 站长可写、管理员只读；通用配置保存始终沿用现有值，管理员无法绕过；删除用户会清掉其授权。服务端：求片、高级推荐接口加了权限校验。
- **反馈箱**：`/feedback` 页（申请功能 / 问题反馈 / 建议 / 其他），被锁功能的提示里多一个「向站长申请」；数据存通用键值存储，带限频、待处理上限和重复申请校验；管理面板新增「反馈收件箱」，站长可「同意并授权」（直接写入单独授权），管理员可拒绝 / 标记已处理；结果通过现有通知发给申请人。
- **内置主题**：旧主题 CSS 面向旧版类名，在新界面完全不起作用（外层不透明背景盖住）。已重做为 6 套带淡色调的令牌预设（只改底色、卡片、分隔线、次要文字，深浅都有），键名沿用；管理面板卡片改为可键盘操作的单选。
- 验证：见本次汇报。真实隔离实例（独立 SQLite）接口测试 27 / 28 通过，唯一失败是测试里的音乐模块本身未启用（授权已写入）；浏览器里确认下拉可选、功能权限面板、反馈页、被锁提示的申请按钮、客户端安装面板、内置主题令牌生效、复选框选中态。
- 没验证：390 / 820 宽度与浅色主题逐页截图；真机 / 真电视安装；真实邮件发送；邮件通知未接入反馈箱（目前只有站内通知）。

## 2026-10-25 v0.1.0 发布记录整理

- `PROJECT_CHANGELOG` 补充当前版本 v0.1.0（2026-10-25）的新增、改进和修复摘要；运行 `node scripts/convert-changelog.js` 同步 `src/lib/project-changelog.ts`。转换脚本使用仓库已有的 Prettier 配置，转换器测试检查生成格式，版本面板测试检查版本日期和三类发布记录。没有新增依赖，也没有升级版本号。
- 验证：聚焦 Jest 2 套 / 6 项通过；完整 Jest 96 套 / 570 项通过；`pnpm test:rooms` 21 / 21 通过；`pnpm typecheck`、`pnpm lint`、`pnpm format:check` 退出码均为 0。Lint 保留既有警告。设计检查违规 0，`src/app/admin/page.tsx` 保留原有 TODO 19 项。
- `typecheck`、`lint`、`format:check` 曾各遇到一次无诊断的 Windows 原生崩溃（退出码 3221225477）；后续格式检查又出现一次退出码 2147483651。关闭本地预览并确认 3000 端口已释放后串行重跑，命令均通过。根因未知；typecheck 与 format 首次日志以及格式重跑结果留在被忽略的 `output/release-record-20261025/`。`git diff --check` 通过。
- 真实有头 Chromium 中用获授权的本地测试账号查看版本弹窗；390 × 844、820 × 1180、1280 × 900 的深浅主题截图均保存于被忽略的 `output/playwright/release-record-20261025/`。各视口的文档宽度与视口一致；390 宽度弹窗宽 358px，1280 宽度弹窗宽 576px。窄屏文本可读。浏览器加载时已有 2 条错误和 48 条警告，打开弹窗未增加；未进一步定位基线诊断，因此不记为控制台全净。
- Git 起始审计只发现本地 `main` 和远端 `origin/main`，远端仅有 `main`；本地 `main` 当时比远端多 1 个提交，另有 33 个待提交路径。本次授权范围包含这些原有改动及发布记录更新；待核对后提交并推送。推送 `main` 会触发 GHCR 镜像工作流；未手动部署 Cloudflare 或 VPS。

## 2026-10-25 主题切换手感优化

- 用户确认现有切换效果好，只要更流畅、更有形态转换感。保留圆形揭开与日冕环；时长 420→520ms、缓动改为 `--tm-ease-theme`，四层同频（`tokens.css` 新增 `--tm-d-theme` / `--tm-ease-theme`，`theme-transition.ts` 从 CSS 读取）。新增底层画面轻微放大离场 / 落定（只 transform）。首版用 1→0.985 缩小，用户发现切到浅色时左 / 下出现与屏幕分离的黑色边界（画面内缩露出页面底色）；已改为 1→1.015，缩放恒 ≥ 1。日月图标改为同一个内联 SVG 变形，由 `ThemeToggle.tsx` 与 `primitives.css` 完成，过渡期间豁免“全站 transition 锁死”规则。
- 改动文件：`tokens.css`、`primitives.css`、`theme-transition.ts`、`theme-transition.test.ts`（时长与 token 断言）、`ThemeToggle.tsx`、`DESIGN.md` §3.3 与 §9。不碰禁区，不新增依赖。
- 验证：typecheck / lint / format:check 退出 0；完整 Jest 96 套 / 570 项通过。真实浏览器把所有过渡动画暂停并按 25% / 40% / 50% / 70% / 99% 定格检查：裁切圆以顶栏按钮为圆心，日冕环与四层动画均为 520ms，图标在深到浅方向的弯月与浅到深方向的太阳静态形态正确。
- 帧时间（无头浏览器，6 次切换）平均约 6.3ms，每次切换最多 1 帧超过 20ms（首帧快照），与改动前同量级，没有变差；因此没有动全站 `transition: none` 锁（计划第 4 步按测量结果跳过）。基线首轮误点了隐藏的移动端按钮，只作量级参考。
- 未验证 / 风险：没有逐帧视频，动画的“主观流畅度”只能由你在真实浏览器里看；390 / 820 宽度与手机触屏、电视端 `tv.css` 未单独复测（电视端没有改单独时长）；`prefers-reduced-motion` 与 `data-tm-reduced-motion` 只做了代码层面的降级，未实际切换验证；头像菜单里的三段主题控件未改。控制台的 418 为豆瓣海报外链失败，与本次无关。

## 2026-10-25 账号菜单显示设置折叠

- 用户指出把完整显示设置面板搬进账号菜单导致冗长，并明确要求聚合为一个入口、点击展开。`VisualPreferenceControls` 增加菜单展示形式，登录 / 访客账号菜单使用原生 details / summary，默认只占一行“显示设置”；展开后显示两个紧凑开关，不再展示可见标题、长说明和额外分隔线。“我的”页继续使用完整版本，偏好 hook / 存储键和业务行为未改。
- 对应 DESIGN.md 的本日用户续修、§4 菜单控件与全站 token。仅新增菜单形式的局部 CSS，不改变完整设置面板。行高至少 44px，保留 summary 键盘焦点环与原生 Enter / Space 操作；没有新增依赖、动画或权限逻辑。
- typecheck / lint 退出 0；完整 Jest 96 套 / 570 项通过；修改文件格式通过，设计检查违规 0 / TODO 0。全仓格式命令与 jitless 重试出现原生崩溃；备用 Node 保守参数完成全仓检查，但报告未修改的 `src/app/books/read/page.tsx` 格式问题，未扩展修改阅读器，不能称全仓格式通过。
- 真实 Edge 的 62 项检查全部通过、无新增控制台错误：390 / 820 / 1280 深浅色均默认收起（44px）、展开后两行各 44px、点击和 Enter / Space 可收放、无横向溢出；开关即时生效并在刷新后保留；访客版本正常；“我的”页完整说明保留。共 12 张响应式截图及两张菜单局部图。隔离实例初次编译异常，保留并移出 webpack 缓存到 `.bak`，以既有备用 Node / 保守参数恢复后完成验收，未更改项目启动脚本或依赖。
- 日志、截图、JSON 和接手快照位于 `output/playwright/menu-display-20261025/`。测试服务 / 浏览器已关闭，正常预览状态见该目录 `preview-status.json`。没有改房间代码，本次不重复房间专项与联机人工验证；不提交、推送或部署。

## 2026-10-25 功能入口与站长开关：接手 GLM 后复核收尾

- 保留 GLM 已完成的四组导航、11 个固定入口、站点 / 账号状态拆分和管理面板角色传递。用户授权 Codex 验证并完成，相关管理界面 / 配置接口按此次明确例外最小修改；此前全站比例的五个 CSS 文件已用哈希确认未覆盖。
- 确认并修复：手机样式把大屏单项覆盖成两列；源站寻片忽略原关闭标记；提示直接卸载导致未执行原生 close / 焦点恢复；登录跳转未显式关闭两层弹窗；新提示未适配减少动态；新增弹窗固定宽度没有随全站比例放大。更正管理面板仍声称“关闭后隐藏入口”的文案，恢复混入站点保存的无关图片地址改动。
- 权限复核：通用配置不能只比较私人影库聚合布尔值。已增加原始开关、各提供方实际可用性、Emby 启用源及地址完整性校验，并在 configSelfCheck 之后校验最终写入对象，防止旧格式迁移绕过。OpenList / 小雅专用接口同样保护未配置完整时的原始开关；高级推荐的脚本保存、导入、删除、切换路径也须保护首个 / 最后一个启用脚本。管理员仍可维护普通站点、模块地址及不改变全站开放状态的冗余直播源。
- 新增回归先证实原实现失败再修复；最后一批曾出现 TS2352，按批保留失败日志并撤回该批，随后以完整配置对象重做，未覆盖此前已验收修改。最终 `pnpm typecheck`、`pnpm lint`、`pnpm format:check` 均退出 0；完整 Jest 96 套 / 570 项通过，本轮改动的 7 套 / 40 项加 `--detectOpenHandles` 通过且无遗留句柄报告。上一轮全量 Jest 有延迟退出提示但最终退出 0，最终本轮无该提示；房间 21 / 21 通过。设计检查违规 0，管理面板原有 TODO 19 项保留。
- 真实 Edge：独立 SQLite 测试实例使用 qaowner / qamanager / qamember / qarestricted，未操作现有用户或站点数据库。访客 5 项、成员 / 受限成员 14 项、管理面板 51 项检查通过；最终真实 HTTP 权限检查 38 / 38 通过，包括最后增加的子服务完整性场景。覆盖关闭 / 无权限 / 登录 / 可用四态、原页面跳转、Esc / 遮罩 / 焦点、减少动态与无模糊、管理员禁用而站长可用的开关。
- 菜单 390 / 820 / 1280 / 2124 × 深浅色共 8 组，顶部 / 底部 16 张截图；另有管理面板 390 / 820 / 1280 × 深浅色 6 张截图。11 项位置稳定，分组列数分别为手机 2/2/2/1、其余 3/2/2/1；无横向溢出，卡片点按目标不少于 44px、文字不少于 12px。标准弹窗 720px，2124 宽屏约 899.57px，与共享比例一致。测量前等待入场动画结束，未把缩放动画中间帧当成尺寸。
- 边界：未接真实音乐、直播、漫画、电子书或私库服务，不把入口 / 空状态验收当作解码和阅读验收；未重做房间人工联机或生产部署。浏览器曾遇到工具进程 Node 原生崩溃，保留日志并换用既有备用 Node 继续。初始手工测试配置缺字段产生 controlled-input 警告，补全隔离配置后重验；管理端 DndContext 在 table 内注入 div 的 5 条警告仍保留，相关 table 与 GLM 接手基线及 Git HEAD 完全相同，不宣称控制台全净。
- 证据：`output/playwright/menu-review-20261025/REPORT.md` 及同目录接手快照 `.bak`、回归红绿日志、角色 / 布局 / 后端 JSON、截图和环境故障日志。测试实例已关闭，不提交、推送或部署；本轮导航 / 开关验证完成，正常本地预览状态见交付报告。后续真实外部服务播放 / 阅读接入应另行验收。

## 2026-10-24 全站页面共用主界面比例

- 用户明确要求所有界面统一。`tokens.css` 移除首页 / 片库 / 房间 / 后台四路由白名单，将 1700px 起、最多 1.25 倍的尺寸变量定义在 `:root`；普通页面、独立认证 / 阅读页面、错误兜底与 body 浮层采用相同基准，隐藏的持续播放器外壳不再影响比例。
- `auth.css`、`search.css` 协调表单宽度、字号及控件；`layout.css` 协调公共加载状态；`tv.css` 将专用导航容器与卡片文字接入共享尺寸。保持原有内容结构、移动断点、阅读字号偏好和播放器定位；未修改 TSX、业务逻辑、禁区文件或依赖。
- 浏览器隔离样式回归：57 个页面路径及两类兜底路径，390 / 820 / 1280 / 1440 / 1699 / 1700 / 1920 / 2124 / 2560 共 531 项，修前 165 项失败，修后 0 失败；另确认无 PageLayout 时根变量仍为 1.25。该结果只证明共用外壳与基础比例，不代替真实页面内容验收。
- 检查：`pnpm typecheck` 通过；`pnpm lint` 0 error（有既有 warning）；`pnpm test` 92 套 / 535 项通过；`pnpm test:rooms` 21 项通过；修改样式的 `check-design.mjs` 违规 0 / TODO 0。全量格式检查发现本进度文档既有格式问题，整理后 `pnpm format:check` 通过；收尾再次执行时原生退出 3221225477，关闭确认属于本项目的预览后，以项目原有 Prettier 加 `--jitless` 串行检查全库通过，未排除文件或改格式配置，日志为 `format-check-serial.txt`。
- 真实 Edge 遍历 57 个页面路由和 404，记录 151 组尺寸 / 主题，比例失败 0、横向溢出 0；另通过真实主题按钮（无按钮页面用 next-themes 存储事件）复核 13 个页面族在 390×844 / 820×1180 / 1280×900 的 78 张深浅截图，并额外检查 1440 / 1920 / 2124 / 2560 宽屏。2124px 下共用顶栏约 1649.22×84.96、标志 37.48px；播放报错页切到片库后宿主仍为同一节点、小窗形态，顶栏尺寸一致。三档搜索清除与焦点、密码显示 / 隐藏、电视键盘导航与容器对齐共 5 项实点通过。证据：`output/playwright/site-proportions-20261024/acceptance.txt`、`coverage.json`、`navigation.json`、`interactions.json`、`responsive-contact.jpg` 与原始截图。
- 边界：部分书籍 / 音乐 / 漫画 / 注册 / 屏幕入口跳转到其他页面，`/under` 当前为 404，已在覆盖表逐项列出；缺参 / 未配置媒体的页面只验证到当前加载、空白或错误状态，不代表真实阅读、解码或双账号房间业务已验收。二维码确认登录页在无样式覆盖的独立正常加载中复现 3 条首次渲染不一致报错，已记录但未扩展修改其 TSX。远端海报请求有 418 等失败，未宣称控制台全净。
- 环境：预览曾多次原生退出 3221225477，保留原始日志、恢复后续跑，未定位或修复根因。最终预览沿用原启动器的环境文件与覆盖值（房间健康检查 ok）；验收临时采用本机既有 Node 24.22.1 与保守 V8 参数，未修改启动脚本、用户配置、数据库或业务数据。之前一次直接预览遗漏启动器的完整环境，已纠正并重拍受影响的首页 / 房间。实际媒体、完整阅读和生产部署仍未验证。
- 对应 DESIGN.md「2026-10-24 全站比例」修订；保留既有 `vw/clamp` token 体系，没有引入新的布局 API。全站比例修复与本轮展示层验证完成，下一步为用户实际使用复核；无 Git 提交、推送或部署。

## 2026-10-24 接入用户提供的两张宣传截图

- 用户将发现首页与片库截图放入桌面，两张均为浅色主题、2549 × 1403 PNG。逐张查看后原样复制为 `docs/images/home-light.png` 与 `library-light.png`，桌面原件与原有房间截图保留，不裁切、不变色，不将它们描述为 1440 × 900 截图。
- 中英文 README 顶部改用发现首页；新增片库大图与深浅房间并排预览，共展示 4 张不同页面 / 主题截图。原计划 6 ～ 8 张中的详情、搜索和手机图尚未补齐，未用旧验收图片或空白图代替。当前先交付用户提供的两张与已有房间两张。
- 用户随后明确授权提交并推送本批 5 个文件：两份 README、两张新增 PNG 与本进度记录；按已记录的验证边界发布文档更新，不部署。
- 对应 DESIGN.md 第 2.1 节深浅主题与第 5 节页面展示；仅改文档及图片，不改页面、业务行为、房间或禁区代码。不操作浏览器、不提交、推送或部署。贡献者侧栏的最终刷新仍待确认。
- 验证：已逐张查看全部 4 张图；两份 README 各引用 4 个不同的有效图片路径，图片均可解码；新增两张图与桌面原件 SHA-256 完全相同；`git diff --check` 通过。常规 lint 退出 0（既有警告）；typecheck、正确参数重跑后的完整 Jest、全库及定向格式检查均原生退出 3221225477，没有得到完整通过结果。此前关闭预览重试的 typecheck 同样崩溃，仍待用户在自己的终端运行 `pnpm typecheck` 并回传结果，根因未定位。检查日志后缀含 `desktop-images`，存于 `output/readme-promo-20261024/`。一次新版 pnpm 的依赖状态检查要求重装，已中止而未允许清理依赖；一次 Jest 参数被当作路径，随后用正确参数重跑，均未计为通过。未运行房间专项测试，因为没有改动房间代码；没有进行新的浏览器或响应式验收。

## 2026-10-24 README 宣传图与贡献者显示核查

- 用户批准中英文 README 增加 6 ～ 8 张真实宣传图，覆盖两种主题与不同功能；桌面目标 1440 × 900，另附手机画面。仅修改文档与截图，不改页面或业务逻辑，不提交、推送或部署。
- 已核实远端主分支为 `88b261f36cf89784262855f88c5f0e341ca08797`，发布标签 `clients` 指向 `bf919e12e4edfdb2dfdbee398a13b17bf8404f82`；两者可达历史没有 Claude / Anthropic 署名。REST contributors 只返回 XYL333FYQ，但用户截图明确显示侧栏仍有 Claude，不能将接口结果当作侧栏清理成功。
- GitHub 官方文档说明历史重写后的贡献者统计约需 24 小时刷新，超过约 24 小时仍错误应联系 GitHub Support。当前没有继续强推、改默认分支或删除仓库；侧栏最终刷新尚待确认。依据：https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors#contributor-data-is-stale-after-history-changes 。
- 本轮截图未完成：Edge 连接在刷新后连续超时，随后 Computer Use 无法可靠确认当前 Windows 浏览器 URL，明确终止本轮控制。没有绕过限制切换其他自动化方式；中英文 README 已恢复到本轮开始内容，避免留下指向未生成图片的链接；原有两张房间截图保留。下次从已批准的 8 张取景方案继续，无须重新设计。
- 验证：常规 `pnpm lint` 退出 0（有既有警告）。`pnpm typecheck` 原生退出 3221225477，关闭本项目 3000 预览后串行重跑仍同类崩溃，无 TS 诊断，根因未定位，标记待用户手动验证；请用户在自己的终端运行 `pnpm typecheck` 并回传结果。完整 Jest 常规执行及解释模式重试均原生退出 3221225477，未得到完整通过结论；`pnpm format:check` 原生退出 2147483651。早期 `--jitless` 导致 lint 的 WebAssembly 不可用，随后去掉该参数后 lint 通过；一次将 regexp 标志放入 NODE_OPTIONS 被 Node 拒绝，这些尝试不计为检查通过。未修改测试、tsconfig 或源码绕过检查。原始日志：`output/readme-promo-20261024/`。
- 预览已用项目原有 `scripts/start-local.cjs --no-browser` 恢复到 3000（日志曾确认 ready），浏览器最终画面未复核。未修改页面，对应 DESIGN.md 第 2.1 节深浅主题与第 5 节页面展示，不涉及新的界面实现；390 / 820 / 1280 深浅色截图及宣传图文件验收均未完成。只保留本进度说明的变更；没有提交、推送或部署。

## 2026-10-24 电视端改运行时填地址、Windows 便携包、客户端发布到 Releases、README 中文为主

- **电视壳**（`apps/android-tv/`）：包名 `com.moontvplus.tv` → `com.tongmutvplus.tv`，项目名与 UA 换成 TongMuTV Plus；首次打开弹地址框（`ServerAddress.java`），遥控器长按菜单键换地址，WebView 版连接失败弹重试 / 改地址 / 退出；`BASE_URL` 变成可选默认值。**未改** `moontv:local-remote-*` 事件名与 `MoonTVLocalRemote` JS 桥（网页端依赖）。
- **Windows 便携包**：工作流在安装包之外多收一个 `...-Portable.zip`（主程序 exe + 使用说明），需系统自带 WebView2。
- **发布**：三个客户端工作流新增 `publish` 开关，测试通过后把固定文件名的安装包传到 Releases 的 `clients` 版本（页面标题「客户端下载」，每次运行覆盖更新）。电视端工作流新增模拟器冒烟测试，签名密钥改用 `ANDROID_MOBILE_KEYSTORE_*`。
- **README**：`README.md` 改为中文（仓库首页），英文为 `README_en.md`，顶部互相切换；两份都加了「下载客户端」。仓库简介（About）已改成中文。
- **Co-Authored-By 清理**：历史里 16 个提交带 `Co-Authored-By: Claude`，使仓库贡献者列表出现 @claude。已用 filter-branch 去掉（内容逐字节一致，原历史备份在 ai 项目/备份/\*.bundle）。2026-10-24 再核实远端主分支与发布标签均已是清理后历史；用户截图中的侧栏仍有 Claude，最终显示刷新未确认，详见本页顶部核查记录。
- **验证（云端实测）**：Windows（含便携 zip 解压即启动）、安卓手机（API 24 / 34 模拟器）、电视壳 WebView 版（API 34 模拟器）都通过冒烟测试，并发布到 Releases `clients`；手机端 API 34 首轮曾因模拟器偶发慢失败，已改成轮询等待，重跑通过。GeckoView 版（250 ～ 570MB）不放 Releases，只在 Actions Artifacts。
- **没验证**：电视壳没在真电视上测，遥控器输入地址的手感未知；真机视频播放同前。

## 2026-10-24 Windows 桌面客户端与安卓手机客户端（套壳，全部在 GitHub Actions 打包）

- **Windows**（`apps/desktop/`，Tauri 2）：窗口装系统 WebView2，首次启动在本地页填服务器地址，探测连通后跳转并记住；`Ctrl+Shift+S` 换地址、`F11` 全屏。NSIS 安装包，x64 + ARM64，支持 Windows 10 / 11。工作流 `.github/workflows/desktop.yml`（手动运行）。
- **安卓手机**（`apps/android-mobile/`，参照 `apps/android-tv`，WebView，minSdk 23 / targetSdk 35）：首次打开弹地址框，长按图标「更换服务器地址」，连接失败弹重试 / 改地址 / 退出；处理全屏视频（横屏 + 常亮 + 刘海）、返回键、文件选择、Android 15 边到边留边。工作流 `.github/workflows/android-mobile.yml`（手动运行），release 签名用仓库 secrets `ANDROID_MOBILE_KEYSTORE_*`（密钥库备份在本机项目目录之外（ai 项目/备份），不进仓库）。
- 未改 `src/`、`server/`、主项目 `package.json`；依赖只在 `apps/desktop` 内（`@tauri-apps/cli`、Rust 的 tauri）。
- **验证（云端实测，run 40119911439 / 40119915249）**：Windows x64 / ARM64 都打包成功，x64 在 Windows 服务器上静默安装并启动，进程存活、WebView2 子进程在、截图显示地址页；安卓 APK 在 API 24（Android 7）与 API 34（Android 14）模拟器上安装启动，地址框弹出，输入假服务器地址后 WebView 真实请求并渲染页面，无崩溃。
- **没验证**：真机上的视频播放、全屏横屏、后台行为、厂商系统魔改；Windows 10 真机；ARM64 安装包只验证了能打包，没运行；没有真实服务器所以没验证与站点的整体联调。`pnpm format:check` 全库命令在本机原生崩溃（退出码 3221225477，与 AGENTS.md 所述环境问题一致），已改用 `prettier -c` 单查新增文件。
- **已知**：安装包与 APK 均无商店级签名（Windows 会有 SmartScreen 提示；APK 用自建密钥签名，需允许未知来源安装）。「客户端安装指南」面板文案仍只讲 PWA，没改（`src/` 界面不在本次范围）。

## 2026-10-24 「日冕形态 ⇄ 月神形态」丝滑主题过渡与全站加载动效体系补齐

- **主题切换「日冕形态 ⇄ 月神形态」无缝流转与锁帧优化**（`src/lib/theme-transition.ts`、`src/components/ThemeToggle.tsx`、`src/styles/primitives.css`、`src/app/layout.tsx`、`src/lib/theme-transition.test.ts`）：
  - **性能锁帧（消除掉帧）**：移除 `src/app/layout.tsx` 中 `ThemeProvider` 的 `disableTransitionOnChange`（消除 `next-themes` 在动画第 1ms 插入又移除 `<style>` 引发的全站二次样式重算卡顿）；改由 `html[data-tm-theme-transition]` 在整个过渡周期内锁死普通 DOM 节点的 `transition` 并暂停骨架扫光；将 `--tm-ease-out` 读取前置到 `startViewTransition` 之前，消除 `await transition.ready` 后的同步样式计算阻塞。
  - **视觉点缀与无缝衔接（消除剪辑感）**：`ThemeToggle` 升级为带星轨光环（`.tm-theme-emblem-orbit`）与核心法相（`.tm-theme-emblem-core`）的双生结构，新旧图标在 `::view-transition-old/new(tm-theme-control)` 中以 `0ms` 延迟同频交叉旋转（`±100deg` 缩放融合），消除切换空档；在 `::view-transition-group(tm-theme-aura)` 上通过 `2×2px` 零开销锚点挂载纯 GPU Compositor 缩放（`transform: scale(...)`）的日冕破晓波前与月神蚀日双环，使其 `92.6%` 能量脊线在每一帧精确包裹 `clip-path` 几何裁切线，既彻底隐藏一刀切的数字硬边，又保持页面文字与海报 100% 锐利无重影。
- **全站加载动效体系激活与补齐**（`src/styles/loading.css`、`src/styles/layout.css`、`src/styles/tokens.css`、`src/app/douban/page.tsx`、`src/app/oidc-register/page.tsx`、`src/app/watch-room/page.tsx`、`src/features/playback/LegacyPlaybackSurface.tsx`）：
  - 为整页加载状态 `.tm-public-feedback[role='status']` 挂载 40px 黑白灰同心星轨光学旋转环，并将 `watch-room`、`oidc-register`、`LegacyPlaybackSurface` 的 `<Suspense fallback>` 统一接入该光学加载态，为片库加载更多图标接入 `.tm-spin`。
  - 解封并重塑 `src/styles/loading.css` 中 `LoadingStyle` 的三款播放器/直播专属加载动画（`talisman` 外圈 24 格细刻度慢旋 + 内圈流光圆弧快旋 + 进度条单色流光；`grid` 当前阶段格柔和脉冲外环；`classic` 中心图标外圈旋转光弧），并将首次显现延迟从 400ms 优化至 150ms ～ 180ms，适度提升 `--tm-skeleton-shine` 扫光可见度。
  - 全部新增动画严格遵守黑白灰 `--tm-*` token 规范，并完整响应 `html[data-tm-reduced-motion='true']` 与 `prefers-reduced-motion: reduce`。
- **验证**：`pnpm typecheck` 0 error；`pnpm lint` 0 error；`pnpm test` 87 套件 / 518 项全部通过；`pnpm format:check` 全部通过；`check-design.mjs` 违规 0 / TODO 0；浏览器在 1280 / 820 / 390 深浅主题下实测截图（`output/theme-loading-20261024/`）。

## 2026-10-24 清理旧项目残留、修复 DesignGridOverlay 报错、改造客户端安装指南与统一管理面板排版

- 修复 `src/components/DesignGridOverlay.tsx` 中当浏览器自动填充或输入法触发无 `event.key` 的 `keydown` 事件时调用 `event.key.toLowerCase()` 抛出的 `TypeError` 运行时崩溃。
- 彻底清除 `src/components/UserMenu.tsx` 中的「耻辱柱」弹窗与 `🐶` 按钮，以及 `DownloadManagementPanel.tsx`、`DownloadContext.tsx`、`m3u8-downloader.ts`、`file-system-access.d.ts` 共 4 个文件中的辱骂注释；移除播放页 `LegacyPlaybackSurface.tsx` 底部唤醒旧版客户端的「App 打开」「PC Client 打开」按钮。
- 将账号菜单中的原「生态应用」改造为 `TongMuTV Plus` 专属的「客户端安装指南」（提供电脑桌面端、iOS/Android 手机端 PWA 安装说明及电视大屏端入口）；「电视访问」弹窗移除第三方绿色图标 `OrionTV` 标签页，保留原生「TVBox 订阅」与「Web 电视」双标签页。
- 统一管理面板（`/admin`）排版与字号：`src/styles/tokens.css` 将 `[data-page='/admin']` 纳入 1700px+ 宽屏连续缩放体系；`src/app/admin/page.tsx` 外层容器改为全站统一的 `.tm-page-container`，页头改为 `.tm-page-head` + `.tm-page-title`；`src/styles/layout.css` 新增 `.tm-admin-page` 排版与动态字号规则，使管理面板与外部页面左右边缘及字号比例对齐。
- 优化主题切换过渡动效（方案 A）：移除 `src/lib/theme-transition.ts` 与 `src/styles/primitives.css` 中造成半透明重影雾化感的 `glow` 径向羽化遮罩及负半径起手延迟，统一采用锐利的单层 `clip-path: circle(...)` 几何裁切（亮扩暗收，420ms `--tm-ease-out` 跟手缓动），并将按钮过渡态底色统一到原有 `::before` 胶囊层以消除跳闪。
- 验证：`pnpm typecheck` 0 error；`pnpm lint` 0 error；`pnpm test` 全部通过；`pnpm format:check` 通过；`check-design.mjs` 新增违规 0；浏览器在 1280 / 820 / 390 深浅主题下实测通过，控制台 0 error。

## 2026-10-23 bug-hunter 余下问题清零、小窗可拖动、双账号走查

- 用户同意“简单就全修”，并提出小窗只能固定在右下角。没有新增依赖，没有提交；首页三套布局未动。
- 余下问题：网络直播排序不再删掉没列出的源；cms-proxy、弹幕 4 个接口、豆瓣的超时管到响应体读完（原来拿到响应头就清掉，慢响应体会一直挂着）；视频源校验没有源或全部结束时都发 complete 并关流；短剧推荐按路径判断 m3u8（`lib/hls-url.ts`，忽略 query）；定时任务后台失败会记日志，不再变成未处理的 Promise；AI 对话流式过滤被拆开的 `<think>` 标签（`lib/think-filter.ts`）；电子书图片代理逐跳校验跳转、只放行 image/\*；电子书文件代理逐跳校验，书源账号密码只发给书源同一 origin；直播页换源/切台时旧请求的结果不再覆盖新的（`lib/request-gate.ts`），播放器库加载完才初始化，切台不等 EPG 再记录；漫画阅读页卸载时不再读已经拆掉的 DOM 记进度。
- 小窗拖动（`features/playback/useMiniPlayerDrag.ts`）：只在小窗形态给画面和底栏加 transform 位移，不改定位、不重建视频元素；松手吸附最近的角，顶部让开导航 72px，最低不低于默认位置（手机上让开底栏）；位置存新键 `tongmu:mini-player-offset`；窗口变化时拉回可见范围；移动不到 6px 仍算点击，真拖动后不触发按钮。拖动中关闭过渡，`data-dragging` 下 cursor grabbing。
- 走查（测试实例 3001，独立数据目录，testowner + testguest）：建房 → 邀请码加入 → 直链 MP4 加入片单 → 播放；访客约 1 秒内收到播放、在 4.85s 暂停、跳到 1s；成员两人可见。播放记录写入，首页「继续观看」出现该片。手机 375 房间页无横向溢出；房主离开再回来短暂显示「房主交接中」，几秒后恢复「你正在主持」（重连宽限，属设计）。之前怀疑的海报不显示、半透明残影、公告反复出现、手机建房点不动 4 项都不是 bug：前两项是预览面板隐藏时 CSS 过渡被冻结，公告按内容只弹一次，建房是工具坐标映射错。
- 验证：typecheck 0；Jest 87 套 / 519 项；test:rooms 21/21；test:ops 4/4；lint 0 error（pnpm 原生崩溃后直接用 next lint）；format:check 通过（pnpm 原生崩溃后直接用 prettier）；播放相关文件 `check-design.mjs` 违规 0。
- 没做 / 风险：定时任务、漫画阅读页这两处修改没有自动化测试；直播页只做了类型检查和请求闸门单测，没有接真实直播源走查；测试实例没有视频源，「搜索 → 播放」只用直链代替。

## 2026-10-23 修复 bug-hunter 留下的 6 个确认问题

- 来源：`output/bug-hunter-20261022/FINAL-REPORT.md`「未修复与风险」里用户点名的 6 项。每项先写测试并确认在旧代码上失败，再改实现。改了 API 与 server，没有新增依赖、接口字段只增不减、存储键只新增撤销标记。
- BUG-BACKEND-1：导入不含漫画/电子书数据的备份时，清空前保存的书架和阅读记录原来不会写回（回填分支被提前 return 挡住）。现在按快照写回；成功弹窗显示「备份未包含，已保留原有数据」。
- BUG-BACKEND-2：导出时某个用户读取失败会被静默跳过，下载到“成功”的残缺备份，恢复时把该账号删掉。现在任一用户读取失败（包括读密码失败，不再当成“没有密码”）就取消整个备份并提示是谁。
- BUG-BACKEND-3：导入时某用户写入失败仍返回「数据导入成功」且按备份人数计数。现在返回 500，列出失败用户和实际导入人数，提示查日志后用同一备份重导。
- BUG-LIBRARY-2：AI 抓网页只校验第一跳就自动跟随重定向。改用 `guardedFetch` 逐跳校验，新增 `publicOnly` 选项（忽略站长内网白名单和 ALLOW_PRIVATE_PROXY_TARGETS）；Legado 订阅拉取同样处理，被拦截不重试。
- BUG-LIBRARY-3：refresh token 验证读完记录后写回 lastUsed，可能把并发撤销的记录写回来。撤销时先写 `user_token_revocations:<用户>` 标记再删除，验证写回后再查标记，命中就删除并拒绝；“退出全部设备”只影响之前创建的 token。标记超过 refresh token 有效期后在撤销/清理时删除。
- BUG-BACKEND-G2-1：已在 A 房间的连接加入已满的 B 房间不受人数上限约束。现在只有重复加入同一房间才免检。
- 测试环境 `node-web-environment.cjs` 补 FormData/File/Blob，供表单上传路由测试使用。
- 验证：typecheck 0；Jest 78 套 / 491 项；test:rooms 21/21；test:ops 4/4；lint 0 error（两次 pnpm 原生崩溃后直接用 next lint 通过）；format:check 通过（首次原生崩溃，重跑通过）。
- 没做 / 风险：这 6 项只有单元/路由级测试，没有在真实 Redis/Postgres 上做备份恢复演练；FINAL-REPORT 里其余未修项（OIDC 探测 SSRF、网络直播排序删源、书源下载代理、图片代理二次跳转等）本轮未处理。

## 2026-10-23 发布收尾：密码加盐、播放器可达性、管理面板换皮、全库 lint 清零

- 用户要求不再停在局部，按成熟成品收尾。本轮继续放开禁区（API、server、\*.db.ts、LegacyPlaybackSurface、admin），没有新增依赖。备份在 `output/{lint,pwhash,player,admin-skin}-20261023/bak/`。
- 全库 ESLint：67 个旧 error 清零（while(true)→for(;;)、hasOwnProperty、空块注释、多余转义、零宽字符改转义、db.ts case 块作用域、CommonJS require 按行豁免）；第三方 `pancheck/vendor` 加入 ignorePatterns。`.bug-hunter/`、构建产物、参考 HTML 加入 .prettierignore / .gitignore。
- 密码：新增 `lib/password-hash.ts`，用户密码改为加盐 PBKDF2-SHA256（10 万次，WebCrypto，Workers 可用）；旧 SHA-256 照常能登录，成功后自动改存新格式。D1/SQLite、Postgres、Redis 系三套后端都接入；`init-sqlite.js` / `init-turso.js` 同格式写入，并且没配 PASSWORD 时不再建一个密码为 123456789 的 admin（原来可被任何人登录成站长）。测试实例实测：旧哈希用户登录 200 后库里变为 pbkdf2，再登录仍 200，错密码 401。
- 定时任务回归修复：上一轮去掉默认口令后，start.js 的内置每小时任务会拿到 503。现在 server.js 在未配置 CRON_PASSWORD 时生成仅本次运行有效的随机口令，内置任务照常执行，外部猜不到；日志不再打印口令。README / operations / .env.example 同步。
- 账号锁定防滥用：曾成功登录过该账号的 IP（每账号最近 5 个，30 天）不受账号锁定影响，别人乱试锁不住站长；这些 IP 仍受按 IP 的封禁约束。
- 播放器（AUDIT ROOM-16/17/18）：工具栏与设置面板键盘可达、跨域片源截图给出可读提示且无 pageerror、可恢复 HLS 事件降为 warning。详见 AUDIT.md。
- 管理面板换皮：用 P5 codemod（从历史取回、临时放开 admin 后运行、用完删除）替换 5028 处彩色/中性类，按钮样式表手工映射（主操作反色、危险操作报错红描边、其余中性），开关与站内 tm-switch 一致；修正 codemod 的三类误伤：开关被加 44px 最小高度、遮罩 bg-opacity 失效变不透明、选中项同时带两种文字色。剩余 19 处 TODO 均为内容色（内置主题色样、头像点缀色、评分角标预览）。1280 深色 / 浅色、375 手机实看，无横向溢出。
- 验证：typecheck 0；Jest 75 套 / 475 项；pnpm lint 0 error；test:rooms 20/20；改动文件设计扫描违规 0。
- 没做 / 风险：Redis V1 旧接口 verifyUser 仍比对明文旧键（新登录走 V2，不经过它）；DNS 重绑定窗口；登录 Cookie 非 httpOnly；依赖审计未做（npmmirror 无 audit 接口）；Windows 本机 `pnpm build` 的 standalone 符号链接 EPERM（Docker/Linux 不受影响）。全库 Prettier 单独一次提交。

## 2026-10-23 发布前安全加固与生产实例验收

- 用户目标：按正式发布的标准自查到找不出用户可感知的问题，前后端都可改（本轮获授权改 `src/app/api/**` 与 `server/`）。首页三个界面布局未动；没有新增依赖，没有提交。修改前备份在 `output/release-20261023/bak/`。
- 代理防 SSRF：新增 `lib/server/ssrf.ts` 的 `guardedFetch`，手动跟随跳转并逐跳校验目标，拦截本机、内网、云元数据、100.64/10、198.18/15、组播等地址；已配置直播源 / EPG 的域名放行；`ALLOW_PRIVATE_PROXY_TARGETS=true` 才允许内网。接入 image-proxy、proxy/m3u8 / segment / key / logo、live/precheck、live/epg/download、web-live/proxy。图片代理只放行 `image/*`，媒体代理只放行音视频 / m3u8 / dash，其余改为 octet-stream，防止代理来的 HTML 以本站身份运行。`cms-proxy` 只接受已配置的视频源。
- 响应头：全站 `X-Content-Type-Options: nosniff`；`/api/*` 加 sandbox CSP。
- 鉴权：OIDC 探测、视频源校验、私人影库的删除 / 纠正 / 刷新只允许站长和管理员。定时任务去掉默认口令 `mtvpls`，未设 `CRON_PASSWORD` 时返回 503，口令比较用定长比较。
- 登录：Cookie 签名改用独立 `AUTH_SECRET`（`lib/auth-secret.ts`），`server.js` 启动时未配置则生成并保存到数据目录 `auth-secret`；原来用站长密码签名，成员可拿自己的 Cookie 离线暴力破解站长密码。房间鉴权同步。HTTPS 下登录 Cookie 加 Secure（`lib/cookie-security.ts`）。同一账号 15 分钟内错 10 次锁 15 分钟，站长密码比较改为定长比较。房间密码加入每账号每分钟 10 次限制。
- 用户可见：搜索时没有任何视频源，不再显示「没有找到」，改为「还没有可搜索的视频源」，站长 / 管理员给「去管理面板」入口；新增 404 页、出错页、全局出错页；全站页面标题改为「页面 · 站点名」；房间里正在播放时加入片单提示「已加入片单，当前影片继续播放」。
- 文档：`.env.example` 增加 `AUTH_SECRET`、`CRON_PASSWORD`、`ALLOW_PRIVATE_PROXY_TARGETS`；README 环境变量表、定时任务说明，`docs/operations.md` 升级与备份说明同步。
- 测试：ssrf 补跳转进内网被拦、公网跳转跟随、信任域名、内容类型；新增 `login-fail2ban.test.ts`、`auth-secret.test.ts`；房间服务补密码尝试限流。
- 验证：`pnpm typecheck` 0；`pnpm test` 459 项全过；`test:rooms`、`test:ops` 全过；改动文件 ESLint 0 error、Prettier 通过、`check-design.mjs` 违规 0。全库 lint 仍有 67 个旧 error，都不在本轮改动文件里。生产构建在独立副本完成编译、类型和 283 个页面，只在 Windows standalone 符号链接 EPERM 失败（本机权限，Docker / Linux 不受影响）。用全新数据目录启动生产实例：自动生成签名密钥；登录、首页、私有页可用；篡改 Cookie 角色后 API 返回 401、私有页跳登录；内网和元数据地址代理返回 403；公网 HTML 被改为 octet-stream；CSP 与 nosniff 头在位；`/api/cron/mtvpls` 返回 503；404 页、标题、无视频源空态在 1280 深色 / 390 下正常。首轮生产实例里房间建房、加直链 MP4、播放已验证。
- 没做 / 风险：用户密码哈希是无盐 SHA-256（在 `*.db.ts`，要跨存储后端迁移，未改）；账号锁定可被人故意触发锁住站长 15 分钟（内存态，重启清除）；DNS 重绑定的检查与使用之间仍有窗口；登录 Cookie 非 httpOnly（前端要读，已靠代理收紧与 CSP 缓解）；未做依赖漏洞审计（npmmirror 无 audit 接口）。升级后所有已登录用户需要重新登录一次。用户本机 dev 站点没有配置视频源，搜索 / 播放需要先在管理面板添加。播放器工具栏键盘可达、跨域截图失败仍未修。

## 2026-10-23 非首页加载失败、竞态与弹窗可用性修复

- 用户授权自由巡检和修改，首页三个界面的布局不动。先只读审计非首页前端，确认 14 项后逐项读源码核实再改；没有改首页布局、禁区文件、接口、存储键、Socket 事件或依赖，也没有提交。
- 源站寻片 `source-search/page.tsx`：视频源 / 分类 / 列表三个请求加取消标记，快速切源或切分类时迟到的旧结果不再覆盖当前列表；第 N 页失败时保留已加载内容、停住自动翻页（原来哨兵一直在视口里会无限请求后续页并跳过失败页），显示「下一页加载失败，已保留当前内容」和重试，重试请求同一页；非 2xx 和格式不对都算失败，不再显示成「暂无可用的视频源 / 这个源没有分类」。两个输入框补 aria-label，未关联控件的 label 改为 span。
- 短剧 `duanju/page.tsx`：同样修分页失败死循环和失败显示成空态的问题。共用新组件 `components/feedback/RetryNotice.tsx`（复用片库已有的 `tm-library-feedback` 样式与「重试加载」文案）。
- 登录 / 注册：同源回跳函数移到 `lib/safe-redirect.ts`，注册成功后的 `?redirect=` 也走同源校验（原来可被带到外站）；`?error=100%` 不再因二次 decode 抛错白屏；Telegram 确认轮询改为 ref 管理，离开页面即停止，单次网络失败不再产生未处理的 Promise 拒绝，迟到结果被忽略。
- 求片 `movie-request/page.tsx`：季度未加载完时「确认」禁用（原来可提前提交默认第 1 季）；打开新剧先清空旧季度，加载失败显示原因而不是上一部剧的季；默认选中列表第一季；只在真正搜索过后才显示「没有找到」；我的求片加载失败显示重试而非「还没有求片记录」。
- 搜索 `SearchPageClient.tsx`：`defaultAggregateSearch` / `fluidSearch` 本地值被改坏时回落默认值，不再在渲染期 JSON.parse 抛错白屏；主搜索框补 aria-label。
- 反馈组件：`ConfirmDialog` 支持异步 onConfirm，等待期间按钮禁用防连点（继续观看「清空」原来可连点两次），失败时恢复按钮；`feedback.css` 补禁用态。`MobileActionSheet` 捕获异步操作的拒绝，仍同步调用以保留点击手势。`HttpWarningDialog` 补 role=dialog / aria-modal / 标题关联、Esc 关闭、初始焦点、Tab 循环、关闭回焦和按钮 type。
- 测试：新增 `source-search/page.loading.test.tsx`（3 项）、`movie-request/page.seasons.test.tsx`（2 项）、`lib/safe-redirect.test.ts`（7 项）、ConfirmDialog 异步防连点 1 项。把三个改动文件临时换回 .bak 原版时这 10 项中 6 项失败，换回修复版全部通过。
- 验证：`pnpm typecheck` 退出 0；`pnpm test --runInBand` 71 套 / 445 项通过；改动 15 个 TS/TSX 文件 ESLint 0 error（warning 为原有类型），这些文件与 feedback.css Prettier 通过；`check-design.mjs` 违规 0 / TODO 0；禁区 diff 0。未改房间，未跑 `test:rooms`。全库 lint / format / build 的既有失败本轮未处理。日志在 `output/polish-20261023/`，修改前备份在其 `bak/`。
- 浏览器（内置，已登录）：本机没有配置视频源和短剧源，真实分页无法实测；用页面内临时替换 fetch 返回 502 的方式验证了求片、短剧、源站寻片三处错误态和重试恢复，1280 深色、390 深色、820 浅色无横向溢出，重试按钮 44px 高、居中。`/login?error=100%25` 正常显示。验证期间 dev 服务一次原生崩溃 3221225477（编译中，与既有记录同类，根因未知），重启后继续。结束时已清掉临时 fetch 替换，恢复主题偏好与视口。
- 没做 / 风险：真实采集源下的分页、Telegram 登录、HttpWarningDialog（只在站长 + 非本地 HTTP 时出现）没有实机验证，仅单测 / 代码审查。全库 lint 69 个旧 error 都在后端 `src/lib` 与禁区 `src/app/api`，未动。Windows 下 `pnpm build` 的 standalone 符号链接 EPERM 是本机权限问题（需开发者模式或管理员），Docker/Linux 构建不受影响，未改配置。

## 2026-10-22 主题效果本地提交范围

- 用户授权提交上一版圆弧柔光。提交范围仅为主题过渡工具、对应测试、`primitives.css` 的主题区、这几轮主题进度及相关截图；共用样式其他区段、进度里的其他批次和工作区其他既有改动不一起提交。验证基于当前工作区，未另建干净 checkout 验证整个独立提交；全库 lint / 格式 / build 的既有边界仍保留。仅提交本地当前分支，不推送、合并或部署。

- 提交前再次运行定向主题 / 账号测试，2 套 / 15 项通过；目标源码 ESLint、Prettier、设计扫描（违规 0 / TODO 0）、暂存 CSS 格式、暂存范围和空白检查均通过。此提交步骤未重复全库检查，历史失败边界不变。

## 2026-10-22 按用户要求撤回新增点缀

- 用户要求恢复上一版，已从 `output/theme-arc-details-20261022/*.before.bak` 精确恢复 `theme-transition.ts`、对应测试和 `primitives.css`，三个文件哈希均与本轮开始前备份一致。撤回分段细弧、额外尾波、六个光点、第三动画及临时装饰节点，保留上一版圆弧柔光；没有继续增强或改动其他功能。仍在原分支，未提交、推送或部署。
- 恢复后定向主题 / 账号测试 2 套、15 项通过；内置浏览器在 1440×900 实点深浅双向切换，最终浅色原房间，装饰节点 / 触发标记 / 暂停动画 / 调试覆盖均为 0，坐标变量清空。截图在 `screenshots/theme-circle-rollback-20261022/1440-light.jpg`。原启动器恢复为 28064、health ready 为 ok。本次精确回退未重跑全量 typecheck / lint / test / format / rooms / build，上一版的检查边界见下方历史记录。

## 2026-10-22 保留圆弧并增加柔光回波

- 用户明确要求在原圆弧上增加效果。本轮曾误改为斜向扫光，收到纠正后已从上一轮精确 `.bak` 恢复圆弧，再只增加弧边柔光和很淡的同心回波；斜向方案不在当前源码中。保留按钮圆心、开灯展开 / 关灯收拢、500ms、原 in-out 曲线和控件 200 / 320ms 交接，不改页面布局、图标或黑白定位。
- 本轮源码仅修改 `src/lib/theme-transition.ts`、对应测试、`src/styles/primitives.css`，另更新本进度；保留当前分支及其他旧改动。增强采用注册的半径变量和互补径向遮罩，软边随视口在 18–36px 内调整，快照之间透出 token 定义的中性亮面；首末半径留三倍软边余量，保证最远角完成覆盖。没有新增 DOM 遮盖层、依赖或修改接口、存储键、Socket、播放器、数据库。两个快照动画共同取消，减少动态和旧请求保护延续原实现，结束清理坐标、效果和触发标记。
- 规则对应 DESIGN §3.3 第 11 条的按钮圆形扩散和 500ms、§3.2 的一次性几何过渡 / 减少动态、§3.4 的禁用旋转与彩色光效。按用户本轮授权用径向 mask 增强原圆形边缘；没有将增强扩展为其他形状。不支持 mask / 注册属性时仍使用原 `clip-path:circle`，不支持 View Transition 时沿用原淡入淡出。
- 新增四项回归（深浅两个方向、双层减少动态取消、不支持 mask 保持旧圆弧），先在旧圆弧实现观察 3 项失败，再补实现；原有用例未删改断言。最终 `pnpm typecheck` 退出 0；`pnpm test --runInBand` 为 67 套 / 406 项通过（50.717s）；`pnpm test:rooms` 为 19/19。目标 TS 两文件 ESLint 退出 0，三个源码 Prettier 通过，设计扫描违规 0 / TODO 0。源码检查期间预览关闭，检查完成后再启动浏览器。
- 全库 `pnpm lint` 仍退出 1（69 error / 1054 warning），与上一轮按文件、行列和消息比较差异 0；`pnpm format:check` 仍退出 1（234 个既有文件）。本轮未重跑 build，旧审查的 build 阻塞未宣称解决。完整命令日志在 `output/theme-circle-glow-20261022/`；没有全库格式化、修改检查配置或掩盖错误。
- 内置浏览器实际检查 390×844、820×1180、1280×900 深浅六组，最终恢复 1440×900 浅色；截图 11 张在 `screenshots/theme-circle-glow-20261022/`。各宽横向溢出 0、按钮 44×44、推荐 3 / 4 / 6 张仍同一行。工具恢复后视口曾回到 1440，已按原生实际宽度纠正记录并重拍覆盖 820 图，没有用错误尺寸作验收。连续四次切换结果交替正确、临时变量清空且暂停动画 0；账号菜单方向键双向选主题有 2px 焦点环，Esc 关闭并返回账号按钮。本轮恢复后的控制台 error / warning 均为 0（作用区间见 console-resumed.txt）。
- 原生快照中间帧确认圆心与按钮一致（1440 档 x=1270 / y=34）、双层时钟一致、500ms / fill forwards，弧边柔光和淡回波可见。四张 `paused` 图明确为暂停原生动画取帧，随后恢复；不把它们当作正常速度或 FPS 证据。真实减少动态中途开启已确认取消两个快照、清空标记，之后恢复；站内 false / 系统 false。恢复前的工具观测另存 pre-reset-observations.txt，区分于恢复后的原始 JSON 记录。工具 rAF 在闲置基线也约 1006ms 才采样，不能据此证明实际设备的平滑度或绘制性能；大屏性能、实际视频音频连续播放和其他浏览器仍未验收。增强能力降级本轮由单测覆盖，未在当前新标签再次模拟全部旧浏览器。
- Modern Web Guidance 的 `interactive-content-reveal` 要求 “register the variables using `@property`”，本轮注册半径以插值圆弧边缘，避免整段渐变字符串跳变；`motion` 的 “Use `clip-path` and `mask-image` for custom geometric reveals and smooth fade-outs.” 只应用于这一处主题快照，普通按钮仍用 opacity / transform。读取的原文在 guides.txt，另核对 [MDN @property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40property) 和 [Chrome 同页 View Transition](https://developer.chrome.com/docs/web-platform/view-transitions/same-document)。只读 Agent 复核未发现阻塞，未并行写文件。
- 预览恢复时原服务已不在，沿项目原 `start-local.cjs --no-browser` 启动，启动器 13844 / 服务 3760、health ready 的 application / rooms 均 ok；没有改启动配置或用户数据。没有新建房间、加片、发送消息或删除记录；最终原房间片单 0 / 成员 1。此轮没有提交、推送或部署。废弃斜向试验目录 `output/theme-light-sweep-20261022/` 已核对为本轮试验文件并确认清理目标在项目 output 下，但删除被自动审批以 blocked by policy 拒绝、无具体原因；保留目录，不换工具绕过。当前有效证据与备份在独立 circle-glow 目录。
- 本轮圆弧效果实现与上述范围验证完成；下一步由用户查看实时观感，原 AUDIT.md 的播放器 / 构建 / 历史检查债务及清理阻塞继续保持未完成，不把局部主题验收写成整个审查目标达成。

## 2026-10-22 主题切换节奏与控件过渡

- 本轮按用户“更高级一些”的要求，在原有黑白主题和圆形扩散内细化，不重新设计页面。采用保守方案：开灯从触发按钮展开新亮面，关灯把旧亮面收拢到按钮；保留 DESIGN §3.3.11 的 500ms 时长，改用现有 in-out 曲线。日月控件独立做 200 / 320ms 淡出淡入和 4px 位移，按钮 hover / focus 有轻微圆形底面反馈，不加旋转、弹跳、彩色光效或整页缩放，遵守 §3.2、§3.4 和 44px / focus-visible 规则。
- 源码只改 src/lib/theme-transition.ts、对应测试和 primitives.css 的主题切换区；没有改 ThemeToggle / ThemeSettings 的现有入口、next-themes 的存储方式、接口、房间协议、播放器或数据。仅当前触发控件获得命名快照，避免顶栏和菜单入口重名。旧请求不能清理新请求的标记；同一明暗下仍保存“跟随系统”等设置，但不重播整页动画。降级保持 125+125ms，透明度最低由 0 改为 0.88，保留可见内容。
- 独立只读复核指出暗色旧快照在结束时需要保持最后一帧，已补 fill:forwards 和断言，等快照结束再清理。真实中间帧又发现白色新图标会叠在尚未收拢的浅色页面上，已给顶栏按钮的临时快照添加 --tm-surface 底色；标记清理后恢复透明。两个问题都在本轮内修正并复验。复核 Agent 只读，无并行写文件。
- 新增 5 个有行为意义的回归用例，覆盖关灯收拢 / 最后一帧、相同明暗仍保存 system、降级不隐藏页面、旧 ready 回调不覆盖新选择、过程中减少动态取消。新增用例先在旧实现确认失败，再补实现；原有 5 个主题用例和账号主题用例保留。最终 pnpm typecheck 退出 0；pnpm test --runInBand 为 67 套 / 402 项通过（46.606s）；pnpm test:rooms 为 19/19 通过。两个 TS 文件 ESLint 退出 0，三个源码 Prettier 通过，设计违规 0 / TODO 0。没有改测试配置、依赖或跳过断言。
- 全库 pnpm lint 退出 1，仍为既有 69 error / 1054 warning，与前批按文件、行列和消息逐条比较差异 0；pnpm format:check 退出 1，仍为既有 234 文件格式问题。没有修无关历史问题或全库格式化。本轮未重跑 build；旧审查中 build 未通过及其余未完成项仍按原报告处理，不将本轮主题完成写成原目标全部达成。完整命令输出在 output/theme-polish-20261022/ 的 .txt。
- 内置浏览器完成 390×844、820×1180、1280×900 深浅六组，并保留 1440×900 深浅桌面图；实际 CSS 宽度分别确认，页面横溢出为 0，主题按钮 44×44。原生动画检查确认开灯使用 new(root) 0→ 最远角半径，关灯使用 old(root) 反向，时长 500ms、fill forwards、控件独立 200 / 320ms。连续四次相反选择最终正确；账号菜单方向键选择浅色有 2px 焦点环，Esc 回到触发按钮。刷新后浅色设置保持、原房间恢复；推荐仍为窄屏三卡 / 平板四卡 / 桌面六卡，同一行，没有因此修改推荐逻辑。
- 实际验证系统与站内“减少动态效果”分别开启时无整页快照动画；站内通过 /my 原开关操作，随后恢复 false。另在真实过渡暂停到 150ms 后模拟系统减少动态，确认快照、标记和暂停动画均清除。模拟不支持 View Transition 时实点切换，读到第一阶段 1→0.88 / 125ms，最终 body opacity 1，原生能力已恢复；第二阶段同时有单测验证。所有媒体模拟已清除，原生 API 无临时自有覆盖，结束时标记和暂停动画均为 0。/my 的既有播放历史未修改，也没有添加影片、发聊天、创建或删除房间。
- 截图共 13 张在 screenshots/theme-polish-20261022/；dark-midpoint-paused-250ms.jpg 与 light-midpoint-paused-180ms.jpg 是明确暂停原生动画取得的中间帧，用于检查绘制与对比度，不是正常时长的性能证据，之后均恢复。平板浅色首图未完整绘制播放器引导，已在稳定状态重新拍摄覆盖。浏览器工具两次 detached 等待和一次异步 CDP 等待超时，随后直接读取均已完成且标记清除，未据此修改应用；不将工具等待时间认定为 500ms 动画的实际总耗时或已定位的性能问题。
- 本轮浏览器复验区间 console error 0，豆瓣主渠道超时后切换备用的既有 warning 共 2 条，未隐藏日志。只验证了空播放器房间与共享 /my 主题，未验证实际视频、音频在快照期间的连续播放，也没有做其他浏览器或生产性能验收。browser-checks.txt 保留原生关键帧、状态、布局、恢复和控制台证据。截图是工具 JPEG，有压缩观感。
- 依据已读取的 Modern Web Guidance motion 指南 “Prefer to animate opacity and transform” 及 “Use clip-path and mask-image for custom geometric reveals”，普通控件仅使用 opacity / transform，几何裁切只用于这一次性主题过渡；结合 [Chrome 同页 View Transition 文档](https://developer.chrome.com/docs/web-platform/view-transitions/same-document) 的 ready 后裁切和 [MDN 命名快照说明](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using) 保持渐进增强。按 DESIGN 的旋转禁则，没有采用旋转日月图标的建议。
- 最终内置浏览器留在 1440×900 浅色原房间，片单 0 / 成员 1；预览启动器 27976 / 服务 30860，沿项目原 start-local.cjs --no-browser 恢复。源码检查期间预览关闭，完成后才启动截图。此轮未提交、推送或部署，旧未提交工作及先前审批拒绝的清理目标保留。下一步只需用户查看本轮视觉效果；原审查待处理项继续见 AUDIT.md。

## 2026-10-22 快速开始按容器容量填满一行

- 用户截图中的四张没有换行，实际问题是上一批将推荐数量固定为四部，而桌面卡宽沿用六列档，右侧留下大量空白。本轮在内置浏览器复现：1440 CSS 宽、推荐区 1240px、四卡宽 186.66px，原行尾空白约 437px（包含行内边距）。本轮修正为按推荐区实际宽度决定可见数量，并明确将“保持一行”落实为“候选充足时填满一行”，不靠放大四张卡片填空。
- 修改 RoomQuickStart.tsx、rooms.css、RoomRecommendations.test.tsx 和此进度区。沿用片库三 / 四 / 六列的卡片尺寸分档，改由命名容器查询按推荐区宽度应用；同一个 CSS 列数同时决定卡宽和脚本展示数量。组件使用项目已有的 ResizeObserver 模式读取容量，保留完整随机候选顺序，缩窄只减少可见前缀、放宽补出后续影片；没有固定 BATCH_SIZE，也没有在脚本中复制一套视口断点或为 1440 特设规则。缺少 ResizeObserver 时使用 resize 监听，卸载时清理监听。
- 随机换批按当前可见容量优先抽取新片，数量不足时保留既有真实目录规则，不制造影片。目录地址、参数、缓存读取和精选排除策略均沿前批；缩放和换批不额外请求目录，没有改首页、共享海报组件、播放器、房间协议、数据或依赖。保留此前输入框聚焦、海报 contain 和共用卡片动效。本轮覆盖 DESIGN 历史四张数量约定，继续遵守当前栅格尺寸、§3 动效及 §4 海报规则。
- Modern Web Guidance 的 responsive card grid 检索出现 Z_DATA_ERROR，按技能回退列表后读取 size-aware-styling，依据 “Define the container type” 设置命名 inline-size 容器，再让子级按该容器适配；没有使用整屏宽度推测组件宽度，也没有使用 size 容器导致高度塌陷。
- 新增两个回归用例先在旧实现确认失败：期望六部、实际四部；之后验证六 → 三 → 四 → 六时片名顺序保持、请求次数保持一次、卸载断开观察，以及六卡整批换新。原有八个推荐 / 选片 / 失败兜底用例保留并通过；测试环境只补 CSS 容量和 ResizeObserver 的布局模拟，真实 CSS 另用浏览器验证。最终定向 10/10，pnpm typecheck 退出 0，pnpm test --runInBand 重跑 67 套 / 397 项通过（44.518s），pnpm test:rooms 为 19/19 通过。
- 全库首次 Jest 在加载 semver 依赖时出现正则 SyntaxError，尚未进入用例，原始日志已保存；同命令串行重跑通过，根因未定位，没有修改依赖、测试配置或吞掉断言。全库 pnpm lint 仍为 69 error / 1054 warning，与前批按文件、行列和消息比较差异 0。pnpm format:check 首次原生退出 3221225477，重跑为既有 234 文件格式问题、退出 1。两个 TSX 定向 ESLint 通过，三个源码 Prettier 通过，设计违规 0 / TODO 0；本轮未重跑 build、全库格式化或改其他既有问题。
- 内置浏览器完成 390×844、768×1024、820×1180、1024×900、1280×900、1440×900、1920×1080 的深浅各一张，14 组均逐张查看，主题切换标记清除后才截图。数量分别为 3 / 4 / 4 / 4 / 6 / 6 / 6；所有卡片 y 坐标相同，页面与行内横向溢出均为 0，行尾与内容右边界差为 0–0.063px，图片均加载成功且保留 lazy。宽度按实测 CSS 布局记录；1440 档的 CDP cssLayoutViewport 为 1440×900、布局 zoom 1，物理 layoutViewport 为 2160×1350，未把截图物理像素或工具栏预览缩放当成 CSS 宽度。
- 实际桌面点击换批六部全部换新；手机 Shift+Tab 聚焦换批有 2px 可见环、Enter 换三部且与前批交集 0；回到 1440 自动补足六部且手机三部前缀不变。连续缩放及两次换批新增目录请求 0。点击新增第六卡“消失的人”以同名预填原选片器，Esc 关闭，未添加影片。最终批次和十四组布局记录见 browser-checks.txt；换批后的最终批次与早先测量批次不同属于用户操作的预期结果，不能把跨批次比较当成缩放乱序。
- 本轮复验区间 console error / warning 均为 0；停服验证期间的旧连接日志不计入该区间。预览已恢复，启动器 25536 / 服务 20576，health/ready 的 application / rooms 均 ok。内置浏览器保留 1440×900 浅色原房间，片单 0 / 成员 1，选片器已关闭。未创建房间、发送消息、修改用户数据或留下浏览器内容注入。
- 完整命令输出、浏览器记录、14 组截图、最终 1440 图及本批前 .bak 在 output/room-responsive-row-20261022/。保持当前 audit/room-page-polish 分支和既有未提交工作，未提交、推送或修改远程；旧审查报告及此前审批拒绝的清理目标保留。此续修完成，不代表旧审查的剩余阻塞已解除。

## 2026-10-22 快速开始随机推荐与单行换批

- 用户要求房间底部推荐不要照搬精选、只保留一行，并增加随机刷新。本批修改 RoomQuickStart.tsx、rooms.css、RoomRecommendations.test.tsx 和此进度区；沿当前 audit/room-page-polish 分支工作，没有提交、推送或修改远程。保留其他未提交工作、输入聚焦修复及共用海报动效，没有修改首页、接口、存储键、房间协议、播放器和数据。
- 保守沿用每批四部及片库相同的卡片尺寸。目录改为现有热门电影接口 start=20 / limit=60 的后续候选；先排除本机已有 Douban / TMDB / TX 精选缓存中的同名影片，再按 ID 和规范化片名去重、随机抽样。换批优先使用当前四部之外的候选，足够时四部全部更换，不靠重排制造变化；候选只在当前组件内保留，换批不重新拉目录。页面重新进入会重新抽样，不是全片库随机或个性化推荐。
- 精选排除的边界：只能排除当前浏览器能读取到的精选缓存；首次没有缓存或首页后来更换数据时，后页候选降低重复，下一次换批会重新检查缓存，但不宣称能知道尚未取得的精选内容。没有为此修改首页推荐或额外请求首页接口。上游不可用时继续显示过滤后的既有目录缓存并明确提示、提供重试；加载时禁用换批；候选数量不足以改变内容时禁用无意义的换批。
- 布局仅对 tm-room-recommendations 使用一维 flex 单行和 overflow-x auto，卡宽保持桌面六列档 / 平板四列档 / 手机三列档，手机第四张横滑查看；16px 内边距给悬停抬升和焦点环留空间。标题旁增加 44px 高的换一批与浏览片库操作，换批有 aria-label 和读屏状态公告。依据用户本次单行要求覆盖 DESIGN 当前房间四张的换行表现，继续遵守 §3 动效、§4 海报比例和 44px / focus-visible 规则。Modern Web Guidance 检索单行卡片模式后采用 css-layout 的 “Use flexbox” 单轴布局建议，并显式允许横向滚动，避免 nowrap 导致页面溢出。
- 验证先 RED 后 GREEN：新增精选排除、整批换新、去重与短候选池、失败重试测试，旧实现三个新增用例确实失败；原先固定前四名的断言按用户的新随机要求改为四部唯一候选和真实选片回调，不再锁死旧排序。另补跨来源损坏缓存与加载禁用测试。最终 pnpm typecheck 退出 0；pnpm test --runInBand 为 67 套 / 395 项通过，44.123s；pnpm test:rooms 为 19/19 通过。两个 TSX 的 ESLint 退出 0，三个源码文件 Prettier 通过，check-design.mjs 违规 0 / TODO 0。没有改测试配置、跳过测试或新增依赖。
- 全库 pnpm lint 仍为 69 error / 1054 warning，与前批按文件、行列和消息比较差异 0，退出 1；pnpm format:check 为既有 234 文件不合规范，退出 1。本批未全库修格式或重新运行既有失败的 build，不将定向功能完成写成旧审查目标已经全部完成。完整命令输出保存在 output/room-random-recommendations-20261022/ 的 .txt。
- 内置浏览器实际连续三次点击换一批，每次四部与上批交集 0，目录请求新增 0；键盘 Shift+Tab 聚焦换批有 2px 可见环，Enter 换批有效。点击卡片以实际片名预填原选片器，Esc 关闭；刷新页面后自动恢复原房间并取得新随机批次。没有添加影片、发送聊天或修改原房间。悬停抬升 6px、缩放 / 倾斜和高光正常，实测 rx 约 3.03deg / ry -2.40deg，高光 opacity 1。
- 390×844 / 820×1180 / 1280×900 深浅六组截图均已逐张查看，另有 1440×900 最终浅色截图。所有卡片的 y 坐标相同，宽度分别约 111.32 / 181 / 179.99px，1440 时 186.66px；页面横溢出 0。手机实际横向滚动和键盘访问末卡成功，滚动量约 123.33px；两项操作高 44px，四图加载成功并保留 lazy。主题截图均等待切换标记移除；平板浅色首次截图滚动位置不对，已重新定位到推荐行并覆盖，最终图有效。
- 本轮浏览器 console error 0；刷新页面时目录主渠道出现一次超时 warning，现有备用直连成功，未隐藏日志。海报原站多次返回 418，现有 PublicPoster 备用源返回 200，最终四图均正常；没有扩大范围修改共享图片策略。原始网络摘要、批次片名、布局测量与控制台记录见 browser-checks.txt。PNG 原始截图受工具物理像素展示影响，最终展示使用完整视口 JPEG，不据此改页面布局。
- 预览启动器 25548 / 服务 34344，单一 127.0.0.1:3000 监听；health/ready 的 application / rooms 均 ok。内置浏览器最终保留 1440×900 浅色原房间，片单 0 / 成员 1。证据、命令日志和 .bak 位于 output/room-random-recommendations-20261022/；原始审查报告及审批拒绝的清理目标没有改动。此续修已完成，旧审查剩余事项仍按原报告处理。

## 2026-10-22 快速开始复用片库卡片尺寸与动效

- 用户指出快速开始卡片过大且缺少与片库一致的动效。前批只把画幅改成竖版，保留了四列自定义网格且未接入共用悬停能力。本批只改 RoomQuickStart.tsx、rooms.css 和此进度区；推荐数量、来源、排序、缓存和选片回调不变，保留前批输入框聚焦修复。
- RoomQuickStart 直接使用现有 PosterGrid、tm-video-card / tm-video-card-art 类和 posterTiltHandlers；保留已有 tm-press。删除本地四列及横向滚动网格覆盖，采用片库同一组六列桌面 / 四列平板 / 三列手机规则；保留 2:3 contain 完整竖图。对应 DESIGN §4 海报卡、§3.3 动效与减少动态规则；没有新增依赖、重复实现动效或修改共享组件。
- 实测桌面卡片宽从 292px 到 186.67px（1440 视口）；1280 为 180px、820 为 181px、390 为 111.33px。悬停海报抬高 6px、放大 1.04，高光 opacity 1，指针移到偏角位置的旋转约 rx=3.32deg / ry=-2.50deg；真实按下 scale 0.97，键盘 Tab 聚焦同样抬起放大。系统减少动态时 transform none、旋转不再写入，已恢复原系统模拟和站内 false 偏好。
- 内置浏览器完成 390×844 / 820×1180 / 1280×900 深浅六组，另有 1440×900 浅色最终图；逐张查看，无页面横向溢出，四图已加载且完整显示。实际点击希望卡片，选片器预填希望，Esc 关闭；没有加入片单、发送消息或改原房间设置。本批交互复验区间 console error / warning 0；连接重建和停服旧日志另计，不宣称全站控制台永远无错。
- 普通 Jest 67 套 / 390 项通过（44.741s），房间 19/19；目标 TSX ESLint 0，两个源码 Prettier 通过，设计违规 0 / TODO 0。普通 typecheck 两次原生退出 3221225477，同配置现有 regexp 参数运行也原生退出，无 TS 诊断；根因未知，仍需用户终端运行 pnpm typecheck 并贴回结果，未修改检查配置、跳过源码或冒称类型通过。
- 全库 lint 69 error / 1054 warning，与前轮按文件、位置和消息逐条比较差异 0。全库格式有 234 个文件不合规范，并在未修改的 VersionPanel.tsx 出现 Prettier 解析 TypeError，退出 2；目标源码格式通过。没有修改该无关组件、全库格式化或重跑既有失败的 build。
- 工具连接在用户继续时重建，核实旧预览进程与监听均不存在后，沿原 start-local.cjs --no-browser 恢复；现启动器 26332 / 服务 37884，仅 127.0.0.1:3000，health ready application / rooms 均 ok。当前内置浏览器保留 1440×900 浅色原房间。浏览器首次瞬时目录随后自动恢复房间，未匹配到进入按钮属于状态已变化，未重复点击或创建测试房间。
- 证据位于 output/room-card-motion-20261022/：完整命令日志、.bak、browser-checks.txt、六组 JPEG、键盘/悬停/按压截图及最终桌面图。JPEG 工具截图有压缩观感，另存原始 PNG；不将截图编码差异当成应用样式修改。原有未提交工作、禁区、数据和此前审批拒绝的清理目标均保留；本批未提交或推送。

## 2026-10-22 房间输入聚焦与快速开始海报续修

- 用户要求修复聊天输入框聚焦时多重描边、快速开始竖图被横裁；首页推荐只解释原理。本批仅修改 rooms.css 和此进度区，没有改组件行为、推荐请求、缓存键、API、播放器或同步禁区，也未新增依赖。
- 输入框叠加了表单 focus ring 和全局 focus-visible 外环；房间内嵌输入改成 2px token 描边贴合边界（offset -2px），清除额外 box-shadow，保留鼠标与键盘聚焦反馈。对应 DESIGN §4 输入框聚焦；贴合边界覆盖旧的外移 2px，依据本次用户截图反馈。
- 快速开始保留现有四条与点片查源流程，画幅改为 2:3、object-fit contain，完整显示不同比例的真实竖图；沿用首页窄宽海报的 28% / 手机 40% 列宽，避免竖版在手机占满一屏。对应 DESIGN §4 海报卡及当前依据中的窄宽海报比例。
- 源码检查期间关闭已核实的 41920 / 35744 预览。普通 typecheck 两次均原生退出 3221225477，无 TS 诊断；同配置 node --regexp-interpret-all tsc 退出 0，不冒充普通命令通过，仍需用户自己的终端运行 pnpm typecheck 并贴回结果。首次测试包装参数错误，未运行测试；直接普通 Jest 曾原生崩溃，普通串行重跑退出 0：67 套 / 390 项，46.088s；房间 19/19。没有断言失败、跳过用例或改测试。
- 全库 lint 为 69 error / 1054 warning，与前轮 69 条按文件、位置和消息逐条比对差异 0；全库 format 为 234 文件，较前轮 233 多出已有 PROGRESS 格式问题（本批修改进度前已记录）。目标 rooms.css Prettier 通过，设计违规 0 / TODO 0；没有全库格式化或重跑已有失败的 build。
- 内置浏览器完成 390×844 / 820×1180 / 1280×900 深浅六张，另保留 1440×900 浅色最终效果；点击及真实 Tab 均 2px 单圈、box-shadow none，输入高 44px。各宽无页面横溢出，四张图片加载且 2:3 contain；手机能横向浏览，实点末张会以片名打开选片器，Esc 关闭；没有发送消息、添加影片或修改原房间设置。本批样式复验区间 error / warning 0，停服期间的旧断线日志不计入该区间。
- 只读核对：RoomQuickStart 先读 homepage_movies，后台查询豆瓣热门电影全部分类的第一页，取前四；当前登录首页 BannerCarousel 取独立豆瓣榜首五条，浏览器缓存 24 小时、接口服务端缓存 3 小时，无随机抽样或下一页请求。自动轮播只是轮转当前五条，挂载时检查缓存，不是在页面内定时换一批。实际首页缓存为希望、杯雪·一战成名、祈念守护人、尼娜与萝扎、逃出布迪秀；房间当前为希望、杯雪·一战成名、眩晕、登峰传奇：丹增诺盖，证实同源但不同步。没有因此认定豆瓣内容不足或改推荐策略；未登录直读受保护 API 返回 401，实际缓存来源通过浏览器只读核对。
- 预览已沿原启动器恢复，启动器 25476 / 服务 45528，3000 单一监听，health ready application / rooms 均 ok；最终内置保留 1440×900 浅色房间，输入空白且聚焦。日志、.bak、前后截图及 browser-checks.txt 在 output/room-focus-posters-20261022/；未触碰此前审批拒绝的清理目标、原用户数据和其他未提交工作。本批未提交或推送。

## 2026-10-21 放映室自主审查（16 项已修，整体验收未通过）

- 用户授权自主 Playwright 全面检查、逐项最小修复及单独提交；分支 audit/room-page-polish，16 项修复各自提交，未 push/部署或改 remote/main。完整问题、提交和截图索引见 AUDIT.md（20 项问题，16 项已修，未修 4 项（2 项 P2、2 项 P3）；包含 1 项本轮引入后修正的回归）。
- 已修：MP4 元数据误解析；弹窗焦点/Esc；手机聊天热区；三标签键盘语义；账号菜单及嵌套弹窗取消；表情离线/回焦；时间对比度；选片搜索竞争；共享页类型副作用；退房小窗错位；手机紧凑标题；隐藏目录轮询；短视窗输入焦点被底栏遮挡；播放器图标配色；换房邀请复制反馈。
- 最后源码普通 typecheck 0，67 套/390 项 Jest、房间 19/19、运维 4/4；目标 lint 0 error/9 旧 warning、格式通过，设计扫描违规 0/TODO 0。全库 lint 仍 69 旧错误/1054 warning，格式 230 旧文件加 3 个未能删除的本轮生成物；build 三种尝试未过（原生崩溃、Windows symlink EPERM、jitless 缺 WebAssembly），最终无成功构建。未改检查配置、依赖、同步或会话禁区；原生崩溃根因未知。
- 真实两上下文完成邀请/剪贴板、权限拒绝/授权、片单增删排序到 MP4/HLS 实播、暂停/拖动、MP4 主持交接、真实停服重连、刷新恢复、同 video 跨页/折叠。七宽深浅最终截图、粗指针 44px tap、390×520 真实 Tab/命中、偏好及图片成功/失败均核对；前期共 174 张 PNG，内置浏览器补测后合计 194 张截图。主要播放器工具栏已补测倍速/静音/翻转/画中画/两种全屏/快进/末集/截图/Tab；设置内部全部扩展配置、生产性能、物理输入法、听音和真正 screen 采集未完整验收。
- 续查已补齐 AUDIT 顶部真实总结，确认两项既有 P2：播放器工具栏没有可见的键盘焦点入口，16 次实际 Tab 跳过；普通 MP4 截图两次抛 tainted canvas pageerror，无下载。独立只读复核确认，完整修复涉及 AGENTS 明确禁止的 Legacy 内部逻辑，不采用外部 DOM 注入、全局强制 CORS 或隐藏入口冒充修复。本次只改报告/截图，源码未变，未重复全套代码测试。
- 当前保留两项 P3（高级设置颜色、换房复制反馈均已补修）：海报原域 418 后备用域成功；HLS fatal:false 缓冲事件仍记 console.error。因此完整主流程零 error 未满足，不吞日志。另待确认共享入口转换设计、约 1.5s 同步容忍、海报首选策略。原 1027 文件核对缺失/越界 0，旧工作保留，审查基于当前工作区而非独立干净 checkout。
- 两个测试房间在临时库经准确名称删除，三个目录残留 0；两个临时账号删除 HTTP 200；专用浏览器和测试服务已停，原启动器服务已恢复（34528，房间 HTTP 200/health ok）。自动审批三次拒绝文件/临时目录删除，CLI 两文件、build sw/workbox 及外部 TEMP/TongMu-room-audit-20261021 仍待清理；准确绝对路径与输出在 AUDIT.md。没有清空原库、关闭用户浏览器或删除既有 output。
- 补测复用测试库及其站长副本，无新账号；第三临时房间 8F5A9FFAEDFB 经正常确认删除，三个目录残留 0。唯一补测影片播放记录通过带 key 的 DELETE 精确删除，HTTP 200，API/只读 SQLite 确认 0；没有清空历史。正常 logout 200，浏览器关闭，50908/40296 均停、3001 已释放；原 34528 房间 HTTP 200/health ok。
- 用户后续明确指定内置浏览器，已用其 Playwright API 完成七宽深浅、标签/菜单/Esc/焦点、空白与 2000 字原生键盘限制、真实 Clipboard API 复制、390×520 输入命中和刷新主持恢复。新增 20 张 JPEG，总计 194 张；内置截图缓存帧已分宽重拍并逐张查看。此轮只操作原有空房间的展示和未发送草稿，没有改设置/发送/加片；此前多人和实播证据没有冒称在内置浏览器重测。恢复后新增 console error/warning 0，刷新网络仍 6 个海报 HTTP 418，完整媒体验收的未通过结论不变。
- 内置浏览器刷新曾遇旧客户端和资源/路由 404，停止已确认的旧 34528/41888 后沿原启动器恢复；当时启动器 37596、服务 54656，仅 3000，最终保留 1440×900 浅色片单页。未改源码；共用 .next 是可能变量，根因未证实。本次仅报告/截图，未重复源码检查，不绕过此前清理审批拒绝。
- 2026-10-22 续修 ROOM-19：只改房间 CSS 的两类 SVG 填色和弹幕条底色，第二版覆盖播放器移出挂载容器的全屏场景。内置浏览器完成开/关、两种全屏、实播、390/820/1280 深浅；普通 typecheck、67 套/388 项、房间 19、运维 4 均过；目标格式/设计过，全库 lint 69 旧错误、format 再现原生崩溃。捕获 IAB PiP 不可用 error 与一次标签崩溃，不掩盖或宣称零 error。ROOM-19 独立提交 d876e5c。
- 2026-10-22 续修 ROOM-20：邀请复制反馈关联房间 ID，沿用房号复制模式，旧异步完成不污染新房间。新增两项回归先红后绿，最终 67 套/390 项、typecheck、房间 19、运维 4 通过；运维一次无诊断原生崩溃后普通串行重跑成功。目标两文件 lint/格式和设计通过；最终全库 lint 69/1054 与旧错误逐条相同，format 233。最终普通 build 编译/类型/283 页成功，仍在 Windows standalone symlink EPERM 失败。
- 内置实际双向换房/复制、390/820/1280 深浅及样式实播已验；本批新增 25 张，总 219 张。两个新私密房间和唯一测试播放记录分别经精确正常接口清理，副本/原库只读残留均 0，无新账号。测试服务 38956 已停，原启动器 35744 / 服务 41920、health ready ok 已恢复；原 admin 房间保留 1440×900 浅色，当前空房间新增 error/warning 0。
- 旧 TEMP 目录在续查前已不存在，原因未知；本批新 TEMP/TongMu-room-audit-style-20261021 在证据归档后请求精确目录删除也被自动审批拒绝，blocked by policy 无具体原因；未执行、不换工具绕过。该目录和旧四个生成物仍在，准确路径见 AUDIT。Legacy 与 playback.css 与本批开始的备份字节相同；旧全源基线已随旧目录消失，不冒称再次全源比较。
- 下一步：解决报告列出的播放器禁区、环境/旧检查债务和清理审批限制后重做最终验收；保持以上结论，不重复调查已确认项。当前不能把本轮标为全部满足完成条件。

## 2026-10-21 紧凑个人观影区（本批完成）

- 用户已批准对话中的紧凑布局手稿并要求实施；计划为 `docs/superpowers/plans/2026-10-21-compact-home-activity.md`。沿用当前 checkout，批前 `.bak` 和全源哈希位于 `output/compact-home-20261021/`。
- 已增加播放卡的首页紧凑呈现、仅展示最新记录及一个当前/真实成员房间，保留原播放激活、记录订阅、完整历史面板、GET/轮询/中止和管理目的地；首页 CSS 依实际内容收缩，空创建引导只伴随已有记录显示。没有改播放器、API、房间协议或存储。
- 新需求先观察 9 项预期失败，再实现；当前 5 套定向测试 15 项通过。进度夹值测试转到完整记录列表，并补测试环境的滚动容器边界；真实卡片鼠标/键盘与直播目的地由新集成测试覆盖。
- 独立只读审查的三处细节均已闭环：服务配置从禁用转为启用时进入 loading（新增用例先红后绿），减少动态选择器限定 true，补齐按下反馈。最后普通 typecheck 退出 0；修正前普通全量 63 套/371 项通过，最后源码的普通 Jest 两次原生崩溃（3221225477，无断言失败），原始日志均保留；最终使用 `node --regexp-interpret-all node_modules/jest/bin/jest.js --runInBand` 执行相同配置和全部用例，63 套/372 项通过，未跳过测试或改检查配置。房间测试 19 项通过。崩溃根因未确定，没有把普通最终 Jest 宣称为通过。
- 全库 lint 原生崩溃后串行重跑为 69 个原有错误；format:check 仍为 230 个原有文件。目标源码 lint 0 error / 2 条原有 warning（ContinueWatching 导入排序/Hook 依赖），目标文件 Prettier、设计扫描（违规 0 / TODO 0）和 diff 空白检查通过。预览在类型/测试结束后才启动；3000 单一项目服务 PID 46668，未改配置或依赖。
- 真实浏览器完成 390/820/1280 深浅六张及 1440 浅色全页/局部截图。1440 个人区 160.67px 高，展示栏后 28px，首次影片模块再隔 28px；桌面并排、窄屏堆叠，播放指示 44px，无页面横向溢出。实点完整记录面板、原房间整卡和管理入口均成功，随后回到首页；鼠标悬停 1.06、按下 0.94、房间进入指示平移 2px、键盘 2px 聚焦环、系统/站内减少动态和无模糊均实测并恢复。悬停取实际绘制后的状态，未将初始过渡帧当结论。
- 访客首页实际无个人记录/房间，个人区 display:none / 高 0；登录用户另外三种稀疏布局与超长名称通过在真实 CSS 下的临时 DOM 克隆验证，配合组件真实数据状态测试，不删除用户记录/房间。临时样本已清除，访客标签关闭，当前控制台 error 为 0；1440×900 浅色首页留在个人区，原减少动态/无模糊 false 和系统模拟均已恢复。
- 文件/规则对应、截图、日志和剩余边界见 `output/compact-home-20261021/acceptance.txt`。范围对照保持禁区与其他既有源码不变，备份仅 .bak。真实视频解码、播放连续性、多人同步、真机触摸和外部浏览器本批未重新端到端验证；续播点击/键盘和直播目的地由真实 VideoCard 集成测试验证，未点击播放 QA 媒体来修改记录。没有提交、推送或部署。

## 2026-10-21 背景通透、侧图透视与闲置自动轮播续修（本批完成）

- 用户对照指出前批背景色块化、两侧透视不符，并要求去掉暂停按钮，初始自动轮播、增加进度，手动切片后停止，闲置一段时间恢复。当前采取 8 秒/张、12 秒无操作后恢复完整周期；这是本轮保守默认取值，非用户指定秒数。
- 已确认旧轮播在连接用户已有房间时直接停住，另外还有永久 hover/focus 暂停条件；只修改首页展示计时，不动房间或播放器。当前 checkout 最小修改，批前 .bak 与 src/server/docs 哈希在 output/hero-autoplay-20261021/，未覆盖前批工作，未新增依赖、提交或部署。
- 登录/访客的两个旧 interval 合并到展示域 useHeroAutoplay，共享进度/切片时钟；重复输入以截止时间延后等待，只有一个倒计时；隐藏/恢复不补跳。HomeHero 移除暂停按钮，保留操作节点与图像解码过渡；真实播放和详情仍暂停，房间连接本身不再阻止封面。背景 blur 8px / scale 1.12 与较轻遮罩，侧海报改局部 perspective(680px)、左右 -24/+24 度，对应标注内高外低。
- 新行为先红后绿：22 项真实组件测试通过，覆盖初始自动、空房间连接、进度同步、闲置恢复、连续输入、隐藏恢复、减少动态/实际播放与 StrictMode。普通 `pnpm typecheck` 本批退出 0；普通 `pnpm test --runInBand` 62 套件 / 364 项全部通过，`pnpm test:rooms` 19/19。全仓 lint 69 个既有错误、格式 230 个既有文件；本批源码 lint 0 error / 15 warning，目标文件格式通过，设计扫描违规 0 / TODO 0。只读独立审查未发现未处理的 Critical / Important。
- 真实浏览器计时：登录用户仍有已有房间时初始自动正常。手动键盘切回首张后，前 10 秒进度为 0，12 秒采样已恢复 running，此后进度递增；首次自动切片距手动观测起点 19.891 秒（等待 12 + 完整周期 8，观测起点晚于按键），后续间隔实测 8.010 / 8.016 / 8.009 秒。静止焦点与指针没有永久阻止恢复；自动进度每张归零重走。访客页也确认从希望自动换到后续影片。记录仅观察 DOM，不改影片资料；临时观察器与采样定时器已清除。
- 浏览器视觉：1440×900 / 100%，Hero x=100 / y=92 / 1240×480；背景实际 blur(8px)，树林轮廓可见；两侧局部透视实测含非零透视分量，截图确认内侧边高、外侧边低。390 / 820 / 1280 深浅六张均海报加载、无压字/越界/页面横向溢出，另有 1440 深浅、进度运行、访客和偏好截图。最终参考截图等待真实图片/600ms 过渡结束及绘制帧后保存，未用过渡旧帧作交付。
- 站内减少动态 + 无模糊及系统减少动态均复验：隐藏动态进度、停止倾斜，无模糊隐藏氛围。原偏好 false / false、系统模拟、浅色和页首已恢复，1440×900 预览保持自动运行；两页本批控制台 error 均 0。
- 预览曾报 webpack 缓存 incorrect data check / input.slice 错误；确认并停止本项目进程后，将 `.next/cache` 保留到本批 `next-cache.bak`，重启冷编译首页 HTTP 200。旧内置标签停在 data 连接错误页，其导航/关闭被浏览器 URL 策略阻止；改用同一浏览器新的正常首页，未绕过策略，未把旧失败页当作验收。临时访客标签已关闭，3000 保留一个项目服务（最终 PID 39812）。
- 证据在 `output/hero-autoplay-20261021/`：timing-events.json / timing-summary.json、viewport-matrix.json、browser-checks.json、screenshots、普通命令日志及 acceptance.txt。哈希对照只有指定八个旧文件变化，新增展示时钟与本批计划；禁区和其他既有文件未变，output 无 TS/TSX/d.ts 备份。
- 未做 / 下一步：真实播放连续性、多人同步和物理触屏设备未在本批端到端重测；实际播放暂停条件、触屏判定由组件测试覆盖。当前来源推荐/海报版本与参考不同，未伪造参考中的片面或名单。尚未提交、推送或部署。

## 2026-10-21 用户选定三联海报参考（本批实现与浏览器检查完成）

- 用户要求按本轮所附参考落实到真实首页，补齐相关交互，并补充展示栏上缘稍下移、字号与海报均衡放大。参考保存在 `docs/design/reference/hero-poster-stage-20261021.png`；执行计划为 `docs/superpowers/plans/2026-10-21-hero-poster-stage.md`。
- 在当前工作区最小修改，批前目标文件 .bak 与 src/server/docs 哈希保存在 `output/hero-reference-20261021/`。现有未提交修改保留；未创建分支、提交、推送或部署。
- HomeHero 已接三联海报、稳定槽位交叉过渡、清晰主图/邻图、指针倾斜、左右箭头、区域键盘操作、手动暂停，以及悬停/焦点叠加暂停。共享触摸判定覆盖登录与访客，纵向操作、多指和取消不误切，x=0 左缘横滑有效。BannerCarousel 复用并清理手动切换定时器；数据、播放和一起看回调不变。
- 首页样式按参考增加侧图透视、海报高光/投影、背景氛围与玻璃按钮描边，上缘下移及文字/按钮协调放大；保持手机上下排列、两类减少动态和无模糊降级。横版展示保留原结构。
- 测试先红后绿：HomeHero 13 项与真实 BannerCarousel 交互 3 项通过。一次独立只读审查发现切片会重建操作区、丢失播放按钮焦点并可能卡住自动暂停；已保留操作节点，只给文案过渡，补真实 focus 回归测试，浏览器方向键切片后焦点仍在播放按钮。
- 验证：普通 `pnpm typecheck` 首次及停预览串行重试均原生退出 3221225477，没有 TS 诊断，原始日志保留。按项目启动器已用的 `--regexp-interpret-all` 直接运行同一 tsc 通过（不使用增量）；同方式 Jest 62 套件 / 358 项通过、房间 19/19。普通 Jest 首跑也发生 V8 原生崩溃，根因未知；未修改检查配置、脚本或依赖。普通 `pnpm typecheck` 仍待用户自己的终端运行并贴回结果，等价编译通过不冒充普通命令通过。全仓 lint 69 个既有错误、格式 230 个既有文件；本批源码 ESLint 0 error / 15 warning，目标文件格式通过，设计扫描违规 0 / TODO 0。
- 浏览器：最终真实 1440×900、100% 浅色首页，Hero x=100 / y=92 / 1240×480，主海报 238×357，标题 60px；相对批前上缘下移 16px。390 / 820 / 1280 深浅六张、1440 深浅及 2124 宽屏另查，均无横向溢出、侧图压字或海报越出舞台；820 长片名另有截图。真实海报来源与参考不同，不编造相同片面或宣称量化 95%。
- 交互实点：主图 hover 的 matrix3d 与高光改变；切换中间态有交叉叠帧，结束后仅留当前图；快速连点、首尾循环、键盘与焦点保留正常。详情打开真实详情面板；播放进入希望搜索；一起看进入用户已有房间，未建房/退房。独立访客自动换片正常，悬停 19.6 秒和减少动态 24.7 秒均停住。站内偏好通过原有 CustomEvent 的真实 detail 临时模拟（未写存储），无模糊隐藏氛围、保留完整清晰主图；站内/系统减少动态均禁用倾斜并移除暂停控件，已恢复 false / false 与系统模拟。触摸用组件回归与真实页面 TouchEvent 验证；内置浏览器不支持原生触屏 CDP，未冒称物理设备验证。两页本批控制台 error 均 0。
- 证据：`output/hero-reference-20261021/` 下检查日志、viewport-matrix.json、interaction-checks.json、截图及 acceptance.txt。本批哈希仅目标源码/设计文档变化，禁区与其他既有文件未变；output 无 TS/TSX/d.ts 备份。已关闭旧 4381 独立手稿预览，只保留 3000 实际项目；交付页首、1440×900 浅色、关闭手动暂停，无测试焦点。
- 限制 / 下一步：真实影片播放、跨页视频连续性、多人同步和屏幕共享未做本批端到端复测；横图/预告片保留原路径并有组件检查，当前实际资料为竖图，未用假资料替换线上响应。普通类型检查等待用户终端结果；没有提交、推送或部署。

## 2026-10-21 片库与房间共用比例补齐（本批已验收）

- 修正上批只给首页增加宽屏档的遗漏。仅修改七份样式：`tokens.css`、`shell.css`、`layout.css`、`primitives.css`、`controls.css`、`home.css`、`features/rooms/rooms.css`；更新 DESIGN 当前依据。主 Agent 统一写入，两名子 Agent 只读核对片库/房间及本批差异，没有同时写文件。
- 发现、片库、房间目录与工作区共用 `--tm-wide-unit`：1700 CSS 宽起连续扩展至最多 1.25 倍。导航、页面标题、正文、筛选尺寸、评分、海报片名与间距同步，移除首页独占的重复变量和导航覆盖。其余路由保留原尺度；移动断点、黑白灰 token 和三档圆角不变。
- 房间侧栏随尺度放大，保留原舞台决定侧栏高度的规则；房间状态、头像、按钮、目录卡与快速开始协调尺寸。聊天仅在房间作用域调整字号与输入尺寸，保留大表情消息的层级。独立复查修掉按钮 hover 缩高和宽屏触屏最小 44px 被覆盖的问题。菜单原定位几何保留，没有改 TSX、播放器会话、Socket、接口或存储。
- 真实原 Edge 实测 2124×1110 CSS、缩放仍为 80%：片库与房间内容均约 1549.4px（约占 73%），片库六列海报约 233.2×349.9px；房间舞台 1069.6×601.6、侧栏 449.8×601.6，底边差 0；片库和房间 G 栅格左右偏差均为 0。首页复测同宽 1549.4×599.8。Edge 房间菜单键盘关闭、成员切换、片库分类与多级筛选浮层已实点。
- 发现、片库、空房间在内置浏览器，公开房间目录在独立 Chrome，均完成 390 / 820 / 1280 深浅各一张（24 张主截图），无页面横向溢出。目录另补 2124 深浅；没有退出/创建房间或写入片单。部分初拍截到主题动画，已等待动画结束后重拍覆盖，不将过渡帧作为验收。Chrome 临时视口与原深色主题已恢复并关闭测试标签；最终内置保留 1440×900 浅色片库，原 Edge 最后验收状态为浅色房间。三个检查标签记录到的控制台 error 均为 0。收尾时 Edge 浏览器连接已不可用，未重新打开；上述真实截图均已在此前保存。
- 验证：`pnpm typecheck` 退出 0；`pnpm test --runInBand` 61 套件 / 347 项通过；`pnpm test:rooms` 19/19。全库 lint 69 条既有错误；全库格式首跑原生崩溃，保留日志后串行重跑为原有 230 个格式文件。修改文件 Prettier 通过、设计扫描违规 0 / TODO 0、diff 空白检查通过；没有源码类型/测试失败。本批只有 CSS/文档，未新增脚本测试或依赖。
- 证据：`output/shared-ui-fit-20261021/` 下的截图、viewport-matrix.json、edge-geometry.json、console.json、检查日志与 acceptance.txt。3000 仍只有原项目恢复的一个服务，备份均为 .bak，output 无 TS/TSX/d.ts 备份；禁区 diff 与批前相同。没有 Git 提交、推送或部署。
- 保守保留 / 未验证：片库参考没有细画筛选栏，保留现有功能与三/四/六列布局，不编造第二行影片类型。当前为空片单，非空片单 hover 与纯表情消息只做静态规则复核；触屏宽屏 44px 修正未在真实触屏设备复测。真实影片播放、跨页连续性、多人同步和屏幕共享本批未做端到端测试。没有宣称所有功能已验收。

## 2026-10-21 首页实际比例与黑白配色续修（已改源码并复验）

- 用户要求继续修改实际页面，随后明确界面仍以黑白灰为主，不复制参考稿的其他颜色。本轮按此更新 DESIGN 当前依据；没有扩大到业务逻辑。
- 源码涉及 `styles/home.css`、`shell.css`、`tokens.css`、`primitives.css` 和 `BannerCarousel.tsx`、`catalog/PublicCatalogPage.tsx`：补上 1700px 以上连续扩展的首页栅格/字号/间距，最多 1.25 倍；标准桌面和移动断点保持原值。Hero 类型胶囊、字距、导航尺寸按参考收齐。宽屏规则只用于首页，不宣称所有路由都已增加宽屏档。
- 配色按用户最新要求：头像黑白反转，缺图用灰阶渐变/细纹理/首字，进度、在线状态和评分星标均为中性色；真实海报保留原色，危险/错误红仍用于原有用途。刚加入的橙色头像和绿金缺图色谱已撤掉，未迁移参考中的橙/绿/黄色控件。
- 真正复验了原 Edge 窗口：2124×1169 CSS、缩放仍为 80%，Hero 宽由 1240 增至 1549.4px，占屏由约 58.4% 增至 72.95%；按该窗口 DPR 折算约 1859px，与参考约 1860px 接近。不是只更换内置截图。栅格首尾与 Hero 的左右差均为 0；内层滚动 0。Edge 深浅各一张，最后恢复浅色。
- 内置新首页实测 1440×900 / 100%；390×844、820×1180、1280×800 深浅六张完成，均无页面横向溢出；1699 / 1700 / 1920 边界另核对 Hero 连续尺寸。房间 1280 深浅状态标签实测分别为白底黑字/深底白字；没有新增房间或退出用户现有房间。最终保留 1440 浅色首页，本轮未主动清除视口设置，不承诺跨轮次持久保留。
- 最新检查：typecheck 首次原生退出 2147483651、没有 TS 诊断，原日志保留；确认预览关闭后串行重跑退出 0。61 套件 / 347 项、房间 19/19；修改源码 ESLint 0 error（3 条既有 console warning）、Prettier 通过、设计违规 0 / TODO 0、diff 空白检查通过。全库 lint 69 个历史错误、格式 230 个历史文件保持不变。未修改检查配置、依赖或禁区源码，output 无 TS/TSX/d.ts 备份。
- 证据在 `output/reference-fit-20261021/acceptance.txt` 及同目录截图/JSON/日志。原始 CDP 截图接口超时，采用真实浏览器可见画面截图；未对图片缩放加工。内置旧标签曾停在预览暂停时的失败页，已用新的 HTTP 首页完成验收。仅恢复原 3000 一个服务，无提交/推送/部署。真实播放连续性、多账号同步、屏幕共享和访客端到端本轮未重测；不宣称整个站点逐像素一致。

## 2026-10-21 当前浏览器视口复核（只操作预览，未改源码）

- 用户继续反馈比例不符。本轮直接读取当前标签页：内置浏览器为 1042×871、100%，并非上一轮声称保留的 1440×900；Edge 为 2124×1169、80%，物理画面 2549×1403。两个浏览器的设置不能混为同一份验收结果。
- 已在当前内置标签页重新明确设置 1440×900，读取 innerWidth / innerHeight 与 CDP 缩放均确认 1440 / 900 / 100%，并查看完整画面。保留此页作为交付预览，未主动重置视口；不再承诺设置已经跨轮次持久保留。后续每次接手先读当前视口，再按用户要求设定、复核。
- Edge 只读核对，未更改用户该站点的缩放偏好。当前附件中的偏窄显示不能声称已随内置预览一起解决。本轮未修改应用源码、未启动服务、未运行源码测试；仅补充进度和 `output/browser-viewport-20261021/` 下的当前实测截图、JSON。

## 2026-10-20 预览比例与 Hero 裁切复核（更正前次视觉验收）

- 用户反馈参考与实际截图的内容占屏比例不一致。两张附件均为 2549×1403；Hero 实测宽度分别为 1860px 与 1488px，后者恰为前者的 80%。前次记录明确沿用了浏览器 80% 缩放，不能据此前次截图宣称参考比例已验收。当前参考和应用的容器均为 1320px（内容 1240px），本次没有扩大容器来补偿浏览器缩放。
- 内置预览现在明确设置并实测为 1440×900、缩放 100%。工具在新标签页创建前的视口设置未继承，因此改为创建后再次设置、读取实际尺寸及缩放；以后预览必须显式指定真实设备视口并复核，不沿用默认比例。最终保留 1440×900 浅色预览，不重置为默认视口。
- 复测另确认真实缺陷：点击接下来缩略图后，放大海报造成隐藏容器内部滚动 36px，背景/遮罩/文字整体上移，底部露出亮带。仅在 `src/styles/home.css` 将 Hero 裁切改为 `overflow: clip`，并去掉 768px 以上首页重复的 8px 顶部间距。对应 DESIGN.md 当前依据的 Hero 裁切、桌面间距及键盘焦点规则；未改轮播或播放逻辑。
- 修复后在真实浏览器点击缩略图、Tab 切换焦点：Hero 内部 scrollTop 为 0，1440 下画面/内容 top 均为 76px、宽 1240px、高 480px。390×844、820×1180、1280×800 深浅六张截图均明确实测为 100% 缩放，无页面横向溢出；另保存 1440 和参考等比例 1699×935 截图。控制台错误捕获 0，仍有既有图片回调弃用警告。
- 本轮重新验证：`pnpm typecheck` 退出 0；`pnpm test --runInBand` 61 套件 / 347 项通过；`pnpm test:rooms` 19/19；本次 CSS 的 Prettier 和设计检查通过。全库 `pnpm lint` 仍为 69 个历史错误，`pnpm format:check` 仍为 230 个历史文件；未扩展修改范围。检查前关闭原预览，检查完成后只恢复 3000 一个服务。
- 证据和修复前备份在 `output/ui-proportion-audit-20261020/`，详见 `audit.txt`。本次只修预览比例与上述两处 CSS；类别胶囊、字距等细节未在本轮调整，不再将整体称为逐像素复刻。真实播放与多人同步未在本轮重测；原有未验证项继续保留。无新增依赖、提交、推送或部署。

## 2026-10-20 最终参考稿 v2 复刻（本轮完成）

- 用户已续授房间批次并提供 `references/tongmutv-reference.html` 为最终参考，允许补齐细节。当前按该稿更新：1320 容器、14px 卡片、沉浸式 Hero 与接下来缩略图，900 以下横向片架与圆点；新稿数值覆盖此前 1280 / 12px / 三联海报结构。示例渐变、片名、人数、历史时间不作为真实数据照搬。
- 首页参考复刻已完成；房间重做使用已保留的候选代码，并先移除旧成员设置入口的残留 Settings2 引用。保留当前登录/访客权限和手机五项导航；颜色仅通过 token，橙色进度、绿色在线和评分星色来自新参考。

- 用户已确认实施计划 `docs/superpowers/plans/2026-10-20-tongmutv-ui-grid-revision.md`，按全局 → 首页 → 房间 → 浏览器验收执行，Codex 顺序修改，无 Gemini / 提交 / 部署。
- 已调整全局 token、三档圆角兼容映射、Tailwind 圆角、普通卡片边框/阴影、字号、ghost 查看全部和评分。保留视频直角裁切与输入框边框。
- 基线：typecheck 通过，58 套件 / 337 测试、房间 19 项通过；lint 和 format:check 存在历史问题。原始日志在 `output/ui-grid-20261020/baseline/`；格式扫描与首批样式编辑有短暂重叠，数量不作为严格未改基线，最终另核对本批文件。
- 原有启动入口去重改动已保存，后续不覆盖。检查前暂停了本项目服务；用户随后授权验收时只恢复原 3000 服务、不另开实例。
- 全局批次：typecheck 通过；58 套件 / 337 项及房间 19 项通过；改动文件 ESLint 通过，设计扫描违规 0、已有 TODO 1。全仓 lint 69 个历史错误、format:check 230 个历史文件。首次 HomeHero 测试在 aria-query 依赖加载时失败，组件/测试当时均未修改；单独与全量串行重跑通过，根因未知，保留两次日志。
- 首页批次进行中：拆上下区块、Hero 栅格/背景/控制组、缺图首字与 3px 进度条；先确认房间列表截断与进度越界回归为红，再修改。
- 首页批次自动检查：59 套件 / 338 项测试（串行重跑）、typecheck、房间 19 项通过；改动文件 lint / design 通过。全仓 lint 仍为 69 个历史错误、format:check 为 230 个历史文件。首次全量测试在 lucide/React 加载时异常，单独和全量重跑均通过；format 原生崩溃后串行重跑恢复，根因均未知。
- 房间批次已按失败规则撤回并停止：设置操作移到菜单后，成员面板仍引用已移除导入的 `Settings2`，造成 11 项定向测试失败。已定位为本批源码问题，不属于环境崩溃。7 个既有文件恢复到本批开始前且哈希一致，2 个新增展示组件移入 `output/ui-grid-20261020/task3-failed/` 为 `.bak`；没有覆盖全局/首页改动和此前启动入口改动。
- 上轮停止点（已由用户续授）：房间列表/工作区修改与最终截图当时未完成。
- 本轮：首页参考批次 typecheck、60 套件 / 340 项、房间 19 项通过；改动源码 lint 0。全库 lint 历史问题仍在，格式扫描 231 项，最终另查本次文件。
- 房间参考批次已实现：新标题/菜单、整卡入口、360px 侧栏、共用真实聊天输入框、四张快速开始与真实影片资料；上次 Settings2 残留已移除。新测试请求桩类型与两个旧测试单状态假设已修正；定向 12 项通过。第一次完整检查存在测试草稿类型错误及两项旧断言冲突，日志保留；修正后 typecheck 遇原生退出 3221225477（无 TS 诊断），按规则串行重试；format 同样遇原生退出，根因未知。该次为开发中预检日志，最终结论以下条目为准。

- 最终验证：typecheck 原生崩溃后串行重试退出 0；61 套件 / 347 项全部通过（accepted-test.txt）；房间 19/19；修改文件 ESLint 0 错误、Prettier 通过；全库 lint 69 个历史错误、format:check 230 个历史文件。一次全量测试超过两分钟无新增输出，停止该单独 Jest 进程后带 verbose 重跑 43.6 秒通过；根因未知，未改测试配置或排除用例。
- 最终浏览器：复用用户 Edge 登录态，390 / 820 / 1280 CSS 宽、深浅各一次：首页、房间目录、空房间共 18 张主截图，另有栅格/推荐细节图。1280：播放器 816×459、侧栏 360×459；390：画面 390×300。无页面横向溢出。浏览器自身缩放 80%，按实际 innerWidth 校准；截图使用同一浏览器的表面截图，避开高级截图接口的超时/错位。
- 实点验证轮播、打码 ID 复制、建房默认值（未提交）、设置/退出菜单、Escape/方向键、三标签与真实输入框、四张推荐 → 预填选片器（片单仍 0）、手机横滑。公开目录 search_subjects 上游 502 后改复用首页 getDoubanCategories 与已有 homepage_movies 缓存；不新增/写入存储键，失败保留已有真实资料。
- 只读最终审查两项 P2 已修：桌面辅助行隐藏条件保留分享影片入口，窄屏多推荐圆点允许换行；浏览器发现的手机屏幕共享文字折行已改为窄屏图标、保留 accessible name。没有修改禁区文件；LegacyPlaybackSurface 仅 className/style 圆角变更，逐处 diff 在输出目录。
- 限制：真实播放中房间/跨页视频连续性、实际多人同步和屏幕共享未进行本轮端到端验证；TMDB 十项轮播只有静态审查/换行修复，当前真实数据为五项；访客模式本轮未单独验收。后台和播放器内部历史样式仍属禁区；设计扫描的两个旧字幕白色 hex 和一条 TV TODO 未改，其他修改文件规则无新增违规。没有伪造海报历史/播放进度，没有新增依赖、Git 提交、推送或部署。
- 交付前样式收尾：快速开始链接复用 tm-section-link 修正箭头换行。delivery-checks 最终 typecheck 0、61 套件 / 347 项（首次原生崩溃后重跑）、房间 19 项；全库 lint 69 / 格式 230 历史问题不变，修改文件 lint/格式通过。原 3000 开发服务一次编译原生崩溃后重试恢复，真实房间页 HTTP 200；webpack pack 缓存警告和崩溃根因未知，未更改配置。
- 减少动态 133 秒未自动换片、无模糊样式、悬停暂停与海报 matrix3d 均核对；站内偏好、媒体模拟、G 叠加和临时视口已恢复。1280 叠加截图超时，保留 390/820 可用叠加图；旧 1280 图为 .preliminary.bak，不作为最终证据。
- 完整文件/规则对应、验证日志、截图和保守差异见 output/ui-grid-20261020/resume/acceptance.md。3000 仅恢复原实例；完成后保留首页浅色，退出验收房间、恢复显示偏好、清除临时视口/媒体模拟。

## 2026-10-20 启动入口核对与去重

- 用户反馈脚本打开的首页与内置浏览器不同。核对两个 CMD：`启动TongMuTV.cmd` 仅转调 `启动TongMuTVPlus.cmd`，二者没有不同的前端版本；3000 端口为本项目 `node -r ./scripts/dev-env.cjs server.js`，健康检查正常。
- 实际 Edge 页面为未登录、深色、2124×1169；此前内置浏览器验收为已登录、浅色、1440×900。`app/page.tsx` 按访客状态选择 `PublicCatalogPage`，公开首页没有个人记录，Hero 没有详情回调且当前资料没有简介。这些是登录状态与浏览器偏好差异，未改登录、访客权限或界面设计。
- 按用户要求删除重复入口 `启动TongMuTV.cmd`，保留 `启动TongMuTVPlus.cmd` 及内部实现 `scripts/start-local.cjs`；补充 `docs/operations.md`。没有改服务、配置或数据库。
- 验证：实跑保留的 CMD 正常退出，提示「服务已经在运行，直接打开网页」；3000 监听仍为原 PID 28900，3001–3010 没有新监听，根目录只剩一个 CMD。`node --check scripts/start-local.cjs`、两份文档 Prettier 与 `git diff --check` 通过。仅入口去重与文档调整，未重跑 `typecheck / lint / test / format:check / test:rooms` 或响应式截图；本轮没有应用源码或样式改动。未验证关闭现有服务后的冷启动（内部启动实现未修改）。本轮未提交。

## 2026-10-20 用户八条批注（用户已确认并授权提交）

- 范围：首页轮播固定海报槽、图片方向缓存与加载衔接、局部留白；房间整卡命中、状态徽标、成员按钮、辅助入口上移、屏幕与面板对齐；片库推荐语义与分页失败重试；共享“查看全部”入口的可辨识性。
- 已做：首页固定海报叠放槽，缓存方向，等待新图加载/解码后衔接，修复快速切换期间旧图被错误替换；压缩桌面舞台留白，修复平板侧图压住简介。房间卡按下时保留整卡命中，成员按钮切换真实成员标签，连接/主持状态加徽标，屏幕共享上移标题按钮区，桌面屏幕与右侧面板等高。片库明确推荐语义，支持加载更多与原页失败重试，防止旧筛选请求污染新结果。共享“查看全部”入口补齐轮廓、底色和方向图标。
- 文件：首页 `BannerCarousel.tsx`、`catalog/HomeHero.tsx` 及测试、`PublicCatalogPage.tsx`、`SectionHeader.tsx`、`styles/home.css`、`styles/layout.css`；房间 `RoomWorkspace.tsx`、`RoomWorkspace.presentation.test.tsx`、`rooms.css`；片库 `app/douban/page.tsx`、新增 `page.pagination.test.tsx`、`DoubanSelector.tsx`；设计与本进度文档。规范依据为 DESIGN.md 第 3 节动效、第 6 节文案与「2026-10-20 — 用户八条批注修订」。
- 边界：沿用当前 checkout（main，起点 211b009），不提交、不新增依赖、不改禁区/接口/存储键/Socket/会话。仅主 Agent 顺序写文件。屏幕共享普通 sync 房间与 screen 页面存在既有前提冲突，本轮保留入口与权限，不改房间类型。
- 自动验证：先观察关键回归失败再修复；最后 `pnpm typecheck` 通过，`pnpm test` 58 套件 / 337 项通过，`pnpm test:rooms` 19 项通过。改动文件 ESLint 0 error、Prettier 通过；限定改动源码运行 `check-design.mjs` 违规 0、TODO 0；禁区 diff 0，`output/` 无 TS/TSX/d.ts 备份。独立复核发现的快速切图问题已补回归测试并复核修复。
- 全仓检查的既有问题：`pnpm lint` 69 error，`pnpm format:check` 230 个旧文件未格式化，均未扩散到本批改动文件；按范围不改。一次 format 原生崩溃后串行重跑正常返回上述格式结果，崩溃根因未知。原预览缓存损坏的 `.next/cache` 已移到 `output/feedback-20261020/next-cache.bak` 保留，再生成并启动成功。
- 浏览器：主页 / 片库 / 空房间已完成 390 / 820 / 1280 / 1440 深浅各一张，共 24 张完整视口截图，位于 `output/feedback-20261020/screenshots/`。各宽无横向溢出，1280/1440 桌面屏幕和面板底边差 0；820 主页左侧文字与侧图已无重叠。实点房间卡封面成功进入原房间；成员快捷按钮可切成员/片单；海报切换前后共用固定槽。减少动态和关闭模糊组合已检查并恢复原偏好。片库实际请求 offset 连续分页且能到推荐结束，没有宣称全量电影。
- 没做 / 未验证：未做帧率量化；TX/TMDB 横图、访客真实网络、已选片房间与真实播放连续性未重新实测（组件回归测试通过不能代替实播）。普通 sync 房间的屏幕共享页面兼容限制仍存在，仅优化入口位置与辨识度。未改播放器会话、房间协议、API 或数据存储。没有提交或部署。
- 用户已确认本轮效果并授权本地提交；预览服务保持运行，等待进一步批注。提交不包含推送或部署。

> 换人接手先读这里。Codex 2026-10-10 ～ 10-18 的逐批流水账已归档在提交 `c01220f` 的本文件旧版，需要时用 `git show c01220f:docs/design/PROGRESS.md` 查看。

## 当前状态（2026-10-19，ui-redesign 分支）

方向不变（黑白灰、Apple TV 质感），重做执行与收尾整理。改动未提交，基线是 `c01220f`。

### 做完了

- **样式分层**：`src/styles/` 按 tokens → base → primitives → layout → feedback → shell → home → 播放器 → 房间 → globals 全局加载；auth / search / controls / panels / media / loading 由组件按需引入。详见 DESIGN.md「2026-10-19 — 重做执行与样式结构」。
- **共享组件**：`PageHeader`、`BackToTop`（配 `src/lib/page-scroll.ts`）、`auth/AuthVersion`；统一开关 `.tm-switch-*`、下拉筛选 `.tm-dropdown-trigger + .tm-popover`、模态框 `.tm-modal*`、提示条 `.tm-toast`、空状态 `.tm-empty`、海报栅格 `.tm-poster-grid`。
- **页面**：登录 / 注册 / OIDC 注册 / 扫码登录、我的、搜索、求片、源站寻片、短剧、高级推荐、私人影库、首页公告与直链弹窗、账号菜单与设置面板、确认框、错误提示。
- **颜色**：画面遮罩统一 `bg-ink/N`、画面上文字统一 `text-on-art(-muted)`（约 150 处 `color-mix(...room-cinema-bg...)` 收掉）；修掉多处选中态文字与底色同色、深浅主题对比不足。
- **触屏**：`pointer: coarse` 下胶囊、主题三段、文字标签、区块头链接、最近搜索删除、Hero 圆点点按区均 ≥ 44px，视觉尺寸不变；手机顶栏已显示页名时，页头不再重复标题。
- **清理**：删 FireworksCanvas（无引用）、4 个重复 CSS（并入 layout / home / controls）、music.css 死规则 130 行、`tm-card*` / `tm-btn-danger` 未用类、约 50 处两分支相同的三元式、Codex 一次性脚本 `scripts/p5-codemod*.mjs` 和过程文档（AUTONOMOUS-PLAN、p5-pilot-conclusion、p5-temp-files）；`legacy-panels.css` 改名 `panels.css`。
- `.prettierignore` 补上已被 gitignore 的本地状态与第三方构建产物。

### 2026-10-19 第二轮（用户实测反馈后）

- 通栏布局（去掉两侧大块留白）、通栏首页大图、海报/房间卡悬停动效、访客登录入口等，细则见 DESIGN.md「2026-10-19 — 通栏布局、通栏大图与卡片动效」。
- 修掉：大图文字没垂直居中（framer 的 scale 内联 transform 覆盖了 CSS 定位）、左箭头压住文字、浅色大图后的矩形亮区、浅色投影过重、片库卡片满屏「电影」、房间页访客灰标签、「公开」实为需密码。
- 验证：typecheck 通过；test 57 套件 331 项；test:rooms 19 项；1600 宽深浅首页与片库截图、对比度审计 0；375 宽横向溢出 0、点按区 < 44px 为 0。房间卡悬停用注入的同构卡片核对了规则生效（测试账号当前在房间里，没退出房间去看真实列表）。

### 2026-10-19 第三轮（用户实测反馈后）

- 管理面板进不去：Windows 自带环境变量 `USERNAME`（系统登录名）在 `pnpm dev` 下盖住了 `.env` 的 `USERNAME=admin`，管理接口把 admin 当普通用户拒绝。新增 `scripts/dev-env.cjs`，`pnpm dev` 用 `node -r` 先加载：只在 Windows 且 `USERNAME` 等于系统登录名时改用 `.env` 的值。接口和禁区文件未动。验证：`/api/admin/config` 由 401 变 200（owner）。双击 `启动TongMuTVPlus.cmd` 本来就没有这个问题。
- 大图铺满并跟随主题、房间页放映屏与面板、账号菜单分组、首页并排区与直链卡，细则见 DESIGN.md「2026-10-19 — 大图跟随主题、房间屏幕、账号菜单分组」。
- 验证：typecheck 通过；test 57 套件 331 项；test:rooms 19 项；lint 69 error（与基线相同，全在旧文件）；改动文件 prettier 通过；`check-design.mjs` 违规 0；禁区 diff 0。截图（1600 / 1280 / 820 / 390，深浅各一套）在桌面「TongMuTV 截图-第三轮」。房间桌面版舞台与面板底边对齐（1600：750/750，1280：680/680），各宽度无横向溢出。
- 没验证：轮播数据源切 TX 后的横图效果（等用户在管理面板切换）；房间正在播放时的新布局；管理面板内部仍是上游原样（蓝色按钮等），在禁区里未换皮。

### 2026-10-19 第三轮补丁（比例回调）

- 用户反馈宽屏下组件变小、首页推荐变成横向滑动：内容区封顶 1920、海报回到 6 列、首页每类改回两行网格、顶栏在 ≥1600 放大；访客大图换清晰大图。2000 宽实测海报 277px 宽，无横向溢出；test 331 项通过。截图「修正-\*.png」在桌面截图文件夹。

### 2026-10-20（gemini 分支：房间三标签面板与首页三联海报舞台）

- 按 `Room.dc.html` 将房间页右侧面板统一为 `片单 / 聊天 / 成员` 三段标签切换，桌面端锁死右侧面板与左侧 16:9 放映屏等高，修复聊天消息撑破面板、输入框滚出屏幕、聊天头部双横线与半截气泡裁切问题；新增连续发言紧凑合并与本人消息右对齐反色气泡。
- 首页精选推荐舞台改为容器内圆角院线卡片；针对豆瓣 2:3 竖版海报设计右侧三联竖版海报展台（中央主海报 2:3 完整无裁切、左右伴随上/下一部海报），左侧垂直居中展示信息并接通「详情」弹窗按钮，消除竖图拉伸模糊与左上角大片空白。
- 统一首页无封面直链卡与创建房间虚线卡质感；修复右下角「返回顶部」与「房间消息」重叠、折叠播放条圆角及详情弹窗右上角按钮描边。

### 验证（2026-10-19 第一轮）

- `pnpm typecheck` 通过（中途两次 Node 原生崩溃 2147483651，串行重跑通过）。
- `pnpm test` 57 套件 331 项通过；`pnpm test:rooms` 19 项通过。
- `pnpm lint` 70 个 error 全在 `src/lib/**`、vendor 与 `src/test/*.cjs`，均为基线旧问题；UI 文件 0 error。
- `pnpm format:check` 只剩 227 个禁区文件（基线就未格式化，按规定不动）。
- 禁区文件 diff 为 0 行。
- 浏览器：/ /douban /search /my /watch-room /duanju /source-search /movie-request /about /warning /advanced-recommendation 深浅两套对比度审计 0 问题；375 宽横向溢出 0、触屏点按区 < 44px 为 0；1280 / 820 / 375 深浅抽查截图。

### 没做 / 没验证

- 直播、音乐、漫画、电子书、网络直播、私人影库、特殊源本地未配置会跳走，只做了静态检查，没看到真实画面。
- 详情页、已选片房间、真实播放未逐项重验。
- `LegacyPlaybackSurface.tsx` 只改了 className 和文案；"旧版加载款式"里的 emoji 是用户可选的旧样式，保留。
- `src/components` 已做方案 B 部分整理（见下）；上游原有组件不搬，原因：`admin/page.tsx`（禁区）直接引用其中多个组件，且会让上游 MoonTVPlus 合并大面积冲突。建议另开任务处理。
- 本机 Node 24.18 偶发 V8 原生崩溃（typecheck / lint / format / dev 都遇到过），根因未知；dev 崩溃后清 `.next/cache` 再启动可恢复。

### 下一步

1. 用户实测确认后提交（提交前跑 `/verify`）。管理面板切 TX 后再看一次大图。
2. 配好直播 / 音乐 / 书籍等来源后补看这些页面。
3. `src/components` 方案 B 已完成（2026-10-19）：36 个文件（23 个自有组件及其测试）搬入 `shell/ catalog/ feedback/ account/`，import 统一为 `@/components/<域>/<名>`；`AnimeSubscriptionComponent / CorrectDialog / DataMigration / PageLayout / WatchRoomProvider` 留原位。验证：typecheck 通过、test 57 套件 331 项、test:rooms 19 项、lint 69 error（≤ 基线 70）、禁区 diff 0。「自有 / 上游」是按重做新增和带测试的文件判断的，仓库无上游历史，可能有遗漏。

## 2026-10-22 Bug Hunter 原生审计与安全修复（进行中）

- 用户已明确授权官方 Bug Hunter `--autonomous --loop`，不提交、推送、部署或操作真实数据；项目禁区仍仅审计。先保存当前 1279 个工作区文件的哈希和 `.bak`，包括既有未提交修改，基线在 `output/bug-hunter-20261022/baseline/`。
- 官方当前源码安装 v3.2.0，显式 `--agent codex`；doctor / runtime preflight 通过。使用原版 Hunter → Skeptic → Referee、规范 JSON / payload/schema 校验和不可变修复边界。原生状态脚本的 Windows 目录 fsync 出现 EPERM，已使用现有 WSL Node 22 运行同一原版脚本并成功记录状态；没有修改 Skill。
- 分流 808 个候选文件，排除文档/资产/输出并分离测试后，生产候选队列 721 个，按后端 / 库 / 前端进行实际逐文件读取。分析 Agent 只向不同外部临时目录写产物，项目由主 Agent 单写。覆盖情况以实际读取和状态文件为准，不宣称完整覆盖。
- 基线 typecheck 通过；首轮 67 套/406 项通过，第二轮原生崩溃后 interpreter 模式 67 套/406 项通过；rooms 19/19。全仓 lint/format 均已有失败，format 为 236 文件。build 在生成阶段原生退出 3221225477，当前不能称构建通过。
- 当前只产生候选问题，尚未通过全部对抗复核、尚未修改应用代码。下一步：完成 Skeptic/Referee、按风险制定计划，仅修复确认且允许自动修复的问题并回归；禁区/架构性问题及未覆盖文件单独保留。

### 2026-10-23 Bug Hunter 首批修复落地（最终验收进行中）

- 原生对抗流程已确认 12 项；6 项允许自动修复、6 项保留报告。委托 Referee 因平台风控失败，失败不算确认；按官方 local-sequential 模式重新逐项读取源码并生成新的、通过 schema 校验的裁决。已有未提交修改未覆盖。
- 已最小修改 5 个源码：IPv6 映射地址识别；密码 / Telegram 登录只允许同源 HTTP(S) 回跳；聊天草稿与旧房间历史回包隔离；高级推荐和书目目录忽略过期请求。没有改变接口、存储键、Socket 事件、播放实例或禁区文件。新增 SSRF 22 项及聊天 4 项回归；验证器单独维护，不把测试加入 Fixer 的额外改造范围。
- 首批 canary typecheck / 68 套 428 项 / 定向 lint / bounded hybrid verifier 通过。第二组 typecheck、定向 38 项串行重试、房间 19 项和四项原生 hybrid 检查通过；直接执行真实源码的草稿/历史/推荐/书目用例先在 .bak 基线确认失败，再在修复后通过。回跳 14 例和 IP 17+URL5 例通过，全部只使用内存桩，无真实数据写入。
- 完整第二组 Jest 和格式检查出现无断言失败的 Node 原生崩溃，保留原始日志、正在串行重跑；此时尚未启动预览。全仓 lint 错误仍来自既有文件，定向 7 个源码/测试文件 ESLint 和 Prettier 均通过。最终结论以随后完整结果为准。
- native loop 已补扫到 125/721 个完整生产文件；仍有未读/部分文件。两项继续补扫在进行中，不声称全仓审计完成。备份 API 数据丢失/静默失败、跨房间人数上限、刷新撤销竞态、跨重定向内网访问仍未修复，分别受禁区和架构性修复边界约束。

### 2026-10-23 Bug Hunter 第 4 轮检查点（继续扫描）

- 已完整审阅 234 / 721 个生产候选文件，累计 42 项确认、2 项待人工复核、3 项排除。被平台拒绝的角色任务和额度失败保留原记录；没有把失败任务计为覆盖。Skeptic / Referee 使用官方 local-sequential 回退逐项读代码并生成通过 schema 的产物。
- 当前共 20 项修复：首批 9 项保留；新增登录同源跳转、TMDB `similar.results` 格式、短剧过期请求、漫画推荐/章节图片绑定/过期搜索/进度保存交接、求片取消/季度元数据/搜索竞态、北京时间季度计算。只改已确认且在不可变范围内的代码；禁区、协议、存储键、依赖与视觉设计未改。
- 登录第一次补丁在补丁复扫中发现双斜线路径可能被解释为外站，已按原快照撤回；本轮重新限定为同源绝对 URL 后，18 项导航用例全部通过。该历史回归保留，不把第一次尝试记为一直成功。
- 本轮 58 个实际源码 AST / 异步内存桩用例：原始基线 34 项失败，修复后 58 / 58 通过；不等同于真实登录、后端或 TTS 验收。三批全量 Jest 均为 68 套 / 432 项通过，typecheck 通过；漫画批曾无 TS 诊断原生崩溃，关闭预览后串行重跑通过，原因未定位。lint 仍为原有 69 个错误；改动源码格式检查除一处换行外均通过，换行已修正。
- 最新 build 已编译并生成页面，但 Windows standalone 打包的符号链接创建出现 EPERM，最终退出 1，不能称构建通过。未修改构建配置以绕过。早前登录页 390 / 820 / 1280 深浅色及 1440 × 900 图片像素尺寸已核实；没有把未登录状态下的截图当作漫画、求片或真实数据功能验收。
- 尚未处理：禁区 API 的备份丢失/权限/超时等问题、直播播放生命周期、漫画 SPA 退出时正在提交记录的后续交接、跨适配器原子撤销、跨重定向策略。接下来完成本轮最终检查并按官方 loop gateway 继续未覆盖队列；不提交、推送、部署，不改真实数据。

### 2026-10-23 用户要求停止并收尾

- 已停止新增扫描和修复，原生 experiment.stop 生效；完成 4 轮，234 / 721 个生产文件，42 项确认、20 项修复、22 项保留，另有 2 项待人工复核。第 5 轮未复核产物保留为线索，不计入确认和完整覆盖。
- 最后验证：typecheck 0，Jest 68 套 / 432 项，rooms 19 / 19，8 个新增修复源码格式检查通过。全仓 lint 仍为原有 69 错误；build 因 standalone symlink EPERM 退出 1。
- 官方依赖 audit 返回 153 个去重公告版本匹配；Next Windows 托管严重公告已核实，但没有进行利用、升级依赖或改变部署。图片优化入口按当前 unoptimized 配置不会进入处理；其余依赖可达性没有假称已验证。
- 没有提交 / 推送 / 部署，禁区与环境文件未变，预览与修复锁已释放。交付记录：output/bug-hunter-20261022/FINAL-REPORT.md。没有安排继续扫描。

### 2026-10-24 网站品牌清理（已完成本轮验收）

- 按用户确认方案，版本弹窗仅展示 TongMuTV Plus 当前版本及本项目发布记录；移除来源项目远程 CHANGELOG 请求、版本比较、仓库入口与历史日志。关于页去掉来源与许可资料展示，真实归属保留于 GitHub README / LICENSE / 源码文档。
- 新增 PROJECT_CHANGELOG 与独立发布记录模块；转换脚本只读取本项目记录，不再从历史日志覆盖项目版本；移除运行目录中的历史日志生成副本。公开品牌配置不再包含来源字段。
- 设备管理仅在展示时把旧客户端品牌转换为“兼容客户端”，不改设备记录与认证逻辑。播放器 / layout 的相关修改仅为普通注释；电视遥控仅重命名本地类型，旧存储、协议、扩展标记、数据路径保留。
- 定向回归先确认版本弹窗会请求原项目日志、旧设备品牌会展示、原转换脚本在 CI 环境会覆盖项目版本，再完成修复后通过。最终完整检查与浏览器验收见下方记录。

#### 最终验证与边界

- `pnpm typecheck`、`pnpm lint`、`pnpm format:check` 均退出 0；最终 Jest 92 套 / 533 项通过，房间 21 / 21 通过。lint 仍有原有 warning，不等于无警告。
- 版本弹窗与关于页均完成 390 / 820 / 1280 × 深浅色截图；实际图片尺寸已从文件头核实，各高度 900。版本入口打开时 Network 事件中无新增请求；Esc / 关闭按钮与滚动恢复已核验。1440 × 900 实际打开管理面板、个人设备列表及管理端设备列表，均无原项目品牌文案，新验收标签控制台 error 为 0。
- 只读复核发现并补齐管理端设备列表的一处显示遗漏：用户本轮明确要求清理管理界面可见品牌，因此 `admin/page.tsx` 仅新增显示辅助函数导入与一处展示调用（4 增 1 删），不改权限、请求、存储和业务逻辑。辅助函数复用至两处设备列表，8 个样例测试覆盖旧品牌与其他设备名。
- 本轮 layout / LegacyPlaybackSurface / indexeddb-video-cache 的普通注释与电视遥控本地类型更名，经移除注释后编译输出比对，运行代码均与本轮开始快照一致。其他既有未提交修改未覆盖；未迁移数据、未更改兼容协议与外部服务地址、未改许可证、未提交 / 推送 / 部署。
- 来源归属保留于 README 与源码历史资料；后端认证设备原值、外部请求身份、旧缓存 / 路由 / 扩展标记按兼容白名单保留。真实旧品牌客户端设备未新建，转换行为由组件及纯函数测试验证；浏览器使用真实现有设备记录，不冒充跨客户端实测。未覆盖未配置服务及所有第三方客户端，不能据此宣称底层已完全独立。
- 交付：`output/brand-cleanup-20261024/REPORT.md`、检查日志、截图与本轮开始 `.bak`。发布记录由维护者整理到 PROJECT_CHANGELOG，脚本生成展示模块；不会自动发布或部署。下一步由用户检查页面，正式发行时再整理真实发布记录。

### 2026-10-24 本项目仓库入口（功能已完成，浏览器验收部分完成）

- 读取 Git origin 并通过 GitHub 连接核实本项目公开仓库为 `https://github.com/XYL333FYQ/TongMuTVPlus`，不再要求用户重复提供可从项目读取的地址。
- 版本信息弹窗底部与关于页底部新增“TongMuTV Plus 项目仓库”，同用品牌配置中的 repositoryUrl，以新标签页打开；沿用现有黑白 token、44px 点按区与 focus-visible。新增链接后，弹窗键盘焦点在关闭按钮和仓库链接间循环，保留 Esc 关闭。
- 新增正确仓库地址 / 新标签 / rel / 不自动请求的回归断言，并补齐双控件键盘循环；先观察旧实现失败，再定向 6 项通过。最终 typecheck / lint / format:check 均退出 0；Jest 92 套 / 534 项通过。未涉及房间，本批未重复执行 rooms。
- 浏览器实际点击关于页仓库按钮，新标签打开 `https://github.com/XYL333FYQ/TongMuTVPlus`，已确认并关闭测试弹出页。已验证关于页 390 / 820 / 1280 浅色，以及版本弹窗 820 / 1280 浅色：仓库地址正确、44px 高、无横向溢出；另保存 1440 × 900 深色关于页。之后浏览器连接不可用，剩余深浅截图与实际 Tab / Esc 操作未完成，未计为通过；键盘操作已有组件回归测试覆盖。
- 恢复预览时确认残留启动锁 pid 43412 已被系统 RuntimeBroker.exe 复用，启动器只检查进程号存在，误等已失效的启动窗口；旧锁已备份到本批 output 并清除后服务恢复，未停止系统进程、未修改启动器。该现象能说明启动等待，不能直接等同于之前“页面已加载但管理入口缺失”的唯一根因。
- 本批只改品牌配置、版本弹窗、关于页与两处测试和本记录，未提交 / 推送 / 部署。证据：`output/project-repository-button-20261024/REPORT.md`。下一步：浏览器重新可用时补齐剩余视觉 / 键盘验收；启动器身份校验属于另一个待修问题。

### 2026-10-24 顶栏 GitHub、关于入口与 Star 提示（交由用户验收）

- 按用户截图，在桌面顶栏站名右侧新增本项目 GitHub 图标链接，44px 点按区、独立于首页链接，以新标签打开自己的仓库。采用 lucide 图标和既有黑白 token；按用户最新要求，悬停提示只说明项目仓库，不再请求 Star。
- 登录后账号菜单新增独立的“关于 TongMuTV Plus”分组，上方复用 tm-menu-group 的 1px 淡线；按用户随后纠正，最终顺序为“设置 → 管理面板 → 分隔线 → 关于”，设置与管理面板保持同组、两者之间没有横线。游客账号菜单也补同名入口。新增回归先确认缺少链接，再验证链接地址、顺序、独立分组与点击关闭菜单。
- 按用户最新要求，只有关于页保留请求 Star 的文案；版本弹窗删除该提示，顶栏及其他页面不再展示请求 Star 的话语。各仓库跳转按钮保留，不新增通知、弹窗或自动点赞行为。
- 最新文案调整前，最终 typecheck / lint / format:check 通过、完整 Jest 92 套 / 535 项通过、定向 3 套 / 9 项通过；早期 Node 原生崩溃与重试日志保留。用户明确要求“验收我来验，你改了就行”，本次删文案后未再运行测试、截图或操作浏览器，交由用户验收。不提交 / 推送 / 部署。

### 2026-10-24 GitHub 图标提示样式（交由用户验收）

- 移除顶栏 GitHub 链接的原生 title，改为站内黑白 token、13px 字体、圆角与阴影的悬浮提示，文字仅为项目仓库说明；没有重新加入 Star 请求。
- 支持鼠标悬停、键盘聚焦与 Esc 收起，鼠标可移入提示内容继续阅读。使用普通 React 状态与定位样式兼容既有浏览器，不新增依赖。Modern Web Guidance 的 interest-triggered-tooltips 提供了手动兼容方案；按 hoverable / dismissible 要求保留悬停阅读和 Esc 关闭。
- 按用户要求只修改，不运行测试、截图或操作浏览器。样式与交互均待用户验收；未提交 / 推送 / 部署。

### 2026-10-24 本轮本地提交整理

- 用户明确要求提交本轮改动，范围为品牌与版本信息清理、本项目仓库入口、关于菜单分组及自定义悬浮提示；只提交到本地，不推送或部署。
- 主题 / 加载动画等开始本轮前已有的未提交改动保留在工作区。layout、播放器和本进度文件按本轮内容单独暂存，避免混入其他修改。
- 按用户此前要求由用户验收，提交时不额外运行测试或操作浏览器；最近两次文案 / 提示样式调整未重新验收，保留上述验证边界。

### 2026-10-25 部署后问题修复（批次 1–4 + 悬停补丁，交由用户验收）

用户明确放开禁区：`admin/page.tsx`、`api/admin/theme/route.ts`、`api/theme/css/route.ts`、`useWatchRoom.ts`、`PlaybackSessionProvider` 会话逻辑、`LegacyPlaybackSurface` 逻辑；接口、存储键、Socket 事件名未改（新增的是浏览器内 `tongmu:room-deleted` 自定义事件，不是 Socket 事件）。

- **主题切不回来**：线上实测 `/api/theme/css` 为 `public, max-age=86400`，样式表地址永远不变。现在 layout 里地址带 `?v=cacheVersion`；保存主题时按“实际生效内容（模式 + 主题名/自定义 CSS）”判断是否递增版本（旧逻辑拿主题名比 CSS，会漏）；ETag 加内容摘要。新增 `api/admin/theme/route.test.ts` 3 项。
- **JSON 上传覆盖不了**：旧逻辑是按 api 去重合并，同一份文件再传全部判重复。现在有“覆盖（默认）/ 合并”两种；合并保留已有顶层字段；成功提示明确“点保存才生效”；文件框无论成败都清空。本地浏览器里用 DataTransfer 模拟上传验证：覆盖连传两次第二次生效；合并保留旧 api、加新 api、带入新顶层字段。未保存到数据库。
- **站长碰未开放入口**：`site-locked` 且是站长/管理员时，提示“功能还没配置”并给“去管理面板”，不再给“向站长申请”。本地浏览器已验证；组件测试 +1。
- **删除房间**：服务端先广播 `room:deleted` 后回确认，客户端把确认当成“房间已切换”。`useWatchRoom.request` 对 `room:delete` 在房间已消失时按成功处理，其他命令仍按取消处理；本地浏览器实际创建并删除房间，弹窗关闭、回到列表、无错误条。Hook 测试 +2。
- **悬浮小窗**：X 现在是真正关闭（跟随房间时先 `room:following=false` 再关，失败则不关并提示）；原来的收起改成“−”；收起后的条带也有关闭；房间被删时，仍在跟随该房间且不在 /play 整页的播放器自动收掉，“仅自己看”的不受影响。测试 +6。
- **播放页创建观影室**：创建成功后 `router.push('/watch-room?room=…')`，不再只弹含完整房间号的提示。
- **滚动延迟**：根因是 `playback.css` 对 left/top 有 400ms 过渡。现在滚动时每帧直接写样式变量并临时关闭过渡，不再每次滚动触发整个 Provider 重渲；显示设置新增“播放窗口缓动跟随”（默认关，存 `tm-visual-preferences-v1` 的 `playerEase`，同一存储键，仅多一个字段）。测试 +2。
- **播放页**：“复制链接”“创建观影室”两颗纯色按钮的图标/文字原是与底色相同的 `text-fg`，改为 `text-inverse`（只改 className）；内容区改用与顶栏一致的 `tm-page-container`；标题加粗并在下方加一行年份 / 类型 / 集数 / 豆瓣 / 片源标签；播放区固定高度略收。
- **悬停**：管理面板 17 处 `hover:border-[var(--tm-line)]`（与默认同色，无反馈）改 `--tm-line-strong`；8 处 `text-muted → hover:text-muted` 改 `hover:text-fg`。

验证：`typecheck` 0（一次出现原生崩溃 3221225477，关闭预览后串行重跑通过）；`lint` 0 错误（仅原有 warning）；Jest 102 套 / 607 项通过；`test:rooms` 21 / 21；改动文件 prettier 全通过（整仓 `format:check` 在本机曾原生崩溃，未用它）；`check-design` 对改动文件仅有 2 项 `#fff`，均为 HEAD 里就有的字幕样式。

**没验证 / 风险**：

- 播放页新布局、两颗按钮颜色、小窗关闭按钮、滚动紧跟——本机没有可播放的媒体源（直链解析失败），**只有单元测试，没做 390 / 820 / 1280 深浅截图**，请在线上看。
- 房间页滚动手感没有实机比对，只验证了逻辑（滚动时过渡被关、停止后恢复）。
- 删除房间后“叉号反复出现”的错误只确认了根因之一，若线上仍出现请把复现步骤发我。
- 主题缓存：部署后第一次访问，浏览器会拿到新的带版本号地址，旧缓存自动作废；已被缓存的旧 HTML 在一天内可能仍引用旧地址，强制刷新即可。
- 批次 5（非主界面逐页重做悬停与排版：`UserMenu`、live、web-live、music 等）只做了上面的无效悬停补丁，**整页重做没有做**。

### 2026-10-25 通知自动刷新与管理页定位

- 用户确认上一轮方案后实施：登录账号可见页面每 30 秒检查未读，隐藏时暂停，返回标签页 / 窗口聚焦立即检查；多处头像共用请求和计数，最后一个实例卸载时移除监听、定时器并取消请求。复用通知接口、黑白角标及 `notificationsUpdated` 已读事件，不改通知收件人或通知存储。
- 点击反馈通知打开反馈收件箱并定位对应记录；求片通知打开求片管理并按记录状态选择筛选、定位。桌面选区和手机手风琴均支持，已处理记录也可找到；通知已读不修改反馈 / 求片处理状态。读取列表取消过期请求，避免切筛选后旧响应覆盖新列表。
- 只读代码复核发现重复点击同一通知不会重新定位，已补一次性 notice 参数，带动重新展开 / 选择筛选 / 定位；同记录第二次定位的回归先失败再通过，复核确认覆盖该问题。管理页仅修改此次通知定位相关部分，保留既有内容；未修改 API、数据库、房间、播放器、Socket、依赖或现有存储键，未提交 / 推送 / 部署。
- DESIGN.md：沿用第 2 节颜色 token 和第 4 节焦点规范；只给定位记录增加可聚焦节点和 token 焦点环，不重新设计、不增加动画。
- 验证分阶段记录：首次完整 Jest 106 套 / 616 项通过；重复定位补丁后定向 4 套 / 8 项通过，最终 lint 退出 0（仍有既有警告）。补丁前 typecheck / format:check 各有完整退出 0 记录；补丁后 typecheck 在未启动预览的情况下连续两次原生崩溃 3221225477，无 TS 诊断，按项目规则标记 **typecheck 待用户手动验证**；最后完整 Jest、再次定向检查及 format 检查也遇到原生崩溃 / 未完成，不能宣称最终全量通过，根因未知。请用户在自己的终端运行 `pnpm typecheck`、`pnpm test --runInBand`、`pnpm format:check` 并贴回结果。未改房间，未重复 rooms。
- 浏览器：真实 Edge，桌面 1440×900，模拟通知响应验证不刷新等待 31 秒后未读从 0 变 2，点击反馈 / 求片进入对应区块且焦点在目标记录；390 / 820 / 1280 × 深浅色 × 两类目标共 12 张截图，目标均可见且无横向溢出，验收流程 pageerror 为 0。浏览器接口模拟仅限通知、反馈、求片，不写测试消息到真实数据库；不是线上送达验证。
- 边界：上述浏览器验收在重复点击补丁之前，补丁有定向回归和只读复核，未重新浏览器验收。隐藏页面暂停 / 返回刷新的浏览器补测被本机工具错误中断，已有单元测试覆盖，未冒充真实标签切换通过；未测试系统推送或 Telegram 送达及其跳转。临时预览、测试浏览器均已关闭，3000 监听已确认消失。截图与流程脚本在 `output/playwright/notification-reminders/`，日志和报告在 `output/notification-reminders/`。
- 下一步：用户终端补最终类型 / 全量测试 / 格式验证；必要时补真实标签切换与重复通知点击验收。
- 提交整理：用户随后明确要求本地提交，范围仅为本次通知轮询、管理定位、相关回归测试及本记录；不推送、不部署。提交前核对 diff / 暂存范围，不重复启动预览或运行上面已记录受原生崩溃影响的检查，验证边界保持不变。

## 2026-10-26 登录封禁误伤与小窗暂停

- 用户反馈：朋友新注册账号后所有设备（含无痕、换浏览器）都提示“登录失败次数过多”，开代理就能登录；自己的设备都正常。另：小窗里暂停不了。用户确认朋友一直在同一个网络，线上 nginx 站点配置里有 `proxy_set_header X-Real-IP $remote_addr;`。
- 根因（代码）：登录按**出口 IP** 封禁，同一 IP 10 分钟内失败 5 次封 1 小时、再封 6 小时、之后每次 24 小时，封禁等级只升不降，且检查排在校验账号密码之前；同一 WiFi / 校园网 / 运营商共享 IP 的设备一起被封，换 IP（代理）就不受影响。提示不写剩余时间（秒数只放在 `Retry-After` 头里，页面没读）；登录页把所有 401 都显示成“密码错误”。服务器还优先信任客户端可随意填写的 `cf-connecting-ip`（站点前面是 nginx，不是 Cloudflare），任何人可伪造它封别人的 IP 或绕过自己的封禁。
- 本轮用户授权改 `src/app/api/login`、`src/app/api/register`、`src/lib/login-fail2ban.ts`、`src/app/login/page.tsx` 与小窗工具栏（`PlaybackSessionProvider`）；不改接口路径、存储键、Socket 事件名，不新增依赖。
- 改动：
  - 封禁固定 15 分钟、不再逐级加长（阈值仍是 10 分钟内 5 次）；响应体新增 `retryAfterSeconds`，提示写成“请 N 分钟后再试”（账号锁定同样）。
  - 访客 IP 只读代理写入的值：`X-Real-IP`，没有时取 `X-Forwarded-For` 最后一段；`CF-Connecting-IP` 仅在设置 `TRUST_CF_CONNECTING_IP=true`（确实在 Cloudflare 后面）时才信。读不到 IP 时仍不做 IP 限流。
  - 登录 / 注册先去掉用户名首尾空格（手机输入法常带空格，原来会被当成“用户不存在”累计失败）。
  - 登录页显示服务器返回的原因（用户名或密码错误 / 账号被封 / 限制剩余时间），读不到再用兜底文案。
  - 小窗工具栏新增播放 / 暂停按钮（原来小窗把播放器自带控制栏整条隐藏，手机上 ArtPlayer 单击画面又不会暂停）；在房间里跟随同步且没有控制权的人，按钮禁用并提示“播放进度由房主控制”。为腾位置，小窗里去掉与点击标题缩略图重复的“放大”按钮（折叠态保留）。
- 测试：`login-fail2ban.test.ts` 新增 5 项（固定 15 分钟、IP 互不影响、不信伪造头、Cloudflare 开关、等待时间措辞）；新增 `api/login/route.test.ts` 3 项（用户名去空格、5 次失败后 429 带剩余时间且其他 IP 正常、伪造 `cf-connecting-ip` 无效）；`PlaybackSessionProvider.test.tsx` 新增 2 项（播放 / 暂停随视频状态切换、房员禁用）。
- 验证：`typecheck` 0；`lint` 退出 0（仅既有 warning）；Jest 115 套 / 657 项通过；本机浏览器（localhost:3000）用 `admin`（带首尾空格）登录成功；小窗工具栏 1280 宽按钮 5 个、标题宽 144px（原 140px）。
- 没验证 / 风险：真实视频下小窗播放 / 暂停、手机 390 宽小窗布局没有实机看（本机没有可播放的媒体源）；`test:rooms` 未跑（未动房间代码）。线上要**重启服务**才能清掉现有内存里的封禁记录；之后依赖 nginx 的 `X-Real-IP`，若以后改成 Cloudflare 在前，需要设置 `TRUST_CF_CONNECTING_IP=true`。账号锁定（同一账号 15 分钟内错 10 次）规则未改。

## 2026-10-26 手机 / 平板 / 电视排查与滚动、安全区修复

- 用户反馈：安卓网页顶部横条臃肿，苹果正常；切换主题时圆形扩散的焦点没跟着按钮走；要求手机、平板、电视端整体检查。用户确认计划后实施，不改接口、存储键、Socket 事件名，不新增依赖。
- 排查（本机 Chromium 仿真）：360 / 390 / 768 / 820 / 960 / 1280 / 1920 宽下，首页、片库、搜索、房间、我的、关于、求片、反馈、登录、注册以及 `/tv` 系列页面均无横向溢出，也没有小于 12px 的文字。用触屏仿真（`pointer: coarse`）重测，390 宽的片库、搜索、我的没有小于 44px 的可点元素——先前在桌面指针 iframe 里量到的小目标是量法问题，项目已有 `pointer: coarse` 的 44px 规则，**未改**。
- 根因 1：`base.css` 给 `html, body` 同时写了 `height: 100%` 和 `overflow-x: hidden`，html 一旦不是默认 overflow，body 的 overflow 就不再传给 viewport，body 自己成了滚动容器（实测 body `scrollHeight` 2702、html 1100）。安卓 Chrome 的地址栏因此不能随滚动收起，可视区被它长期占着。改为只在 body 上写 `overflow-x: hidden`、去掉两处 `height: 100%`；改后 `window.scrollY` 随滚动变化。弹层锁滚动用的 `body.style.overflow = 'hidden'` 经 body 传给 viewport，继续有效，所以没有动 `admin/page.tsx`；`BackToTop`、`RouteScrollReset`、`PageLayout` 本来就同时处理 window 与 body，未改。
- 根因 2：站点声明了 `viewport-fit=cover`，顶栏又无条件加 `env(safe-area-inset-top)`，部分安卓浏览器会上报状态栏高度，顶栏凭空变高；iOS Safari 普通标签页该值为 0。`--tm-safe-top` 现在默认 0，仅 `display-mode: standalone / fullscreen`（主屏幕独立窗口）才取 `env(safe-area-inset-top)`；电子书、漫画、媒体外壳里直接写的 `env(safe-area-inset-top)` 改用同一个 token。
- viewport：删除 `layout.tsx` 里手写的第二个 `<meta name="viewport">`（原来页面里有两个），改由 `viewport` 配置输出 `width / initialScale / viewportFit / themeColor`；`themeColor` 先给默认深色 `#0b0b0d`，ThemeProvider 之后按真实 `--tm-bg` 改写，安卓工具栏首屏不再先闪白。
- 输入框：触屏上 `input / textarea / select` 字号不小于 16px（`primitives.css`，后台 `.tm-admin-page` 内除外），避免 iOS 聚焦自动放大页面；求片页输入框原为 14px。
- 主题切换错位：桌面仿真下按钮中心坐标、`::view-transition` 各层位置都与按钮一致，没有复现；怀疑与上面的 body 滚动模型有关（真机里 root 快照与固定定位顶栏的关系），**未改动 `theme-transition.ts` 与主题 CSS**，需要在真机上看修复滚动模型后是否还错位。
- 没验证：安卓 / iOS 真机（地址栏是否收起、状态栏安全区、主题切换圆心）、平板触屏（本机 ≥768 宽没有触屏仿真）、电视遥控焦点与屏幕边缘安全区、`/tv` 实机观感。测试用的 `themeColor` 在浅色用户首次进入时先显示深色再切换。

## 2026-10-26 房间聊天可达性与悬浮入口（本地修改完成）

- 用户确认执行：主题不改；悬浮回房/消息入口相邻，手机/平板聊天置于长简介之前，简介三行可展开，桌面保留两栏与三标签。已完成展示层修改；未改 API、存储键、Socket、播放器与同步逻辑，未提交/推送/部署。
- 新增窄屏默认聊天/资料顺序、简介展开收起/换片重置回归，先观察 2 项预期失败，再实现；另补 A→B→A 换回影片重新收起的 RED/GREEN。最终相关 4 套/34 项通过；typecheck 最后一次原生退出 3221225477 后，确认预览关闭，串行重跑退出 0；lint 退出 0（既有 warning），format:check 原生崩溃后重跑退出 0；rooms 21/21。设计检查违规 0/TODO 0，git diff --check 通过，output 没有 .ts/.tsx/.d.ts 备份。
- 常规完整 Jest 多次原生崩溃（-1073741819、-2147483645），根因未知。用附带 Node --jitless 分组覆盖全部 116 套/659 项通过；分组前另有 Socket 重连测试监听本机端口 EACCES 的失败，日志保留，未改测试。分组通过后仅补 A→B→A 收起与共享避让变量，最终相关 34 项通过，但最终常规全量仍原生崩溃，不能宣称最终常规全量通过；需用户终端补跑 pnpm test --runInBand。未修改运行配置或依赖以绕过检查。
- 只读复核发现返回顶部与新回房位置、原手机小窗与回房、折叠条与返回顶部的遮挡，已用共享位置变量修复，末次只读复核无新明确问题。真实 Edge 从 1440×900 开始，以独立模拟 Socket 房间、长简介与本地生成视频检查 390/820/1280 深浅 6 组：默认标签、聊天发送、简介展开/收起、两入口 44px 高/8px 间距、小窗默认避让及无横向溢出，页面异常 0。房间/聊天/入口/小窗截图在 output/playwright/room-chat-layout-20261026/。另加载真实 CSS，在独立浏览器布局夹具中验证三个宽度 × 普通/mini/folded 共 9 组与返回顶部间距，全部通过；这部分不是实际房间交互截图。
- 边界：420px 可视高度模拟中输入框/发送按钮可见，未验 vivo/iOS 真机软键盘、拖动小窗后的任意位置、线上媒体或真实多人同步。额外折叠交互验收脚本因等待条件未完成，未计入应用交互通过；折叠避让已有独立 CSS 几何验收。未往真实房间写验收消息。保留原有 3000 本地预览供用户查看，不提交/推送/部署。下一步用户查看布局并补常规全量测试；详细证据和 .bak 在 output/room-chat-layout-20261026/。
- 用户随后明确要求「提交吧」，授权将本次布局、两处回归测试及设计/进度记录提交到本地 Git；不推送、不部署。提交前再次核对文件范围与 diff --check；未改源码，不重复启动验收，常规全量测试原生崩溃和真机未验的限制继续保留。
