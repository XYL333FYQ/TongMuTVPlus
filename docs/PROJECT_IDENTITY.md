# TongMuTV Plus：品牌、来源与升级

本项目版本为 `0.1.0`，上游本地快照标注版本为 `226.1.0`。上游为 [MoonTVPlus](https://github.com/mtvpls/MoonTVPlus)，进一步来源参见原始 README 的 MoonTV / LunaTV 与贡献者说明。没有经过验证的上游提交号，不推断提交号。

改造前副本位于同级 `TongMuTVPlus-baselines/2026-10-08T05-24-38-745Z`。原始 README、LICENSE 和上游 CHANGELOG 保留，不将其改写成由本项目原创。根 LICENSE 文本为 CC BY-NC-SA 4.0，而原 README 标注 MIT，此矛盾尚待核实；此记录不构成法律判断或新增授权。第三方组件许可独立保留。

## 品牌与兼容

`src/lib/brand.json` 是公开品牌元数据；网页通过 `brand.ts` 使用它，构建脚本读取同一 JSON。产品名称为 **TongMuTV Plus**，使用原创 TM 标志。`public/brand/tm-mark.svg` 是图标源，`node scripts/generate-brand-icons.js` 生成现有路径的 PNG / ICO 图标，不改变安装路径。

保留原数据库路径、浏览器存储键、缓存虚拟路由、扩展识别与遥控协议。它们是兼容接口，不是页面品牌。网站不推广原项目客户端，旧登录设备的第三方品牌只转换为“兼容客户端”展示，不冒充本项目发行。

## 旧站名迁移

新安装使用新默认名；自定义站名不覆盖。SQLite 旧库可显式预览：

```text
node scripts/migrate-branding.js --db /path/to/moontv.db --dry-run
node scripts/migrate-branding.js --db /path/to/moontv.db --apply
```

只有空值和精确的 `MoonTV`、`MoonTVPlus`、`MoonTV Plus` 默认名会改成新品牌；包含这些词的自定义名称仍保留。实际应用前创建 SQLite 在线完整备份，包含已提交 WAL 数据；重复执行不会再次修改。迁移后重启服务刷新配置缓存。脚本不会创建新数据库，也不会输出完整配置或秘密。

回退时停止服务，保留当前数据库及其 WAL/SHM 作为故障排查副本，再以生成的完整备份恢复原数据库路径；不要向运行中的库覆盖文件。其他数据库类型可在原管理页面显式修改站点名称，本脚本不处理远程库。`NEXT_PUBLIC_SITE_NAME` 若在部署环境中显式设置，也须由维护者检查。

## 项目更新

`VERSION.txt` 与 `brand.json` 保存本项目版本；`UPSTREAM_VERSION.txt` 仅在源码资料中保留来源快照版本。网站品牌元数据只包含本项目身份，不再导出来源项目字段。

版本面板只展示本项目版本及 `PROJECT_CHANGELOG` 的发布记录。`scripts/convert-changelog.js` 只转换该文件为 `src/lib/project-changelog.ts`；空记录显示“暂无发布记录”。脚本不会从根历史 CHANGELOG 更新项目版本，`--sync-version` 只在版本文本与品牌配置一致时生成统一版本入口。尚未配置本项目发行端点时不请求外部项目、不显示“已是最新”。

2026-10-24 用户确认：网站普通页面、版本弹窗及关于页不再展示来源项目的名称、日志、仓库推广或来源说明；真实归属保留在 GitHub README、许可证和源码资料中。原作者声明、历史记录不改写为本项目原创。
