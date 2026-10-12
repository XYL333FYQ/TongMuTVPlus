# P4 房间与播放验收

日期：2026-10-11。范围：房间与播放展示层；依据 DESIGN.md §5、§3.3 第 13–15 条、Room / RoomPhone 画板。未修改 API、Socket 协议、数据库实现、同步 Hook 或播放会话逻辑。

## 1. 修改文件

| 文件                                              | 修改                                                                                                                               | 对应规范                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| src/features/rooms/RoomWorkspace.tsx              | 标题、桌面片单与聊天、窄屏三标签、成员头像簇、状态文案、原收起/恢复动作；弹窗通过 Portal 放到 body，避免被全局视频层挡住           | §5.1/5.2，§6/7          |
| src/features/rooms/rooms.css                      | 房间、目录和弹窗黑白 token；12px 下限、44px 点按目标、复选框、断点、放映模式；不改变目录排列                                       | §2.5，§3，§5.3          |
| src/components/PageLayout.tsx                     | 可选 mobileTitle，仅房间页传入房间名；手机不再重复显示通用标题与房间名，沿用现有下滚收缩                                           | §3.3 第 8 条，RoomPhone |
| src/components/watch-room/ChatFloatingWindow.tsx  | 复用同一全局聊天实例，房间内嵌入、其他页面浮窗；只在可见标签观察已读；草稿、分页、发送、语音和提示计时保留                         | §5.1，§3.3 第 15 条     |
| src/features/playback/playback.css                | 现有媒体挂载层的 400ms 形态过渡、播放器黑白控件、聊天与错误提示套皮、减少动态和关闭模糊                                            | §3.3 第 13 条，§4/5.2   |
| src/features/playback/PlaybackSessionProvider.tsx | 仅未读徽标的 key 和 className，数字更新时播放一次展示动画；视频 key、动作和会话逻辑均未改                                          | §3.3 第 15 条           |
| src/features/rooms/useRoomScreening.ts            | 展示 Hook：监听视频事件和用户操作，播放静置 3 秒后淡出周边，600ms 过渡；缓冲/暂停/结束/错误、个人观看/折叠、减少动态和弹窗时不启用 | §3.3 第 14 条           |
| 三个房间测试文件、ChatFloatingWindow.test.tsx     | 状态、原有操作调用、隐藏聊天不标已读、嵌入/浮窗草稿、放映模式与偏好回归                                                            | §5.2，验收清单          |
| docs/design/PROGRESS.md                           | 进度、结果与未验证边界                                                                                                             | AGENTS.md               |

LegacyPlaybackSurface.tsx 未修改。server/、useWatchRoom.ts、usePlaySync.ts、session.ts、API、数据库、middleware、admin 未修改；未新增依赖、提交或部署。

## 2. 实现边界

- ≥1200px：右侧片单在上、聊天在下常驻，成员头像簇展开列表。<1200px：片单 / 聊天 / 成员三标签；沿用§2.5 的桌面边界。
- 聊天 Portal 只移动显示位置，不新增第二个聊天/语音实例；隐藏标签不创建已读观察。仍要求消息实际可见、浏览器前台且有焦点。
- “房主交接中”只用于服务器仍分配主持 session、但成员列表中该 session 已离线的宽限阶段；无分配主持时显示“暂无主持”。界面不自行选主持，也不承诺已经接管。
- 坐标与尺寸当前实际在 `[data-tm-player-mount]`，因此过渡加在这个现有媒体层。没有增加新的播放器实例或测量/会话逻辑；CSS 定位尺寸属于第 13 条的例外。
- “回到一起看”“在这里听”“重新加载影片”使用原动作。重载失败影片或明确换片允许本机媒体节点更新，不能与形态切换的节点验证混为一谈。
- 新增中性材质 token：放映黑底、播放器白色、遮罩与阴影。播放器原有绿色主题只用 CSS 覆盖，不改播放器配置逻辑。
- 目录仍为原“我的房间 / 公开房间 / 已归档”及原栅格，不重排；邀请、设置、退出、屏幕共享、搜索、按开关显示的音乐/直播入口保留。

## 3. 命令结果

最终结果以本包 output/playwright/p4 下日志为准。

| 检查                             | 结果                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| pnpm typecheck                   | 最终通过；一次检查器内部 flags 异常，原日志保留在 typecheck-internal-error.log                                                                   |
| pnpm lint                        | 失败：既有 81 个错误；本轮相关文件单独 ESLint 0 错误                                                                                             |
| pnpm test                        | 全量执行；旧 scripts/migrate-branding.test.js 的 node:test 与 Jest27 冲突，失败。最终 pnpm test --runInBand：210 项通过，30 套件通过，1 套件失败 |
| pnpm format:check                | 未完成：报告既有格式问题后 Node 24 异常退出；重试及 --jitless 补充运行仍异常。本轮 13 个文件单独检查通过，不宣称全量格式通过                     |
| pnpm test:rooms                  | 19/19 通过                                                                                                                                       |
| 本轮房间/聊天/播放器相关组件测试 | 30/30 通过                                                                                                                                       |

未把构建或单元测试通过当作浏览器效果证明；没有全局修复历史 lint/格式或更换测试运行器。

## 4. 实际浏览器验证

Chrome 桌面浏览器，使用临时 SQLite 副本、专用两账号和本地 120 秒 MP4。现有业务数据库未用于创建/修改测试房间。截图中彩条、计时和图形来自测试影片本身。

| 场景                  | 实际证据                                                                                                                                                      | 边界                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 房间 → 搜索 → 房间    | 保存实际 video 引用；前后严格相同、isConnected=true；paused=false；播放时间及解码帧增加；监听 pause/emptied/abort 和视频 DOM 增删，均未发生                   | 最终采样见 continuity.log，使用刷新后加载的代码，不依赖热更新状态                  |
| 收起 → 恢复           | 同一 video 引用，仍在 DOM 内；时间与解码帧继续增加，未暂停或重建                                                                                              | 房间内嵌完整画面 → 小窗/折叠。独立 /play 页面形态未完整验收                        |
| 个人观看 → 回到一起看 | 房主播放 B 约 0.97 秒，成员保持同一 A 节点并主持、约 13.33 秒；返回后两端 A 为 15.10/15.60 秒，均播放中                                                       | 明确换片允许本机重建媒体；成员未重建。见 personal-queue.log                        |
| 片单换位              | A/B→B/A；当前视频引用不变，播放时间 11.08→11.66 秒                                                                                                            | 实际点击原向前/向后按钮；未改排队或权限规则                                        |
| 房主断连及接管        | 房主页面离开站点后，成员先显示“房主交接中”，随后成为主持；同一视频节点，9.59→40.55 秒、4812→5557 帧，均未暂停                                                 | 授权成员场景；不是手机后台冻结或所有网络故障的证明                                 |
| 重连中细条            | 仅重启本轮隔离开发服务，网页实际出现顶部“重连中 · 影片继续播放”并保留视频                                                                                     | Playwright 离线模拟未切断已建立的 Socket，未把该尝试当作证据；不宣称所有弱网已覆盖 |
| 暂无主持              | 取消成员授权后房主退出，成员实际显示“已连接 · 暂无主持”并保留视频                                                                                             | 本次采样影片已自然结束于 120 秒；不能据此宣称无主持时长时间持续播放已验收          |
| 另一标签页出声        | 同浏览器第二标签初始静音；点击“在这里听”后，本页 muted=true、另一页 muted=false，两页均 paused=false；本页节点保持相同                                        | 两个不同账号的独立上下文有独立声音租约，不拿它们当作多标签互斥证明                 |
| 视频失败与重载        | 仅阻断成员本地媒体请求，video error=4、readyState=0；恢复请求并点原重载后 readyState=4、paused=false、已解码 84 帧；房主仍是同一节点，4132→4310 帧            | 本地 MP4 错误恢复；真实上游与 HLS 本轮未验证                                       |
| 放映与偏好            | 正常模式静置后背景 rgb(0,0,0)、侧栏 opacity=.25；移动鼠标恢复 1。减少动态及 OS 减少动态时不启用，媒体 transition 为 0s；无模糊时可见 backdrop-filter 列表为空 | 见 preferences.log；含播放器浮动音量控件的无模糊样式                               |
| 390/820/1280、深浅    | 六组 scrollWidth 等于视口宽，无横向溢出；390/820 有三标签，1280 聊天常驻；所检查房间/聊天按钮高度 ≥44，媒体与 slot 位置吻合                                   | 桌面 Chrome 窄视口，不是实际触屏手机                                               |
| 创建弹窗与目录        | 名称 autocomplete=off，密码 new-password 且为空，复选框 appearance=none；三种目录标签实际切换                                                                 | 未提交额外测试房间；第三方密码管理扩展未验证                                       |

## 5. 风险与未验证

- 从带 `?room=` 邀请地址点击退出，出现一次自动重入：退出后原邀请参数触发已有自动加入流程。该行为代码本轮未修改；不在换皮范围内修复。改用不带邀请参数的房间入口后，目录切换正常。需要后续行为修复。
- 开发热更新期间有一次媒体 slot 显示位置丢失；完整刷新后恢复，连续播放的最终复验使用完整刷新后的代码。没有为此改 PlaybackSlot 或会话逻辑。
- QA 中一次成员 Chrome 页面崩溃，重开该测试页面后完成两客户端复验；未将崩溃过程作为通过证据。
- 播放器原有速度探测会将测试 MP4 尝试作 HLS 并记录解析错误，随后原生 MP4 成功解码；本轮未改解析逻辑。
- 最后复验先遇到测试影片自然结束；该样本不用于持续播放证明。重新开始播放后，换页/收起/恢复全部同节点，时间 10.97→15.02 秒、解码帧 286→383，事件和视频 DOM 增删列表均为空。
- 最终播放器颜色见 player-theme.log：主题 #fafafa，进度 rgb(250,250,250)。声音与失败恢复日志中的诊断字段曾记录热更新前的绿色；随包提供的 sound-final.json / media-recovery-final.json 仅摘取相应行为证据，原诊断日志在工作区保留。
- 全量格式检查在 Node 24 下多次异常退出，未完成最终扫描；本轮 13 个文件单独格式检查完成并通过。未为解决工具问题改依赖、配置或全局格式。
- 未验证：Safari、Firefox、真机键盘/旋转/后台冻结、真实上游/HLS、长时间播放、独立 /play 完整形态、所有权限角色与各类断线组合、关闭模糊的所有站内旧页面。字体文件仍沿用 P1 缺失状态。
- CSS 坐标过渡的性能和连续滚动跟随只做 Chrome 检查，不承诺所有低性能设备都流畅；减少动态可关闭过渡。

## 6. 截图

| 深色                                                  | 浅色                                                   |
| ----------------------------------------------------- | ------------------------------------------------------ |
| [390](../../output/playwright/p4/room-dark-390.png)   | [390](../../output/playwright/p4/room-light-390.png)   |
| [820](../../output/playwright/p4/room-dark-820.png)   | [820](../../output/playwright/p4/room-light-820.png)   |
| [1280](../../output/playwright/p4/room-dark-1280.png) | [1280](../../output/playwright/p4/room-light-1280.png) |

补充：[搜索小窗](../../output/playwright/p4/search-mini.png)、[折叠](../../output/playwright/p4/room-folded.png)、[个人观看](../../output/playwright/p4/personal-viewing.png)、[返回同步](../../output/playwright/p4/returned-together.png)、[放映](../../output/playwright/p4/screening-mode.png)、[偏好](../../output/playwright/p4/preferences-reduced-no-blur.png)、[交接](../../output/playwright/p4/host-handoff.png)、[接管](../../output/playwright/p4/host-taken-over.png)、[重连](../../output/playwright/p4/reconnecting.png)、[暂无主持](../../output/playwright/p4/no-host.png)、[声音归属](../../output/playwright/p4/another-tab-sounding.png)、[视频失败](../../output/playwright/p4/video-failure.png)、[恢复](../../output/playwright/p4/video-recovered.png)、[手机聊天](../../output/playwright/p4/mobile-chat-light.png)、[创建弹窗](../../output/playwright/p4/create-dialog.png)、[房间目录](../../output/playwright/p4/my-rooms-directory.png)、[空片单](../../output/playwright/p4/room-empty-dark-1280.png)。

压缩包仅包含本报告、截图和验证日志；不包含源代码、数据库、账号凭据、环境配置或开发服务日志。
