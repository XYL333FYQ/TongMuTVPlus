# 影片播放与房间连接：逐项证据账本

日期：2026-10-27（本轮改造的 Task 6）。对象：分支 `codex/playback-room-connections` 的当前工作区（未提交）。

本账本把 2026-10-26 的只读审计清单逐项落到证据上。审计原文在被忽略的 `output/playback-room-connection-audit-20261026/REPORT.md`，本账本沿用它的入口族、冲突编号（C01–C17）和模块划分。完整的线路图和状态图见 [architecture.md](../architecture.md)，验收约定见 [requirements.md](../requirements.md)。

## 怎么读这份账本

状态只有四种，不使用“基本完成”这类说法：

| 状态     | 含义                                                                  |
| -------- | --------------------------------------------------------------------- |
| 已验证   | 有自动化测试，并且在真实浏览器（本机 Edge、受控夹具）里走过同一条路径 |
| 仅自动化 | 只有 Jest/服务测试覆盖。行为在测试里成立，没有在真实浏览器里走过      |
| 未验证   | 没有证据。原因写在“边界”列                                            |
| 未改动   | 本轮没有改这条路径，也没有为它新增验证                                |

“测试”列写测试文件和能定位到它的测试名；“浏览器”列写验证日期之前已经走过的场景，细节在 `docs/design/PROGRESS.md` 对应条目里。浏览器证据的原始日志和截图在被忽略的 `output/` 目录，不进 Git，因此本账本不依赖路径，只依赖场景描述。

三条总边界，下文所有“已验证”都在它们之内：

1. 浏览器环境是一台电脑上的 Edge，影片是本机静态 MP4（`public/__qa_*.mp4`），直播、音乐、屏幕采集用夹具或假设备。没有真实外部来源、真实手机/电视、真实网络（NAT/TURN）。
2. 账号只有房主账号和一个普通 QA 账号；“双设备”多数场景是同一账号开两个标签页。真实第二账号的场景单列标注。
3. 声音只验证了“谁被静音、谁在播放”，没有真人耳朵或真实音频输出。

## A. 影片入口族（审计第二节）

| 入口                                                                     | 现在的行为                                                                                                                                                                                  | 测试                                                                                                                                  | 浏览器                                                                                                                                                                             | 状态                              | 边界                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| 首页 Hero 播放/找片                                                      | 跳 `/search?q=标题` 再进 `/play`                                                                                                                                                            | BannerCarousel.interaction                                                                                                            | 未走                                                                                                                                                                               | 仅自动化                          | Hero 未带年份/类型的同名歧义是审计记录的既有限制，未改                                    |
| Hero 一起看 / 详情一起看                                                 | 带着影片进入房间选片，不再丢片                                                                                                                                                              | BannerCarousel.interaction（hero together carries…）、VideoCard.navigation（together from a movie detail…）、（saved episode keeps…） | 补验：房主已在房间里，首页点 Hero“一起看”，进入 `/watch-room?film=…`，工作区显示“已选择「逃出布迪秀」。确认片源后加入待看，当前影片继续。”和“添加这部到待看”，房间当前活动不被切走 | Hero 已验证；详情页一起看仅自动化 | 详情页入口未在浏览器里走                                                                  |
| 首页普通海报、豆瓣/TMDB 资料                                             | `/play?title/year/stype`，由播放器查源                                                                                                                                                      | VideoCard.navigation                                                                                                                  | 未走                                                                                                                                                                               | 仅自动化                          | 资料不是播放资源，查源依赖外部数据源                                                      |
| 片库 `/douban`                                                           | VideoCard → `/play`                                                                                                                                                                         | 未改动                                                                                                                                | 未走                                                                                                                                                                               | 未改动                            | 依赖豆瓣外部数据                                                                          |
| 番剧时间线 / 搜索聚合 / `/under` / 搜索单源 / 源站寻片 / 短剧 / 高级推荐 | 全部经 VideoCard 或直接链接进 `/play`                                                                                                                                                       | VideoCard.navigation                                                                                                                  | 搜索单源 → 播放：Task3 真实 Edge                                                                                                                                                   | 仅自动化                          | 来源可用性取决于站长配置，未验证真实来源                                                  |
| 继续观看 / 播放历史 / 收藏 / 收藏更新通知                                | source/id → `/play`，房间明确集数优先于个人记录                                                                                                                                             | session.test（catalog queue items carry the stated episode…）                                                                         | 未走                                                                                                                                                                               | 仅自动化                          | 未改链接，只验证集数规则                                                                  |
| 私人影库 Emby/OpenList、小雅                                             | `/play?source=…`                                                                                                                                                                            | 未改动                                                                                                                                | 未走                                                                                                                                                                               | 未验证                            | 需要真实私库和第二账号取流权限，本机没有                                                  |
| 打开视频直链                                                             | base58 编码 → `/play?source=directplay`                                                                                                                                                     | 未改动                                                                                                                                | Task3：首页“打开直链”播放 B → 个人模式 → 返回房间仍 B → 明确恢复才回 A                                                                                                             | 已验证                            | 受控 MP4                                                                                  |
| 网盘分享 / 搜索内网盘搜索                                                | `/play?source=netdisk-…`                                                                                                                                                                    | 未改动                                                                                                                                | 未走                                                                                                                                                                               | 未验证                            | 需要真实网盘账号和分享权限                                                                |
| AI 问片影片链接                                                          | 链接进 `/play?title`                                                                                                                                                                        | 未改动                                                                                                                                | 未走                                                                                                                                                                               | 未改动                            | 需要 AI 服务                                                                              |
| 播放器内推荐 / 智能推荐（C02）                                           | 在 `/play` 内选片走客户端导航，不整页刷新                                                                                                                                                   | VideoCard.navigation（selecting from the playback page uses client navigation…）                                                      | Task3：同一 video 元素持续                                                                                                                                                         | 已验证                            |                                                                                           |
| 游客播放 / 游客 Hero 一起看                                              | 公开资料 → 登录 redirect → 保留所选影片                                                                                                                                                     | PublicCatalogPage（guest together preserves…）                                                                                        | 未走                                                                                                                                                                               | 仅自动化                          |                                                                                           |
| 片库 → 播放 → 创建房间                                                   | 查源 → 创建房间 → 共享当前影片                                                                                                                                                              | PlaybackSessionProvider（sharing to a newly created room…）                                                                           | Task3：真实创建房间并共享当前影片；Task4 另一个普通账号进入同一房间                                                                                                                | 已验证                            |                                                                                           |
| 已在房间，再点播放页创建房间（C12）                                      | 已在房间时，播放页的按钮变成“返回房间”，跳到当前房间，不会再建第二个（`LegacyPlaybackSurface.handleCreateWatchRoom` 先判断 `currentRoom`）；工作区创建/加入时遇到已在别的房间，由服务端拒绝 | room-service.test（a connection already in another room…）、RoomWorkspace.test                                                        | 补验：房主在房间 D6DA… 里打开直链播放页，工具栏只有“返回房间”，没有创建入口；前后我的房间数都是 2                                                                                  | 已验证                            | 没有逐一试“点了返回房间之后”以外的路径；该按钮的逻辑在 LegacyPlaybackSurface 里，本轮未改 |
| 先创建房间再选片                                                         | 工作区选片器/快速开始 → 追加待看 → 主持手动播放                                                                                                                                             | RoomFilmSelection、RoomWorkspace.invite                                                                                               | Task3：添加 B 后当前继续 A                                                                                                                                                         | 已验证                            |                                                                                           |
| 房间播放中浏览新影片                                                     | 追加待看 / 立即一起看 / 仅自己看三选一                                                                                                                                                      | PlaybackSessionProvider（adds a selection to the room queue…）                                                                        | Task3：加入 B 不切 A；个人 B 返回仍 B                                                                                                                                              | 已验证                            |                                                                                           |
| TV 首页/分类/搜索/详情/直播（TV 播放）                                   | TV 页只做个人观看：进入播放前退出共同播放，播放时拿声音归属                                                                                                                                 | useStandalonePlayback、TVNativeVideo                                                                                                  | TV 批：房间放电影时进 `/tv/play`，两路同时出声 0/615；同浏览器跨标签让声；直接打开遇到房间加入竞态已修                                                                             | 已验证                            | 没有真实电视与遥控器；`/tv/live/play` 只走了 hook 单测                                    |

## B. 房间生命周期、活动与附属模块（审计第三节）

| 路线                               | 现在的行为                                                                           | 测试                                                                                                                                                        | 浏览器                                                                                                                      | 状态       | 边界                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| 目录 → 创建/加入 → Socket 服务     | 内置 Node + SQLite 权威服务                                                          | room-service.test（authenticated account identity…、room quota is three…、default room capacity…、a connection already in another room…）                   | Task3/4                                                                                                                     | 已验证     |                                                                  |
| 邀请链接 → 登录 → 加入             | 带 `?room` 保留目标，处理密码重试                                                    | RoomWorkspace.invite                                                                                                                                        | 未走（登录后保留 `?room` 的整条路径没有在浏览器里用第二账号走）                                                             | 仅自动化   |                                                                  |
| 游客点公开目录房间卡 → 登录        | 保留房间 id 与所选影片                                                               | RoomWorkspace.test（a guest room card keeps…）                                                                                                              | 未走                                                                                                                        | 仅自动化   |                                                                  |
| 归档 → 恢复 → 再加入               | 恢复与加入是两个明确动作                                                             | room-service.test（empty room pauses…、…allows recovery before purge）                                                                                      | 未走                                                                                                                        | 仅自动化   | 外部模式不提供，见本节 external                                  |
| 切页/小窗/折叠/恢复                | 同一 video 实例，不因切页退房                                                        | PlaybackSessionProvider（keeps the same video across page navigation…）                                                                                     | Task3/4：切宽度/主题/导航保持原 video                                                                                       | 已验证     |                                                                  |
| 仅自己看 ↔ 回到一起看              | 等 `room:following` 确认；返回只导航不恢复                                           | PlaybackSessionProvider（waits for room:following ACK…）、RoomActivityActions                                                                               | Task3、TV 批                                                                                                                | 已验证     |                                                                  |
| 主持交接 / 重连 / 房主回来（C11）  | 统一用当前设备 `canControl`                                                          | room-service.test（host transfers…、same owner reconnect…、two devices never share control）、RoomActivityActions（does not substitute account ownership…） | 直播活动整页刷新后房主 8 秒内拿回主持                                                                                       | 已验证     | 真实“另一个授权账号”做主持未走                                   |
| 手动片单播放 / 片单权限            | 主持手动播放；成员只能删自己未播项；已播留标记                                       | room-service.test（ordinary members may remove…、a confirmed queue selection stays marked played…）                                                         | Task3                                                                                                                       | 已验证     | 不自动跨影片续播（有意）                                         |
| 电视直播（C07/C08）                | 浏览不广播；显式分享；快照不回声；刷新恢复                                           | useLiveSync.test、room-live.test                                                                                                                            | 直播批 + 刷新恢复主持                                                                                                       | 已验证     | 频道源是浏览器注入的受控频道                                     |
| 网络直播（审计第五节 DTO 问题）    | 房间只传稳定引用 `/web-live?platform&roomId`，不传 `platform:roomId` 或临时 CDN 地址 | room-live.test；useWebLiveSync 使用同一套                                                                                                                   | 未走                                                                                                                        | 仅自动化   | 没有真实平台房间                                                 |
| 房间 → 一起听（C09/C10）           | 显式分享；快照不回声；慢 A/快 B 不覆盖；听众页按活动判断                             | useRoomMusicActivity.test、watch-room/music/page.test、useLatestMediaRequest.test                                                                           | 音乐批：电影放着时本机听歌不碰房间；恢复一起看 → 在房间播放 → 房间变音乐活动；暂停/播放同步；同账号另一设备进听众页不被跳走 | 已验证     | 音乐接口是夹具；真实音乐源与听众出声只有单测                     |
| 房间 → 屏幕共享（C14）             | 常规房间可共享；先确认再发画面；选屏期间换房丢弃采集；停止释放采集                   | useScreenShare.test、watch-room/screen/page.test                                                                                                            | 屏幕批：假采集（canvas+振荡器），WebRTC 真实，观众 1 秒出画，停止后采集全部结束                                             | 已验证     | 真实 getDisplayMedia、系统声音、公网/NAT/TURN 未验证             |
| 语音                               | 站点配置 `ENABLE_ROOM_VOICE` 默认关；关着不监听、不申请麦克风、不播放                | useVoiceChat.test、ChatFloatingWindow.voice.test                                                                                                            | 语音批：关着时陌生来电 0 连接/0 AudioContext/0 getUserMedia；开着+假音频设备两端 ICE 连通且收到远端音轨                     | 已验证     | 真实麦克风、回声、跨网络未验证；服务端转发不看配置（按约定未改） |
| external 观影室服务                | 目录/首页/恢复不再请求必败的 `/api/rooms`，显示明确边界文字                          | RoomWorkspace.external、HomeRooms                                                                                                                           | 未起外部模式（会与现有预览共用 `.next`）                                                                                    | 仅自动化   | 外部服务对本站房间协议的兼容性无法验证，本仓库没有该服务         |
| 电影 ↔ 音乐/直播/TV/屏幕观众的声音 | 同浏览器同一时刻只有一个出声者，显式点播放才抢                                       | useAudioFocus.test、RoomActivityActions、useStandalonePlayback、各页 page.test                                                                              | 见 F 节                                                                                                                     | 部分已验证 | 见 F 节矩阵                                                      |

## C. 播放器小模块（审计第六节）

| 模块                                      | 状态       | 说明                                                                                                               |
| ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 查源/换源/选集/倍速/跳过片头尾 → 同步发布 | 仅自动化   | usePlaySync.test；主持切源整链未走真实来源                                                                         |
| 播放记录/收藏/更新通知                    | 仅自动化   | 房间明确集数优先规则有测试；个人记录未改                                                                           |
| 代理 / 原生 HLS / HLS.js                  | 未改动     | 共享状态只放可移植的 http(s) 地址，blob/相对地址不共享（usePlaySync.test：`blob:…` → 空）                          |
| 本地文件 / IndexedDB / 离线下载           | 未改动     | 本机可播，不作为朋友可访问的影片                                                                                   |
| 字幕 / 本地字幕                           | 未改动     | 本地字幕是个人配置，不发给朋友                                                                                     |
| 历史弹幕 / 过滤 / 热力图                  | 未改动     | 与房间实时消息分离，外部弹幕失败独立降级                                                                           |
| 清晰度增强 / Anime4K / 截图               | 未改动     | 本机渲染，不影响全房间进度                                                                                         |
| 下载                                      | 未改动     | 下载任务独立，完成不触发换片/退房（未独立验证）                                                                    |
| AI 问片 / 点评 / 豆瓣评论 / 智能推荐      | 未改动     | 推荐选片已回统一入口（C02）                                                                                        |
| 聊天浮窗 / 工作区嵌入 / 未读              | 已验证     | ChatFloatingWindow.test；Task4 双账号全屏消息                                                                      |
| 网页全屏 / 原生全屏 / 画中画              | 部分已验证 | 网页全屏和容器全屏里聊天覆盖层与输入可用（Task4 浏览器）；系统原生视频全屏、系统画中画不能承载网页界面，未声称支持 |
| 跨标签声音归属                            | 部分已验证 | 见 F 节                                                                                                            |
| 账号 / 模块开放状态 / 数据源权限          | 仅自动化   | 登录保留目标有测试；私人源/网盘的第二账号取流未验证                                                                |

## D. 消息与弹幕（审计第四节）

| 项                                        | 状态     | 证据                                                                                                                       |
| ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 聊天 → 播放器实时消息层（含全屏）         | 已验证   | RoomLiveMessages.test；Task4 真实 Edge：容器全屏/网页全屏/390–1280 深浅六态                                                |
| 播放器输入 → 聊天栏（同一消息流，不重复） | 已验证   | RoomLiveMessages.test、useWatchRoom.test（realtime consumers…、own confirmed message…）；Task4 双账号                      |
| 历史消息不飘屏、重连补缺不重复            | 已验证   | useWatchRoom.test（reconnect fills an offline gap…、duplicate realtime deliveries…）                                       |
| 失败保留草稿、同命令重试（C16）           | 仅自动化 | RoomLiveMessages.test、ChatFloatingWindow.test、useWatchRoom.test（retrying an uncertain message…）；没有做真实丢 ACK 复现 |
| 旧房回包不污染新房（C17）                 | 仅自动化 | useWatchRoom.test 多条（former room…）、ChatFloatingWindow.test（an old room send failure…）                               |
| 已读：可见 + 前台 + 焦点才提交            | 已验证   | ChatFloatingWindow.test；Task4 隐藏聊天未读保留                                                                            |

## E. 冲突清单 C01–C17（审计第十一节）

| 编号 | 一句话                                       | 结论       | 证据                                                                                                                                                                                                                                                                                               |
| ---- | -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01  | 离开房间页后选别的片，仍被当作跟房           | 已验证     | 个人观看与页面位置分离；PlaybackSessionProvider 多条；Task3 浏览器（个人 B 返回房间仍 B）                                                                                                                                                                                                          |
| C02  | `/play` 内选片整页刷新，与旧房快照争写       | 已验证     | VideoCard.navigation；Task3 同一 video                                                                                                                                                                                                                                                             |
| C03  | 空房普通成员选 B，主持后开 A                 | 仅自动化   | PlaybackSessionProvider（asks an ordinary member how to watch even when the room has not started a film）                                                                                                                                                                                          |
| C04  | 个人观看中的主持选新片留下待共享标记         | 仅自动化   | PlaybackSessionProvider（keeps an explicit personal selection…）                                                                                                                                                                                                                                   |
| C05  | 片单 ACK 等待时切页/切房                     | 仅自动化   | PlaybackSessionProvider（ignores an old queue acknowledgement…）、RoomFilmSelection（a target room mismatch…）                                                                                                                                                                                     |
| C06  | 活动已切成直播/音乐/共享，旧选片标记仍抢活动 | 仅自动化   | usePlaySync.test（a selection from the previous activity cannot reclaim a live room）                                                                                                                                                                                                              |
| C07  | 打开直播页只是浏览，却替全房切活动           | 已验证     | useLiveSync.test；直播批浏览器                                                                                                                                                                                                                                                                     |
| C08  | 直播快照回到发送者，重复广播                 | 已验证     | useLiveSync.test（browsing and new snapshot objects never broadcast…）                                                                                                                                                                                                                             |
| C09  | 音乐快照回声                                 | 已验证     | useRoomMusicActivity.test；音乐批浏览器                                                                                                                                                                                                                                                            |
| C10  | 慢 A / 快 B 点歌覆盖                         | 仅自动化   | 账本核对时发现音乐页（`MusicClient.playSong`）没有任何代次保护：B 先回、A 后回时，本机 `<audio>` 被改成 A，而房间已是 B。先写失败回归 `MusicClient.selection.test`（先失败，收到的是 A 的地址），再给 `playSong` 加选歌编号后通过。`/web-live` 页另用 useLatestMediaRequest（其测试覆盖慢 A/快 B） |
| C11  | 房主账号 / 授权主持 / 同账号其他设备权限打架 | 已验证     | 各活动统一 `canControl`；RoomActivityActions；屏幕批、音乐批同账号第二设备                                                                                                                                                                                                                         |
| C12  | 已在 A 房间，从播放页再建 B                  | 已验证     | 见 A 节：在房间里播放页只有“返回房间”，房间数不变                                                                                                                                                                                                                                                  |
| C13  | 电影与独立播放器同时出声                     | 部分已验证 | 见 F 节                                                                                                                                                                                                                                                                                            |
| C14  | 屏幕采集选择器未结束时切房                   | 仅自动化   | useScreenShare.test（a screen picked after the room has changed is discarded…）                                                                                                                                                                                                                    |
| C15  | 聊天/片单被无关的播放版本更新拒绝            | 仅自动化   | room-service.test（chat and reads remain valid across unrelated playback revisions…、adding a waiting film survives unrelated playback revisions…）                                                                                                                                                |
| C16  | ACK 丢失后手动重发生成第二条                 | 仅自动化   | 见 D 节                                                                                                                                                                                                                                                                                            |
| C17  | A 房聊天回包回写 B 房                        | 仅自动化   | 见 D 节                                                                                                                                                                                                                                                                                            |

## F. 声音归属矩阵

规则：同一浏览器里，同一时刻只有一个标签页或一个播放器持有声音租约；其他播放器继续解码或同步，但被静音。用户显式点播放才会抢声音，进入页面或注册元素不抢。语音是通话，不进租约。

| 对象 A（先出声）       | 对象 B（后点播放）           | 状态     | 证据                                                                                                 |
| ---------------------- | ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| 房间电影（同标签页）   | TV 播放页                    | 已验证   | TV 批：同标签页 615 次采样两路同时出声 0 次；电影暂停并静音                                          |
| 房间电影（另一标签页） | TV 播放页                    | 已验证   | TV 批：B 出声，A 的电影继续放但被静音                                                                |
| 屏幕共享观众页         | TV 播放页，再反向            | 已验证   | 语音批补测：TV 播放后观众静音，观众再播放后 TV 静音                                                  |
| 房间电影               | 直播预览（“在此页播放声音”） | 已验证   | 之前的复现没有出现问题；直播批浏览器                                                                 |
| 房间电影               | 音乐页 / 音乐听众页          | 仅自动化 | useAudioFocus.test、watch-room/music/page.test；音乐批浏览器没有做两个播放器抢声音                   |
| 房间电影               | 屏幕共享观众页               | 仅自动化 | watch-room/screen/page.test（the shared picture takes over the sound only when the viewer plays it） |
| 任一媒体               | 语音远端音频                 | 未验证   | 语音不进租约，同账号多标签页会重复播放远端语音，已知限制                                             |

## G. 双账号 / 重连 / 乱序 矩阵

补验用真实本机服务、房主账号和一个已有的普通 QA 账号（Task 4 创建，本轮没有新建账号），QA 房间 `D6DAD478891B`。协议层脚本直接连 Socket.IO，各客户端是独立连接。

### G1. 协议矩阵：14/14 通过

| 场景                                       | 结果                                   |
| ------------------------------------------ | -------------------------------------- |
| 两个真实账号：房主设备是主持，普通账号不是 | 通过                                   |
| 普通账号发播放控制                         | 被拒绝（NOT_CONTROLLER）               |
| 普通账号追加待看                           | 允许                                   |
| 普通账号移除房主的待看                     | 被拒绝（FORBIDDEN）                    |
| 普通账号给待看排序                         | 被拒绝                                 |
| 普通账号移除自己的未播待看                 | 允许                                   |
| 过期的房间版本                             | 被拒绝（REVISION_CONFLICT）            |
| 过期的主持代次                             | 被拒绝（STALE_CONTROLLER）             |
| 指向别的房间的命令                         | 被拒绝，不在本房执行                   |
| 同一命令编号重复发送                       | 只保存、只广播一次（`duplicate=true`） |
| 聊天带着过期的播放版本                     | 仍然成功（C15）                        |
| 同一账号两台设备                           | 不会同时拥有主持权                     |
| 主持设备掉线后的宽限期                     | 普通账号拿不到主持权                   |
| 房主账号重连后                             | 只有一台设备持有主持权，普通账号没有   |

### G2. 浏览器补验（真实 Edge）

| 场景                          | 结果                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| 普通 QA 账号作为屏幕共享观众  | 房主共享（假采集）时在观众页收到画面                                                             |
| 普通 QA 账号作为音乐听众      | 房主在房间里发起音乐活动，听众页进入并跟随状态；真实出声只有单测                                 |
| 房主整页刷新（屏幕共享页）    | 发现并修复：刷新后本浏览器被“禁止连接房间”标记挡住（见下），修复后重新进房、能结束或重新开始共享 |
| 房主整页刷新（音乐页）        | 8 秒内拿回主持，音乐活动继续                                                                     |
| 首页 Hero“一起看”（已在房间） | 带着所选影片进入房间选片，当前活动继续                                                           |
| 播放页（已在房间）            | 只显示“返回房间”，房间数不变                                                                     |

### G3. 本轮发现并修复的缺口（均先写失败回归）

| 编号        | 缺口                                                                                           | 修复                                                                               | 回归                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 新 1（C10） | 音乐页 `playSong` 没有代次保护，慢 A 后到会盖掉快 B                                            | 选歌编号，晚到的回包直接丢弃                                                       | `MusicClient.selection.test`（2 条）                                 |
| 新 2        | 屏幕共享页在持有“禁止连接”标记时整页刷新，React 清理不执行，标记留 10 分钟，本浏览器进不了房间 | 页面监听 `pagehide` 清理标记                                                       | `watch-room/screen/page.test`（pagehide 清理）                       |
| 新 3        | 刷新后房间仍显示“正在共享”，但本设备已没有采集，主持无法结束或重开                             | 主持设备在“房间共享但本地无采集”时允许停止和重新开始；非主持永远不能结束别人的共享 | `useScreenShare.test`（3 条）、`watch-room/screen/page.test`（2 条） |

### G3b. 独立审阅（只读子代理：code-reviewer、security-reviewer）发现并修复的缺口

两个审阅只读代码，没有运行；下面的修复都先写了失败回归，再改，再看通过。

| 编号 | 问题                                                                                                                           | 修复                                                              | 回归                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| M1   | socket 重连后服务端是全新会话（未就绪）；空闲/直播/音乐/共享房间里的设备依赖没变，不会重新声明就绪，旧主持过了宽限期就没有主持 | `useWatchRoom` 重新加入成功后计数加一，就绪 effect 依赖它         | `useWatchRoom.test`（after a socket reconnect…fresh session）                |
| M2   | 个人观看的设备重连后，服务端默认“跟随”，客户端不重申，会被选成主持而界面是个人观看                                             | 暴露重新加入计数；会话层在个人观看时重新发 `room:following=false` | `PlaybackSessionProvider.test`（reconnect 两条：个人观看重申、跟随者不多发） |
| M3   | 主持选中的待看项在开始前被移除，服务端回 `QUEUE_ITEM_NOT_FOUND`，选择状态不清，每 500ms 重发一次                               | 命令错误带上服务端 `code`；该码出现就清掉选择                     | `usePlaySync.test`（a queue item removed before it could start…）            |
| M4   | 房间已切到直播/音乐/共享时关旧电影窗口，只关窗口，但把“跟随”偏好存成了 false，刷新后变成个人观看                               | `stopPlayback` 存当前真实的跟随状态                               | `PlaybackSessionProvider.test`（…next reload…）                              |
| M5   | 音乐换歌后紧跟的进度更新带旧房间版本，必被拒（`REVISION_CONFLICT`）；快速连换时 `music:change` 可能丢，房间停在旧歌            | 音乐发布命令串行：前一条确认后再发下一条                          | `useRoomMusicActivity.test`（publish ordering 两条）                         |
| L1   | 刷新后重新开始共享，本地预览 `<video>` 晚于采集挂载，预览空白（观众正常）                                                      | 每次渲染后补赋 `srcObject`                                        | `useScreenShare.test`（a preview element that mounts after…）                |
| S5   | 服务端待看片单允许 `/live`、`/music`，客户端播放入口只认 `/play`，点“开始播放”抛未捕获异常                                     | 服务端只收 `/play`（`INVALID_MEDIA`）                             | `room-service.test`（waiting list only accepts film entries…）               |

### G3c. 审阅发现但本轮没改的（需要你定）

| 编号               | 问题                                                                                                                                                                                                                                 | 为什么没改                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 安全 1（中）       | 房间直播活动里的 `channelUrl` 在本机频道列表找不到时，直播页会合成一个频道去加载；`.flv`/`.mp4` 会被浏览器直连，等于主持人能让每个跟随者的浏览器请求一个任意地址（泄露 IP、盲发 GET）。走 `/api/proxy/m3u8` 的有 SSRF 防护，不受影响 | 这是 Codex 有意加的“本机没有该频道也能一起看”，收紧会让没有同一直播源的成员看不了；是产品取舍，不是笔误 |
| 安全 2（中，既有） | 外部观影室共享密钥发给所有登录用户，用户名由客户端自报；`externalServerUrl` 不校验 `https`                                                                                                                                           | 本轮没改这条链路；外部服务兼容性本来就未验证                                                            |
| 安全 3（低）       | 服务端语音转发不看 `ENABLE_ROOM_VOICE`；`audio-chunk` 单包上限 32768 与真实客户端 8192 差距大，限流与其他命令共用                                                                                                                    | 按约定不改服务端转发；已核实转发限定在同房间成员                                                        |
| 安全 4/6/7（低）   | 语音开启时对同房成员的 offer 自动应答（P2P 固有）；未登录公开房间列表含房主用户名且无限流；`watch_room_no_connect` 多标签页时 `release()` 无条件删除                                                                                 | 影响小或属于既有设计                                                                                    |
| L2                 | 共享中点“返回房间”只释放本机采集，不通知服务端，房间仍显示“共享中”                                                                                                                                                                   | 可用“停止/重新开始共享”补救；改成离开页面自动停止是行为决定                                             |
| L3                 | 屏幕共享信令服务端按账号放行，不按设备                                                                                                                                                                                               | 只限同账号自己的设备                                                                                    |
| L4                 | 房间连接中断时，TV 页/音乐页/直播页的“退出共同播放”等不到确认，播放入口整体关死                                                                                                                                                      | 需要改“断线时本地直接置个人观看”的整体语义                                                              |
| L5                 | `queue:remove` / `queue:move` 受 `baseRevision` 约束，播放中约几个百分点概率误冲突                                                                                                                                                   | 豁免是服务端协议变化，留给你决定                                                                        |

### G4. 没有做的

- 没有创建第二个新账号（按约定）；邀请链接“未登录 → 登录 → 加入”没有在浏览器用第二账号走。
- 真实丢 ACK、断网半开连接没有复现，只有单测。
- 房间电影与音乐页同时抢声音没有浏览器证据。

## H. 已知边界与不会冒充通过的项

1. 没有真实外部来源（私人影库、网盘、AI、豆瓣、真实直播/音乐源）。
2. 没有真实手机、电视、遥控器；iOS 原生全屏/系统画中画不承载网页消息层。
3. 真实屏幕采集对话框、系统声音、公网/NAT/TURN、真实麦克风与回声没有验证。
4. 外部观影室服务只做“显式边界”，兼容性没有验证。
5. 两个遗留的界面问题只记录，不在本轮处理：房间电影小窗会压住固定在右下角的音乐播放卡片右侧控件；主持设备从房间点“音乐”要多点一次才回到播放器。
6. 个人观看的设备要共享活动，需先点“恢复一起看”（与直播一致）。
7. 音乐页的慢 A/快 B 保护是 `playSong` 里自带的选歌编号，没有复用 `useLatestMediaRequest`；本站代理开启时（旧回包写封面和歌词）的分支加了同样的判断，但回归只覆盖了不走代理的分支。
8. 全量 Jest 在本机会出现原生崩溃（无测试失败诊断），验证用按文件分组的串行完整枚举代替，见最终检查记录。
