# TongMuTV Plus 桌面客户端（Windows）

Tauri 2 壳：窗口里装的是系统自带的 WebView2（Edge 内核），打开你填写的服务器地址。网站更新，客户端自动同步，无需重新安装。

- 首次启动填写服务器地址，之后自动连接。
- `Ctrl+Shift+S` 更换服务器地址，`F11` 全屏。
- 没有系统标题栏（它的颜色随每个人的系统设置，没法统一）。窗口右上角由页面自己画最小化、最大化 / 还原、关闭三个按钮，顶栏空白处按住拖动、双击最大化。按钮就在网页里，所以切主题时和网页是同一次过渡，不存在“传消息”的延迟。网页全屏（含视频全屏按钮）时按钮自动收起，窗口跟着全屏。
- 支持 Windows 10 / 11（x64、ARM64）。Windows 7 / 8 不支持，请用浏览器访问。
- 安装包未做代码签名，首次运行会出现 SmartScreen 提示：点「更多信息 → 仍要运行」。

## 打包

全部在 GitHub Actions 里完成，本机不用装 Rust：

Actions → **Build Windows Desktop** → Run workflow，完成后在页面底部下载 `.exe`。

## 窗口按钮怎么做的

一个无系统边框的窗口，里面只有一个页面。`src-tauri/src/inject.js` 在每个页面（含你填的服务器网站）加载时注入：

- 在 `<body>` 末尾追加一个 `<tm-shell-controls>`（影子 DOM），里面是三个按钮和顶部一条 10px 的拖动条；颜色直接用站点的 `--tm-bg` / `--tm-text` / `--tm-danger`，没有这些变量的网站退回浏览器默认的 Canvas / CanvasText。
- 顶栏右侧的操作区（`.tm-header-actions`）整体左移 138px 给按钮让位，用的是可构造样式表，不往页面里加节点。其他网站没有这个类名，不受影响。
- 页面全屏时（`html:fullscreen`）按钮隐藏，同时通知壳让窗口全屏。
- 窗口命令只有两个：`tm_window`（最小化 / 最大化 / 关闭 / 拖动 / 查状态）和 `tm_fullscreen`。权限在 `src-tauri/capabilities/main.json`，命令清单在 `src-tauri/build.rs`，别的命令一个都没开。

## 目录

| 路径                      | 说明                                                 |
| ------------------------- | ---------------------------------------------------- |
| `ui/index.html`           | 本地"填写服务器地址"页                               |
| `src-tauri/src/main.rs`   | 窗口创建、2 个命令                                   |
| `src-tauri/src/inject.js` | 注入每个页面的脚本：快捷键、窗口按钮、拖动、全屏联动 |
| `src-tauri/capabilities/` | 谁能调用哪些命令                                     |
| `src-tauri/icons/`        | CI 里用 `public/icons` 自动生成，不提交              |
