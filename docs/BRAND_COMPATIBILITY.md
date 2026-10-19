# TongMuTV Plus 品牌检查白名单

普通页面、默认提示、邮件、推送、安装名称和自有图标使用 **TongMuTV Plus**。以下旧名称出现时须按用途判断，不能全局替换。

| 允许保留的标识                                                                                                                                         | 原因与边界                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 原 README / LICENSE / CHANGELOG、`src/lib/changelog.ts`、`UPSTREAM_VERSION.txt`、品牌元数据的 `upstream*`、关于与致谢中的 MoonTVPlus / MoonTV / LunaTV | 真实来源、许可和历史记录；不得改写成自研成果。                                                                          |
| `MoonTVPlus` / `MoonTVPlusVideoCache` IndexedDB 库名、`moontv_*` 浏览器键、`.data/moontv.db`、`__moontv_idb_video__` 路由                              | 历史、下载和缓存兼容；新品牌不创建一份空数据库。                                                                        |
| `moontv-source` 请求参数、`MOONTV_LITE` 环境变量、`__MOONTV_*` / `__moonTv*` 内部缓存符号                                                              | 既有配置、请求与运行状态兼容。                                                                                          |
| `moontvplus-site` / `data-moontvplus`、`MoonTVLocalRemote`、`__MOONTV_LOCAL_REMOTE_URL`、`moontv:local-remote-*`、`moontv_local_settings_applied`      | 配套扩展识别、Android 与网页遥控桥接、浏览器设置同步。改动需要两端同时提供迁移。                                        |
| `moontvplus://` / `moontvpluspc://`、MoonTVPlus-PC / MoonTVPlus 扩展及其下载链接                                                                       | 真实第三方客户端或工具，明确标注第三方；不是本项目发行地址。                                                            |
| `com.moontvplus.tv` Android 包名与 Java 路径、现有 Android UA、入站认证中的 `moontvplus` / `moontvplus app` 判断、Emby 兼容认证头                      | 第一版保留客户端兼容；显示名称和图标已经独立更换。未来独立发行 Android 须另定应用 ID 与签名，不能靠文字替换覆盖原 App。 |
| 出站 `MoonTVPlusBot` / `MoonTVPlus/1.0` 旧 User-Agent                                                                                                  | 暂时保留请求兼容身份；不作为产品名称展示。                                                                              |
| 原项目 GitHub 地址、版本及变更记录请求                                                                                                                 | 仅在明确标注“原项目/上游参考”的入口使用，不显示为本项目可自动安装的更新。                                               |

管理员自行填写的站名、公告、AI 问候、来源名称不进行包含词替换；站名迁移只匹配明确的旧默认值。

尚未建立本项目远程仓库和镜像发行地址。源码自带的其他上游部署模板与镜像链接不属于本项目已发布成果；发布前须配置本项目自己的目标，不能改一下显示名就宣称它们在部署本项目。

可读检查：`rg -n -i 'moontv|moon tv' src scripts public .github -g '!changelog.ts' -g '!libbitsub/**' -g '!*.map'`。检查结果逐项对照上表，新增用户可见品牌不在此白名单中。
