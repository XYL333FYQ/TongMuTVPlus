# 设计参考（可直接用浏览器打开）

这些 HTML 是设计画板展开后的静态版本，用任何浏览器直接打开即可。它们是视觉的唯一真值：尺寸、间距、字号、颜色、对齐、元素顺序，都以它们为准。

| 文件 | 对应页面 | 视口 |
|---|---|---|
| home-desktop-{dark,light}.html | 首页（桌面） | 宽 1280，高度随内容 |
| home-phone-{dark,light}.html | 首页（手机） | 390×844 |
| room-desktop-{dark,light}.html | 房间页（桌面） | 1280×860 |
| room-phone-{dark,light}.html | 房间页（手机） | 390×844 |
| detail-desktop-{dark,light}.html | 影片详情（桌面） | 1280×960 |
| detail-desktop-series-dark.html | 剧集详情（带选集） | 1280×960 |
| detail-phone-{dark,light}.html | 影片详情（手机弹层） | 390×844 |
| choose-room-phone-{dark,light}.html | 一起看：选房间（手机） | 390×844 |

注意：
- 画板里的海报、剧照是灰色占位块，真实页面用真实图片。
- 画板里的片名、人数、房间名是示例数据。
- 画板用的是 Noto Sans SC 或系统回退字体；正式字体按 TYPOGRAPHY.md。
- `build.cjs` 是生成脚本，不属于项目代码，不要放进 src。
