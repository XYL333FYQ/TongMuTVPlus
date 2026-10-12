# 媒体失败恢复、个人观看返回与主持边界复核

日期：2026-10-09 UTC。使用系统 Temp 内的隔离 SQLite、两个测试账号，以及原创 120 秒 720p H.264/AAC MP4/HLS。相邻 TongMu、正式数据库和生产部署未修改。

## 已确认的问题与修复

首次加载途中断网后，Socket 和房间目录可以恢复，但视频仍可能处于 error=4、readyState=0。旧播放器提供了错误与重试按钮；房间内嵌、小窗、折叠布局只显示媒体挂载区域，旧页面的错误操作区被隐藏，用户无法实际使用它。

修复位于全站 PlaybackSessionProvider：当媒体失败且不是完整播放页时，在可见的全站区域提供“影片暂时无法播放”和“重新加载影片”。点击只重建本机媒体部分、清除旧错误并进入准备状态；保持影片引用、房间连接、片单和跟随状态。完整播放页继续使用原有错误处理。未增加自动换源、默认转码或降低画质。

这解释了为什么“聊天重连了”不能证明“视频恢复了”：房间长连接负责进度和消息，视频另从来源读取清单与分片，两条链路可以分别失败。

## 媒体恢复的实际证据

初次复验使用真实断网遗留的失败标签：原生 video error=4、readyState=0，旧提示为“无法访问视频源（可能是跨域限制或访问被拒绝）”。更新后能看见并实际点击新恢复入口，重新解码到房间进度。这一步发生过开发热更新，因此另做完整刷新后的独立复现，不能单独以热更新结果验收。

| 场景 | 实际结果 | 边界 |
| --- | --- | --- |
| 完整刷新后首次 HLS 失败 | 仅在成员标签临时阻断 localhost:3201/qa.m3u8，完整刷新后原生 video error=4、readyState=0，新恢复提示实际可见。 | 阻断的是本地测试清单；不是所有真实来源故障的模拟。 |
| 解除阻断并实际点击恢复 | 成员重新请求清单/分片，观察到 HTTP 200，token=qa 保留；重新解码到 91.748567 秒，房主为 92.248303 秒，两端 paused=false、readyState=4、1280×720。 | 观察窗口内成员未发送换片、退房或片单修改命令；没有以此宣称所有 Socket 消息均停止。 |
| 恢复不打断房主 | 房主 video backendNodeId 始终为 2146，78.57054 → 92.248303 秒，解码帧 6996 → 7323；没有因成员重试重建或暂停。 | 本机重试与房间换片是两种不同操作。 |
| 390×844 房间/小窗/折叠 | 恢复按钮可见，矩形 x=258、y=686.333、宽97.333、高40；innerWidth=scrollWidth=390。成员进入搜索、折叠后仍能实际点击。解除阻断后 readyState=4、1280×720、113.441726 秒，与当时暂停的房间一致。 | 桌面内置浏览器窄视口；不能替代真机键盘、旋转、后台恢复。 |

相关截图：screenshots/media-recovery-visible-20261009.jpg、media-recovered-synchronized-20261009.jpg、mobile-media-recovery-20261009.jpg、mobile-folded-media-recovery-20261009.jpg。

## 个人观看中返回正在播放的房间

实际通过房间片单选择 MP4，再点“仅自己看”。房主保留房间连接，授权成员成为主持并继续房间 HLS。两端原生 video 分别为：个人 MP4 4.033824 秒/paused=false/readyState=4；成员 HLS 74.334691 秒/paused=false/readyState=4。

房主实际点击“回到一起看”，本机改回房间 HLS，采用房间最新进度后恢复唯一主持。首次采样两端83.917689/84.846661秒，随后98.90103/98.705926秒，均实际播放、readyState=4，解码帧持续增加。截图 personal-return-playing-20261009.jpg。没有把个人观看返回到自然结束片尾的旧记录当成这次证明。

## 主持宽限与无候选

- 短连接中断：房主标签在1791506820884关闭，新标签在1791506825043打开，约4.159秒；约8.797秒时已经重新进入房间。成员没有接管。随后服务器将同一qa-owner账号的主持设备更新为新标签，事件时间1791506835741，约关闭后14.857秒；不把设备更新事件说成“完全没有controller-changed”。本轮是实际关闭/重开连接，不能冒充所有移动网络短断线场景。
- 无授权候选：实际取消qa-member主持授权，然后播放HLS并关闭房主标签，关闭时刻1791506854760。服务在1791506884974发出controllerAccountId=null，约30.214秒；成员没有获得主持控制。31.786秒采样界面为“暂无主持，影片继续”，视频60.042848→91.936455秒、帧2004→2768、paused=false、readyState=4。截图no-authorized-host-20261009.jpg。

浏览器CDP仅用于原生DOM/视频/网络观测及临时网络故障模拟，没有写入React或应用状态容器。清单阻断已解除，断网模拟已恢复在线。最初仅设置Network offline未立即观察到已有Socket断开，因此不以那次尝试证明短断线，而采用上述真实关闭/重开连接。

## 续验发现并修复：无人主持时影片已结束，房主无法准备好

第一轮无候选测试后，成员自然到120.021333秒、paused=true、readyState=4。房主返回仍无主持；观察到服务快照时间已到157.697861秒且isPlaying=true。直到重新授权成员、成员获得主持并提交实际暂停状态后，房主才恢复。确认问题不只是浏览器禁止自动播放：同步逻辑仍在尝试采用超过片长的时间及播放状态，无法完成准备。

usePlaySync现在对已知、有限且大于零的原生video.duration限制同步目标；达到片尾时先停止本机播放，再完成sync-applied与ready。接管后由新主持提交真实暂停进度。直播Infinity、尚未知晓的NaN/0不按片尾处理。保留原有“暂停在seek之前”和“seek完成才ready”的规则，不修改媒体地址、质量或房间授权。

新增用例在旧代码失败（目标120秒却设置成200秒，无法ready）；修复后通过，另外三项覆盖未知/直播片长不被误停。

最终代码完整刷新后复验：实际取消成员候选资格，房主在1791507167538关闭。约56.354秒时成员为120.021333秒、ended=true、paused=true、readyState=4，仍无主持。重新打开房主，观察到初始快照controller=null、156.118898秒、isPlaying=true；随后实际发送sync-applied→ready，服务在1791507246445恢复qa-owner为唯一主持，最后快照120秒、isPlaying=false。房主原生video为120秒、paused=true、readyState=4，没有通过点击播放绕过这次准备流程。成员授权已在测试后恢复。

截图finite-end-host-return-20261009.jpg；直接观察事件节选finite-end-host-return-20261009.json。调试事件缓冲报告truncated=true，早期无关事件已被淘汰；上述快照、准备与交接事件实际保留，不能把节选称为完整流量记录，也不以浏览器采样代替五秒门槛计时测试。

## 直接回归

新增三个参数化用例覆盖房间内嵌、小窗与折叠：错误入口存在；点击后只有本机video重建；影片引用与跟随状态保留；不触发房间命令、Socket换片或页面跳转。新增用例在旧实现均失败，修复后Provider共9项通过。模拟video只证明组件行为，不证明实际解码。

```text
node --regexp-interpret-all node_modules/jest/bin/jest.js src/features/playback/PlaybackSessionProvider.test.tsx src/hooks/usePlaySync.test.tsx src/features/playback/session.test.ts --runInBand --silent
```

加入片尾边界后最后再次执行：3套件24/24（Provider 9、同步Hook 11、会话4）。与历史20/31/61等批次重叠，不累加总数。

```text
node --regexp-interpret-all node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false
node --regexp-interpret-all node_modules/eslint/bin/eslint.js src/hooks/usePlaySync.ts src/hooks/usePlaySync.test.tsx src/features/playback/PlaybackSessionProvider.tsx src/features/playback/PlaybackSessionProvider.test.tsx
node node_modules/prettier/bin-prettier.js --check src/hooks/usePlaySync.ts src/hooks/usePlaySync.test.tsx src/features/playback/PlaybackSessionProvider.tsx src/features/playback/PlaybackSessionProvider.test.tsx src/features/playback/playback.css
```

ESLint exit 0，保留同步Hook测试原有7条any警告，新增用例未增加该警告。五个文件Prettier检查通过。最后测试类型注解收紧后的完整TypeScript再次正常exit 0；上述结果对应最终源码。

## 未覆盖与后续

手动重试入口解决的是失败后无法操作的问题，不能保证失效来源、过期签名或不兼容编码重试后一定成功。还需真实上游/代理回退、播放中途更复杂断线、后台已读与长历史浏览器分页、多设备/后台声音边界、真机/PWA及生产容器验证。最终P01–P20完成审计仍未完成。
