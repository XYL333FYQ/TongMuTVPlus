# TongMuTV Plus 品牌检查白名单

普通页面、默认提示、邮件、推送、安装名称和自有图标使用 **TongMuTV Plus**。以下旧名称出现时须按用途判断，不能全局替换。

| 允许保留的标识                                                                                                                                    | 原因与边界                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GitHub README 的来源说明、原 README / LICENSE / CHANGELOG、`UPSTREAM_VERSION.txt` 和源码历史资料                                                  | 保留真实归属，不作为网站运行时品牌信息或发布记录，不改写成自研成果。                                                    |
| `MoonTVPlus` / `MoonTVPlusVideoCache` IndexedDB 库名、`moontv_*` 浏览器键、`.data/moontv.db`、`__moontv_idb_video__` 路由                         | 历史、下载和缓存兼容；新品牌不创建一份空数据库。                                                                        |
| `moontv-source` 请求参数、`MOONTV_LITE` 环境变量、`__MOONTV_*` / `__moonTv*` 内部缓存符号                                                         | 既有配置、请求与运行状态兼容。                                                                                          |
| `moontvplus-site` / `data-moontvplus`、`MoonTVLocalRemote`、`__MOONTV_LOCAL_REMOTE_URL`、`moontv:local-remote-*`、`moontv_local_settings_applied` | 配套扩展识别、Android 与网页遥控桥接、浏览器设置同步。改动需要两端同时提供迁移。                                        |
| 旧客户端识别所需的 `moontvplus://` / `moontvpluspc://`（如存在消费者）                                                                            | 仅保留必要的协议兼容；网站不推广或链接原项目客户端，不把其称为本项目发行。                                              |
| `com.moontvplus.tv` Android 包名与 Java 路径、现有 Android UA、入站认证中的 `moontvplus` / `moontvplus app` 判断、Emby 兼容认证头                 | 第一版保留客户端兼容；显示名称和图标已经独立更换。未来独立发行 Android 须另定应用 ID 与签名，不能靠文字替换覆盖原 App。 |
| 出站 `MoonTVPlusBot` / `MoonTVPlus/1.0` 旧 User-Agent                                                                                             | 暂时保留请求兼容身份；不作为产品名称展示。                                                                              |
| 用于兼容与迁移回归测试的旧名称样例                                                                                                                | 证明旧数据仍能读取；不是网站展示文案。                                                                                  |

## 2026-10-24 产品展示规则

- 网站页面、弹窗、安装说明及默认品牌文案只展示 TongMuTV Plus；关于页不再陈列来源项目名称。来源说明集中在 GitHub README 和源码记录。
- 不允许从产品界面请求原项目 CHANGELOG、比较原项目版本或提供原项目仓库与安装推广入口。品牌元数据不含 `upstream*` 字段。
- 旧设备记录中的品牌名在显示层转换为“兼容客户端”，不修改数据库中的设备信息、认证判断或真实第三方身份。
- 普通注释采用准确的功能描述，可安全更名的本地类型使用中性功能名称；协议中的旧字符串、原作者声明和第三方代码不得机械替换。
- `src/lib/changelog.ts` 的历史日志副本已移除；网站仅引用 `src/lib/project-changelog.ts`。原始根 CHANGELOG 仍作为源码历史资料保留。

管理员自行填写的站名、公告、AI 问候、来源名称不进行包含词替换；站名迁移只匹配明确的旧默认值。

尚未建立本项目远程仓库和镜像发行地址。源码自带的其他上游部署模板与镜像链接不属于本项目已发布成果；发布前须配置本项目自己的目标，不能改一下显示名就宣称它们在部署本项目。

可读检查：`rg -n -i 'moontv|moon tv' src scripts public .github -g '!changelog.ts' -g '!libbitsub/**' -g '!*.map'`。检查结果逐项对照上表，新增用户可见品牌不在此白名单中。
